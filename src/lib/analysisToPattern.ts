import { generatePieceRounds, pieceCircumference } from './calculations'
import { AmigurumiAnalysisSchema, type AmigurumiAnalysis } from './analysisSchema'
import type { AmigurumiPiece, AssemblyStep, CrochetPattern, CrochetRound, Gauge, Material, PieceKind, PieceShape, ReferenceImage, YarnColor } from '../types'

export const estimatedGauge: Gauge = { stitchesPer10cm: 20, rowsPer10cm: 22 }
export const estimatedMaterial: Material = {
  yarnName: 'Fil amigurumi moyen estimé',
  hookSize: '3 mm',
  mainColor: 'couleur principale détectée',
  secondaryColors: [],
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function primitiveToShape(primitive: AmigurumiAnalysis['parts'][number]['primitive']): PieceShape {
  if (primitive === 'sphere') return 'sphère'
  if (primitive === 'ellipsoid') return 'ellipsoïde'
  if (primitive === 'cylinder') return 'cylindre'
  if (primitive === 'tapered-cylinder') return 'cylindre'
  if (primitive === 'cone') return 'cône'
  if (primitive === 'dome') return 'dôme'
  if (primitive === 'flat-oval') return 'disque'
  return 'forme plate'
}

function nameToKind(name: string): PieceKind {
  const lower = name.toLowerCase()
  if (lower.includes('tête')) return 'tête'
  if (lower.includes('corps')) return 'corps'
  if (lower.includes('bras')) return 'bras'
  if (lower.includes('jambe') || lower.includes('patte')) return 'jambes'
  if (lower.includes('oreille')) return 'oreilles'
  if (lower.includes('museau')) return 'museau'
  if (lower.includes('queue')) return 'queue'
  if (lower.includes('corne')) return 'cornes'
  if (lower.includes('cheveu') || lower.includes('cheveux')) return 'cheveux'
  if (lower.includes('robe') || lower.includes('tunique') || lower.includes('gilet') || lower.includes('vêtement')) return 'vêtement'
  if (lower.includes('accessoire')) return 'accessoires'
  return 'pièce personnalisée'
}

function relativeToCm(relative: number, targetHeightCm: number, minimum = 0.8) {
  return Math.max(minimum, Number((relative * targetHeightCm).toFixed(1)))
}

const eyeSizesMm = [6, 8, 9, 10, 12, 15, 18, 20, 24]

/** Round index of a point seen at `vertical` (0 = top, 1 = bottom) on a ball worked from its top. */
function roundAt(vertical: number, roundCount: number, ball: boolean) {
  const fraction = ball ? Math.acos(1 - 2 * Math.min(1, Math.max(0, vertical))) / Math.PI : vertical
  return Math.min(roundCount, Math.max(1, Math.round(fraction * roundCount)))
}

function featureNotes(part: AmigurumiAnalysis['parts'][number], piece: AmigurumiPiece, rounds: CrochetRound[], gauge: Gauge) {
  const ball = ['sphère', 'ellipsoïde'].includes(piece.shape)
  const maxStitches = Math.max(...rounds.map(round => round.endStitches))
  const confidenceNote = part.confidence < 0.7 ? ' Position estimée : vérifier avec des épingles avant la fixation définitive.' : ''
  const notes: string[] = []
  const eyes = part.features.filter(feature => feature.type === 'eye')
  if (eyes.length) {
    const vertical = eyes.reduce((sum, eye) => sum + eye.relativeVerticalPosition, 0) / eyes.length
    const gap = eyes.length > 1
      ? Math.abs(eyes[0].relativeHorizontalPosition - eyes[1].relativeHorizontalPosition)
      : Math.abs(eyes[0].relativeHorizontalPosition - 0.5) * 2
    // Distance between eyes measured along the curved front of the piece.
    const apart = Math.max(2, Math.min(Math.round(maxStitches / 2), Math.round(gap * piece.dimensions.widthCm * 1.15 * gauge.stitchesPer10cm / 10)))
    const size = eyeSizesMm.reduce((best, mm) => Math.abs(mm - piece.dimensions.widthCm * 10 / 8) < Math.abs(best - piece.dimensions.widthCm * 10 / 8) ? mm : best)
    const round = roundAt(vertical, rounds.length, ball)
    notes.push(`Yeux (${size} mm environ) : entre les tours ${round} et ${round + 1}, avec ${apart} mailles entre les deux yeux.${confidenceNote}`)
  }
  for (const feature of part.features) {
    if (feature.type === 'eye') continue
    const round = roundAt(feature.relativeVerticalPosition, rounds.length, ball)
    if (feature.type === 'mouth') notes.push(`Bouche : broder vers le tour ${round}. ${feature.description}.${confidenceNote}`)
    else if (feature.type === 'nose') notes.push(`Nez : placer ou broder vers le tour ${round}. ${feature.description}.${confidenceNote}`)
    else if (feature.type === 'color-change' && !part.colorSections.length) notes.push(`Changement de couleur vers le tour ${round} : ${feature.description}.${confidenceNote}`)
    else if (feature.type !== 'color-change') notes.push(`${feature.description} (vers le tour ${round}).${confidenceNote}`)
  }
  return notes
}

export function analysisToPieces(analysis: AmigurumiAnalysis, gauge: Gauge = estimatedGauge) {
  const colorName = (colorId: string) => analysis.palette.find((item) => item.id === colorId)?.name ?? colorId
  return analysis.parts.map((part): AmigurumiPiece => {
    const parent = analysis.parts.find(item => item.id === part.attachment.parentPartId)
    const parentWidthCm = parent ? relativeToCm(parent.relativeWidth, analysis.subject.targetHeightCm) : 0
    // A flat piece sewn on a round volume (belly on the body) wraps around it: the photo only shows its chord.
    const visibleWidthCm = relativeToCm(part.relativeWidth, analysis.subject.targetHeightCm)
    const widthCm = part.primitive === 'flat-oval' && parentWidthCm > visibleWidthCm
      ? Number((parentWidthCm * Math.asin(visibleWidthCm / parentWidthCm)).toFixed(1))
      : visibleWidthCm
    const heightCm = relativeToCm(part.relativeHeight, analysis.subject.targetHeightCm)
    const depthCm = relativeToCm(part.relativeDepth, analysis.subject.targetHeightCm, 0.3)
    const kind = nameToKind(part.name)
    // Soft ears and horns are flattened tubes left open at the base, never balls closed at both ends.
    const softPart = ['oreilles', 'cornes'].includes(kind)
    const flatSoft = softPart && ['sphere', 'ellipsoid', 'cylinder', 'tapered-cylinder'].includes(part.primitive)
    const shape = flatSoft ? 'cylindre' : primitiveToShape(part.primitive)
    const tapered = part.primitive === 'tapered-cylinder' || flatSoft
    const endRatio = tapered ? (part.endWidthRatio < 1 ? part.endWidthRatio : flatSoft ? 0.75 : 0.7) : undefined
    const colorSections = part.colorSections.length > 1 || (part.colorSections[0] && part.colorSections[0].colorId !== part.colorId)
      ? part.colorSections.map(section => ({ color: colorName(section.colorId), from: section.fromStart }))
      : undefined
    const openShape = ['forme plate', 'disque', 'dôme'].includes(shape) || shape === 'cylindre'
    const notes = [
      part.attachment.description,
      part.confidence <= 0.5 ? 'Pièce non visible sur la photo, ajoutée pour compléter le patron : vérifier qu’elle correspond au modèle.' : part.confidence < 0.7 ? 'Forme ou position incertaine : vérifier avant couture.' : '',
      shape === 'forme plate' ? 'Approximation rectangulaire : adapter le contour à la photo.' : '',
      shape === 'dôme' ? 'Pièce ouverte : rembourrer légèrement au moment de la coudre.' : '',
      flatSoft ? 'Ne pas rembourrer : pincer la base en deux (pli) puis la coudre.' : '',
    ].filter(Boolean).join('\n')
    const piece: AmigurumiPiece = {
      id: part.id || id('piece'),
      name: part.name,
      kind,
      shape,
      dimensions: {
        widthCm,
        heightCm,
        // Long soft ears (rabbit, cat) are cupped like a spoon: much bigger around than their visible width.
        depthCm: flatSoft ? (heightCm > 1.3 * widthCm ? Math.max(depthCm, widthCm * 0.7) : Math.min(depthCm, widthCm / 4)) : depthCm,
        relativeSize: Math.round(part.relativeHeight * 100),
        copies: part.quantity,
        stuffingOpening: openShape ? 0 : 1,
        closed: ['sphère', 'ellipsoïde'].includes(shape),
      },
      initialStitches: shape === 'cône' ? 4 : 6,
      increaseSpeed: 1,
      elongation: 1,
      endRatio,
      color: colorName(part.colorId),
      colorSections,
      rounds: [],
      notes,
    }
    piece.dimensions.circumferenceCm = Number(pieceCircumference(piece).toFixed(1))
    const rounds = generatePieceRounds(piece, gauge)
    const last = rounds.at(-1)!
    if (softPart) for (const round of rounds) { if (round.stuffing && round.stuffing !== 'aucun') { round.instruction = round.instruction.replace(round.stuffing, 'ne pas rembourrer'); round.stuffing = 'aucun' } }
    if (!piece.dimensions.closed && !['disque', 'forme plate'].includes(shape)) {
      last.note = `${softPart ? 'Ne pas rembourrer.' : shape === 'dôme' ? 'Rembourrer légèrement en cousant.' : 'Rembourrer progressivement en gardant le bord accessible.'} Arrêter le fil et garder 30 cm pour la couture.`
    }
    const details = featureNotes(part, piece, rounds, gauge)
    return { ...piece, notes: [notes, ...details].filter(Boolean).join('\n'), rounds }
  })
}

/** Rough yarn length: one single crochet uses about six times its width of yarn, plus 15 % for tails and seams. */
export function yarnEstimate(pieces: AmigurumiPiece[], gauge: Gauge) {
  const perStitchCm = (10 / gauge.stitchesPer10cm) * 6
  const byColor = new Map<string, number>()
  for (const piece of pieces) {
    for (const round of piece.rounds) {
      const color = round.color ?? piece.color
      byColor.set(color, (byColor.get(color) ?? 0) + round.endStitches * piece.dimensions.copies)
    }
  }
  return [...byColor].map(([color, stitches]) => ({ color, meters: Math.max(5, Math.ceil(stitches * perStitchCm * 1.15 / 100 / 5) * 5) }))
}

export function analysisToPattern(params: {
  analysis: AmigurumiAnalysis
  imageDataUrl?: string
  gauge?: Gauge
  material?: Material
  gaugeProvided?: boolean
  source?: 'photo' | 'demo'
}) {
  const gauge = params.gauge ?? estimatedGauge
  const material = params.material ?? estimatedMaterial
  const pieces = analysisToPieces(params.analysis, gauge)
  const crocheted = new Set(pieces.flatMap(piece => [piece.color, ...piece.rounds.map(round => round.color ?? piece.color)]))
  const embroidery = params.analysis.palette.map(color => color.name).filter(name => !crocheted.has(name))
  const eyeSize = /Yeux \((\d+) mm/.exec(pieces.map(piece => piece.notes).join('\n'))?.[1]
  const now = new Date().toISOString()
  const references: ReferenceImage[] = params.imageDataUrl
    ? [
        {
          id: id('ref'),
          name: 'Photographie de référence',
          dataUrl: params.imageDataUrl,
          zoom: 1,
          crop: { x: 0, y: 0, width: 100, height: 100 },
          maskBackground: false,
          markers: [],
        },
      ]
    : []
  const palette: YarnColor[] = params.analysis.palette.map((color) => ({
    id: color.id,
    name: color.name,
    hex: color.hex,
    pieces: color.usage,
  }))
  const assembly: AssemblyStep[] = [
    'Avant de fermer la tête : préparer les détails du visage. Si des yeux à fixation arrière sont utilisés, les fixer maintenant ; pour un bébé, préférer des yeux brodés.',
    'Épingler les pièces ensemble et vérifier les proportions et la symétrie avant les coutures définitives.',
    // Each piece already carries its seam position: the assembly only gives the order.
    ...params.analysis.assemblyOrder.map(step => step.trim().replace(/\.*$/, '.')),
    'Serrer les coutures, rentrer les fils et vérifier chaque fixation avant utilisation.',
  ].map(text => ({ id: id('asm'), text }))

  return {
    id: id('pattern'),
    name: `Patron automatique - ${params.analysis.subject.description.slice(0, 40)}`,
    kind: 'amigurumi',
    createdAt: now,
    updatedAt: now,
    dimensions: { hauteurFinale: params.analysis.subject.targetHeightCm },
    material: { ...material, mainColor: params.analysis.palette[0]?.name ?? material.mainColor, secondaryColors: params.analysis.palette.slice(1).map(color => color.name) },
    gauge,
    stitch: 'maille serrée',
    rows: pieces.flatMap((piece) =>
      piece.rounds.map((round) => ({
        id: `${piece.id}-${round.id}`,
        index: round.round,
        label: `${piece.name} - Tour ${round.round}`,
        instruction: round.instruction,
        totalStitches: round.endStitches,
        color: round.color,
        note: [piece.notes, round.note].filter(Boolean).join('\n'),
        warning: round.warning,
      })),
    ),
    pieces,
    palette,
    assembly,
    references,
    finalHeightCm: params.analysis.subject.targetHeightCm,
    guidedProgress: { pieceId: pieces[0]?.id ?? '', roundIndex: 0 },
    notes: params.source === 'demo' ? 'DÉMONSTRATION : cet exemple fixe ne provient pas de votre photographie.' : 'Ce patron a été estimé automatiquement depuis une photographie. Les coutures et les détails cachés restent à vérifier. La similarité visuelle ne garantit pas les mêmes mailles que le patron original.',
    generation: {
      source: params.source ?? 'photo',
      gaugeProvided: params.gaugeProvided ?? false,
      supplies: [
        `${material.yarnName}, crochet ${material.hookSize}`,
        ...yarnEstimate(pieces, gauge).map(item => `${item.color} : environ ${item.meters} m`),
        ...(embroidery.length ? [`${embroidery.join(', ')} : un peu de fil pour les broderies`] : []),
        ...(eyeSize ? [`2 yeux de sécurité de ${eyeSize} mm (ou du fil noir pour les broder)`] : []),
        'Rembourrage', 'Marqueur de début de tour', 'Aiguille à laine, ciseaux et épingles', 'Fil pour broder les détails du visage',
      ],
      preparation: ['ms = maille serrée ; aug = 2 ms dans une même maille ; dim = 2 mailles crochetées ensemble ; × = nombre de répétitions.', 'Travailler en spirale sauf indication contraire. Marquer la première maille et compter à la fin de chaque tour.', `Échantillon ${params.gaugeProvided ? 'renseigné' : 'estimé'} : ${gauge.stitchesPer10cm} ms et ${gauge.rowsPer10cm} tours pour 10 cm. Mesurer un échantillon avant de commencer.`, 'Les dimensions sont des objectifs estimés ; la tension et le rembourrage modifient le résultat.'],
      finishing: ['Rembourrer progressivement les volumes, sans déformer les mailles.', 'Pour les pièces en plusieurs exemplaires, répéter tous les tours pour chaque exemplaire.', 'Laisser un fil de couture sur les pièces à assembler. Positionner avec des épingles puis coudre solidement.'],
      uncertainties: [...params.analysis.uncertainties.map(item => item.message), ...(!params.gaugeProvided ? ['Échantillon non mesuré : taille et nombres de mailles à ajuster à votre fil.'] : [])],
    },
    progressRow: 0,
    analysis: params.analysis,
  } satisfies CrochetPattern & { analysis: AmigurumiAnalysis }
}

export function demoCreatureAnalysis(targetHeightCm = 18): AmigurumiAnalysis {
  return AmigurumiAnalysisSchema.parse({
    subject: {
      description: 'petite créature verte avec grosse tête ronde, tunique claire et vêtement brun',
      category: 'creature',
      targetHeightCm,
      complexity: 'medium',
    },
    palette: [
      { id: 'green', name: 'Vert du personnage', hex: '#79a85d', usage: ['tête', 'bras', 'oreilles'] },
      { id: 'cream', name: 'Tunique claire', hex: '#efe3c3', usage: ['corps'] },
      { id: 'brown', name: 'Vêtement brun', hex: '#7a5238', usage: ['gilet', 'jambes'] },
      { id: 'black', name: 'Détails noirs', hex: '#222222', usage: ['yeux', 'bouche'] },
    ],
    parts: [
      {
        id: 'head',
        name: 'Tête ronde',
        quantity: 1,
        primitive: 'sphere',
        relativeWidth: 0.42,
        relativeHeight: 0.36,
        relativeDepth: 0.4,
        colorId: 'green',
        symmetryGroup: null,
        attachment: { parentPartId: 'body', position: 'top', description: 'coudre la tête au sommet du corps' },
        features: [
          { type: 'eye', description: 'deux yeux de sécurité', relativeVerticalPosition: 0.45, relativeHorizontalPosition: 0.38 },
          { type: 'mouth', description: 'bouche brodée simple', relativeVerticalPosition: 0.58, relativeHorizontalPosition: 0.5 },
        ],
        confidence: 0.86,
      },
      {
        id: 'body',
        name: 'Corps avec tunique',
        quantity: 1,
        primitive: 'tapered-cylinder',
        relativeWidth: 0.3,
        relativeHeight: 0.38,
        relativeDepth: 0.25,
        colorId: 'cream',
        symmetryGroup: null,
        attachment: { parentPartId: null, position: 'custom', description: 'pièce centrale' },
        features: [{ type: 'color-change', description: 'ajouter le vêtement brun sur le devant', relativeVerticalPosition: 0.35, relativeHorizontalPosition: 0.5 }],
        confidence: 0.82,
      },
      {
        id: 'arm',
        name: 'Bras',
        quantity: 2,
        primitive: 'tapered-cylinder',
        relativeWidth: 0.1,
        relativeHeight: 0.3,
        relativeDepth: 0.1,
        colorId: 'green',
        symmetryGroup: 'arms',
        attachment: { parentPartId: 'body', position: 'left', description: 'coudre un bras de chaque côté du corps' },
        features: [],
        confidence: 0.78,
      },
      {
        id: 'leg',
        name: 'Jambes',
        quantity: 2,
        primitive: 'cylinder',
        relativeWidth: 0.13,
        relativeHeight: 0.2,
        relativeDepth: 0.12,
        colorId: 'brown',
        symmetryGroup: 'legs',
        attachment: { parentPartId: 'body', position: 'bottom', description: 'coudre les jambes sous le corps' },
        features: [],
        confidence: 0.76,
      },
      {
        id: 'ear',
        name: 'Oreilles latérales',
        quantity: 2,
        primitive: 'cone',
        relativeWidth: 0.11,
        relativeHeight: 0.15,
        relativeDepth: 0.08,
        colorId: 'green',
        symmetryGroup: 'ears',
        attachment: { parentPartId: 'head', position: 'left', description: 'coudre une oreille de chaque côté de la tête' },
        features: [],
        confidence: 0.84,
      },
      {
        id: 'vest',
        name: 'Gilet brun',
        quantity: 1,
        primitive: 'flat-piece',
        relativeWidth: 0.32,
        relativeHeight: 0.28,
        relativeDepth: 0.02,
        colorId: 'brown',
        symmetryGroup: null,
        attachment: { parentPartId: 'body', position: 'front', description: 'coudre ou broder le gilet sur la tunique' },
        features: [],
        confidence: 0.72,
      },
    ],
    clothes: [
      { name: 'Tunique claire', type: 'shirt', colorIds: ['cream'], attachedToPartIds: ['body'], description: 'base claire autour du corps' },
      { name: 'Gilet brun', type: 'vest', colorIds: ['brown'], attachedToPartIds: ['body'], description: 'vêtement brun sur le devant' },
    ],
    assemblyOrder: [
      'Rembourrer et fermer la tête.',
      'Rembourrer le corps.',
      'Coudre la tête au corps.',
      'Coudre les jambes sous le corps.',
      'Coudre les bras de chaque côté du corps.',
      'Coudre les oreilles de chaque côté de la tête.',
      'Placer les yeux de sécurité et broder la bouche.',
      'Installer ou broder la tunique et le vêtement brun.',
    ],
    uncertainties: [
      {
        field: 'palette.green',
        message: "L'arrière-plan contient du vert ; la palette doit ignorer l'herbe et considérer le personnage au centre.",
        confidence: 0.65,
      },
    ],
  })
}

/**
 * Vision models misjudge proportions read from a photo, mostly widths, and not consistently from one run to the next.
 * Bounding boxes are far more reliable: single pieces take their measured size, and the median ratio between boxes
 * and estimates of compact pieces (head, muzzle…) rescales the others, widths and lengths separately.
 * Boxes of repeated pieces are ignored since they often span every copy.
 */
export function calibrateProportions(analysis: AmigurumiAnalysis, imageSizes: { width: number; height: number }[]): AmigurumiAnalysis {
  // Sizes are read on each photo relative to the subject's height on that same photo (same pose on every view).
  const photo = (index: number) => {
    const size = imageSizes[index]
    const subject = analysis.subject.imageBoxes[index]
    const subjectHeightPx = size && subject ? ((subject[2] - subject[0]) / 1000) * size.height : 0
    return subjectHeightPx > 0 ? { ...size, subjectHeightPx } : undefined
  }
  if (!photo(0)) return analysis
  const measured = (part: AmigurumiAnalysis['parts'][number]) => {
    const box = part.imageBox
    const view = photo(part.photoIndex)
    if (!box || !view || part.primitive === 'flat-piece') return undefined
    const boxWidth = (((box[3] - box[1]) / 1000) * view.width) / view.subjectHeightPx
    const boxHeight = (((box[2] - box[0]) / 1000) * view.height) / view.subjectHeightPx
    // On a side or back view, a limb may lie horizontally (legs of a seated toy): its length is the longer side.
    const lying = part.photoIndex > 0 && !['sphere', 'ellipsoid', 'dome', 'flat-oval'].includes(part.primitive) && boxWidth > boxHeight
    const width = lying ? boxHeight : boxWidth
    const height = lying ? boxWidth : boxHeight
    // The box of repeated pieces often spans every copy side by side: its height stays right, its width does not.
    return width > 0 && height > 0 ? { width: part.quantity > 1 ? undefined : width, height } : undefined
  }
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  const references = analysis.parts.filter(part => part.confidence >= 0.7 && ['sphere', 'ellipsoid', 'dome', 'flat-oval'].includes(part.primitive) && measured(part)?.width && part.relativeWidth > 0 && part.relativeHeight > 0)
  if (!references.length) return analysis
  const widthScale = Math.min(2, Math.max(0.7, median(references.map(part => measured(part)!.width! / part.relativeWidth))))
  const heightScale = Math.min(1.6, Math.max(0.7, median(references.map(part => measured(part)!.height / part.relativeHeight))))
  const fit = (value: number) => Math.min(1, Number(value.toFixed(3)))
  return {
    ...analysis,
    parts: analysis.parts.map(part => {
      const box = measured(part)
      // A box only shows the visible part of a piece: never shrink below the rescaled estimate.
      // A measurement wins when it roughly agrees with the rescaled estimate; a box far off is a detection mistake.
      // Compact pieces are fully visible; other boxes may miss a hidden part (body behind the arms) and only enlarge.
      // Lengths of elongated pieces are usually well estimated: the height scale only applies to compact ones.
      const compact = ['sphere', 'ellipsoid', 'dome', 'flat-oval'].includes(part.primitive)
      const agree = (value: number | undefined, estimate: number) => value !== undefined && value > estimate * 0.65 && value < estimate * 1.35
      const widthEstimate = part.relativeWidth * widthScale
      const heightEstimate = part.relativeHeight * (compact ? heightScale : 1)
      const width = agree(box?.width, widthEstimate) ? (compact ? box!.width! : Math.max(box!.width!, widthEstimate)) : widthEstimate
      const height = agree(box?.height, heightEstimate) ? box!.height : heightEstimate
      const depth = part.relativeWidth > 0 ? part.relativeDepth * (width / part.relativeWidth) : part.relativeDepth * widthScale
      return { ...part, relativeWidth: fit(width), relativeHeight: fit(height), relativeDepth: fit(depth) }
    }),
  }
}

/**
 * Several analyses of the same photo differ by ±15 % on each measurement. Their median is much steadier: the analysis
 * with the typical number of pieces gives the structure, matching pieces from the others give the median sizes.
 */
export function mergeAnalyses(analyses: AmigurumiAnalysis[]): AmigurumiAnalysis {
  if (analyses.length < 2) return analyses[0]
  const byCount = [...analyses].sort((a, b) => a.parts.length - b.parts.length)
  const base = byCount[Math.floor((byCount.length - 1) / 2)]
  const others = analyses.filter(analysis => analysis !== base)
  type Part = AmigurumiAnalysis['parts'][number]
  const key = (part: Part) => { const kind = nameToKind(part.name); return kind === 'pièce personnalisée' ? `${kind}:${part.primitive}` : kind }
  const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const middle = sorted.length / 2; return sorted.length % 2 ? sorted[Math.floor(middle)] : (sorted[middle - 1] + sorted[middle]) / 2 }
  const unused = others.map(analysis => [...analysis.parts])
  const take = (pool: Part[], part: Part) => { const index = pool.findIndex(item => key(item) === key(part)); return index < 0 ? undefined : pool.splice(index, 1)[0] }
  const combine = (part: Part, matches: Part[]): Part => {
    const all = [part, ...matches]
    return { ...part, relativeWidth: median(all.map(item => item.relativeWidth)), relativeHeight: median(all.map(item => item.relativeHeight)), relativeDepth: median(all.map(item => item.relativeDepth)), endWidthRatio: median(all.map(item => item.endWidthRatio)) }
  }
  const parts = base.parts.map(part => combine(part, unused.flatMap(pool => take(pool, part) ?? [])))
  // A piece most analyses found but the base missed (often a hidden tail) is added back.
  for (const pool of unused) {
    for (const part of [...pool]) {
      const matches = unused.filter(other => other !== pool).flatMap(other => take(other, part) ?? [])
      if (matches.length + 1 > analyses.length / 2 && !parts.some(item => item.id === part.id) && base.palette.some(color => color.id === part.colorId)) parts.push(combine({ ...part, colorSections: part.colorSections.filter(section => base.palette.some(color => color.id === section.colorId)), attachment: { ...part.attachment, parentPartId: parts.some(item => item.id === part.attachment.parentPartId) ? part.attachment.parentPartId : null } }, matches))
      pool.splice(pool.indexOf(part), 1)
    }
  }
  return { ...base, parts }
}
