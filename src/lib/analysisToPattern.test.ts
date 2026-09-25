import { analysisToPattern, analysisToPieces, calibrateProportions, demoCreatureAnalysis, estimatedGauge, mergeAnalyses } from './analysisToPattern'
import { validateAmigurumiAnalysis } from './analysisSchema'

describe('analyse automatique amigurumi', () => {
  it("valide le JSON structuré retourné par l'analyse", () => {
    const analysis = demoCreatureAnalysis(18)
    expect(validateAmigurumiAnalysis(analysis).subject.targetHeightCm).toBe(18)
  })

  it("ignore l'herbe de fond dans le projet de démonstration", () => {
    const analysis = demoCreatureAnalysis(18)
    expect(analysis.uncertainties.some((item) => item.message.includes("l'herbe"))).toBe(true)
    expect(analysis.palette.some((color) => color.name.toLowerCase().includes('herbe'))).toBe(false)
  })

  it('génère automatiquement les pièces principales en volume', () => {
    const pieces = analysisToPieces(demoCreatureAnalysis(18), estimatedGauge)
    expect(pieces.map((piece) => piece.name)).toEqual(expect.arrayContaining(['Tête ronde', 'Corps avec tunique', 'Bras', 'Jambes', 'Oreilles latérales']))
    expect(pieces.every((piece) => piece.rounds.length > 0)).toBe(true)
    expect(pieces.every((piece) => piece.rounds.every((round) => !round.warning))).toBe(true)
  })

  it('redimensionne globalement le personnage', () => {
    const small = analysisToPieces(demoCreatureAnalysis(12), estimatedGauge)
    const large = analysisToPieces(demoCreatureAnalysis(24), estimatedGauge)
    expect(large[0].dimensions.heightCm).toBeGreaterThan(small[0].dimensions.heightCm)
    expect(large[0].rounds.length).toBeGreaterThan(small[0].rounds.length)
  })

  it('crée un patron complet avec assemblage et avertissement', () => {
    const pattern = analysisToPattern({ analysis: demoCreatureAnalysis(18) })
    expect(pattern.kind).toBe('amigurumi')
    expect(pattern.pieces?.length).toBeGreaterThan(4)
    expect(pattern.assembly?.length).toBeGreaterThan(4)
    expect(pattern.notes).toContain('estimé automatiquement')
  })

  it('corrige les proportions sous-estimées avec les boîtes des pièces compactes', () => {
    const analysis = demoCreatureAnalysis(18)
    analysis.subject.imageBoxes = [[0, 0, 1000, 1000]]
    // Head measured at 0.63 of the subject height on a square image, estimated at 0.42.
    analysis.parts[0].imageBox = [0, 200, 400, 830]
    // A box spanning both arms must not be taken for the size of one arm.
    analysis.parts[2].imageBox = [300, 100, 700, 900]
    const calibrated = calibrateProportions(analysis, [{ width: 800, height: 800 }])
    expect(calibrated.parts[0].relativeWidth).toBeCloseTo(0.63)
    expect(calibrated.parts[0].relativeHeight).toBeCloseTo(0.4)
    // Other pieces: widths × 1.5; the arms take the height of their shared box, the legs keep their estimated length.
    expect(calibrated.parts[2].relativeWidth).toBeCloseTo(0.15)
    expect(calibrated.parts[2].relativeHeight).toBeCloseTo(0.4)
    expect(calibrated.parts[3].relativeHeight).toBeCloseTo(0.2)
    // A box far from the estimate is a detection mistake and is ignored.
    analysis.parts[1].imageBox = [0, 0, 1000, 1000]
    expect(calibrateProportions(analysis, [{ width: 800, height: 800 }]).parts[1].relativeHeight).toBeCloseTo(0.38)
    expect(calibrateProportions(demoCreatureAnalysis(18), [{ width: 800, height: 800 }])).toEqual(demoCreatureAnalysis(18))
  })

  it('ne ferme pas les oreilles souples et regroupe les yeux en une consigne', () => {
    const analysis = demoCreatureAnalysis(18)
    analysis.parts[4].primitive = 'ellipsoid'
    analysis.parts[0].features.push({ type: 'eye', description: 'second œil', relativeVerticalPosition: 0.45, relativeHorizontalPosition: 0.62 })
    const pieces = analysisToPieces(analysis, estimatedGauge)
    const ear = pieces.find(piece => piece.id === 'ear')!
    expect(ear.rounds.some(round => round.closePiece || (round.stuffing && round.stuffing !== 'aucun'))).toBe(false)
    expect(ear.rounds.at(-1)!.endStitches).toBeGreaterThan(6)
    expect(pieces[0].notes?.match(/Yeux/g)).toHaveLength(1)
  })

  it('liste le fil nécessaire par couleur', () => {
    const pattern = analysisToPattern({ analysis: demoCreatureAnalysis(18) })
    expect(pattern.generation.supplies.some(text => /Vert du personnage : environ \d+ m/.test(text))).toBe(true)
  })

  it('garde la médiane de plusieurs analyses et les pièces trouvées par la majorité', () => {
    const analyses = [0.3, 0.42, 0.5].map(width => {
      const analysis = demoCreatureAnalysis(18)
      analysis.parts[0].relativeWidth = width
      return analysis
    })
    analyses[0].parts = analyses[0].parts.filter(part => part.id !== 'ear')
    const merged = mergeAnalyses(analyses)
    expect(merged.parts[0].relativeWidth).toBe(0.42)
    expect(merged.parts.filter(part => part.name === 'Oreilles latérales')).toHaveLength(1)
  })

  it('mesure une pièce sur la photo où elle est visible, à plat sur une vue de côté', () => {
    const analysis = demoCreatureAnalysis(18)
    analysis.subject.imageBoxes = [[0, 0, 1000, 1000], [0, 0, 1000, 1000]]
    analysis.parts[0].imageBox = [0, 290, 360, 710]
    // Legs seen lying horizontally on the side view: 0.22 long, 0.13 thick.
    analysis.parts[3] = { ...analysis.parts[3], photoIndex: 1, imageBox: [800, 300, 930, 520] }
    const leg = calibrateProportions(analysis, [{ width: 800, height: 800 }, { width: 800, height: 800 }]).parts[3]
    expect(leg.relativeHeight).toBeCloseTo(0.22)
  })

  it('élargit un ventre plat cousu sur un corps rond', () => {
    const analysis = demoCreatureAnalysis(20)
    analysis.parts.push({ ...analysis.parts[5], id: 'belly', name: 'Ventre', primitive: 'flat-oval', relativeWidth: 0.25, relativeHeight: 0.3, attachment: { parentPartId: 'body', position: 'front', description: 'devant' } })
    const belly = analysisToPieces(analysis, estimatedGauge).find(piece => piece.id === 'belly')!
    // Chord of 5 cm on a body 6 cm wide: the arc is about 5.9 cm.
    expect(belly.dimensions.widthCm).toBeCloseTo(5.9, 1)
    expect(belly.shape).toBe('disque')
  })
})
