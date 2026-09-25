import {
  buildManualRows,
  calculateBasketRounds,
  calculateHatRounds,
  calculateRectangle,
  generateConeRounds,
  generateFlatPieceRows,
  generateSphereRounds,
  generateTubeRounds,
  generateRectangleRows,
  gridRowsToInstructions,
  validateRound,
  applyColorSections,
  ellipsePerimeter,
  generateOvalPatchRounds,
  groupRounds,
  sphereStraightRounds,
} from './calculations'
import type { ImageGrid } from '../types'

describe('calculateRectangle', () => {
  it('calcule les mailles et les rangs avec la formule demandée', () => {
    expect(calculateRectangle(20, 60, { stitchesPer10cm: 18, rowsPer10cm: 22 })).toEqual({
      stitchCount: 36,
      rowCount: 132,
    })
  })

  it('refuse les valeurs invalides', () => {
    expect(() => calculateRectangle(0, 60, { stitchesPer10cm: 18, rowsPer10cm: 22 })).toThrow('largeur')
  })
})

describe('generateRectangleRows', () => {
  it('génère le montage et les rangs avec les rayures', () => {
    const rows = generateRectangleRows(10, 10, { stitchesPer10cm: 10, rowsPer10cm: 10 }, 'maille serrée', ['rouge', 'bleu'])
    expect(rows).toHaveLength(11)
    expect(rows[0].instruction).toBe("Monter 10 mailles en l'air.")
    expect(rows[1].color).toBe('rouge')
    expect(rows[2].color).toBe('bleu')
    expect(rows[10].totalStitches).toBe(10)
  })
})

describe('calculateBasketRounds', () => {
  it('augmente régulièrement puis conserve le total pour les côtés', () => {
    const rows = calculateBasketRounds(6, 5, { stitchesPer10cm: 10, rowsPer10cm: 4 }, 6, 'maille serrée')
    expect(rows[0].totalStitches).toBe(6)
    expect(rows[1].totalStitches).toBe(12)
    expect(rows[2].totalStitches).toBe(18)
    expect(rows.at(-1)?.totalStitches).toBe(rows.find((row) => row.id.startsWith('basket-side'))?.totalStitches)
  })
})

describe('calculateHatRounds', () => {
  it('crée un bonnet en rond au total constant', () => {
    const rows = calculateHatRounds(50, 20, { stitchesPer10cm: 12, rowsPer10cm: 5 }, 'demi-bride')
    expect(rows).toHaveLength(10)
    expect(rows.every((row) => row.totalStitches === 60)).toBe(true)
  })
})

describe('buildManualRows', () => {
  it('calcule augmentations, diminutions et incohérences', () => {
    const rows = buildManualRows([
      { stitch: 'maille serrée', stitches: 20, increases: 2, decreases: 0, color: 'écru' },
      { stitch: 'maille serrée', stitches: 20, increases: 0, decreases: 1, color: 'écru' },
    ])
    expect(rows[0].totalStitches).toBe(22)
    expect(rows[1].totalStitches).toBe(19)
    expect(rows[1].warning).toContain('différent')
  })
})

describe('gridRowsToInstructions', () => {
  it('regroupe les couleurs et alterne le sens de lecture', () => {
    const grid: ImageGrid = {
      width: 4,
      height: 2,
      colors: ['A', 'B'],
      cells: [
        ['A', 'A', 'B', 'A'],
        ['A', 'B', 'B', 'A'],
      ],
    }
    const rows = gridRowsToInstructions(grid)
    expect(rows[0].instruction).toContain('2 mailles couleur A, 1 mailles couleur B, 1 mailles couleur A')
    expect(rows[1].instruction).toContain('gauche vers droite')
  })
})

describe('validateRound', () => {
  it('valide le total après augmentations et diminutions', () => {
    const round = validateRound({
      id: 'r',
      round: 4,
      startStitches: 24,
      plainStitches: 12,
      increases: 6,
      decreases: 3,
      endStitches: 27,
    })
    expect(round.warning).toBe('')
    expect(round.endStitches).toBe(27)
  })

  it('détecte les opérations incohérentes', () => {
    const round = validateRound({
      id: 'bad',
      round: 2,
      startStitches: 12,
      plainStitches: 12,
      increases: 6,
      decreases: 0,
      endStitches: 12,
    })
    expect(round.warning).toContain('consomment')
    expect(round.warning).toContain('devrait être 18')
  })

  it('détecte les valeurs négatives ou nulles invalides', () => {
    const round = validateRound({
      id: 'negative',
      round: 2,
      startStitches: 6,
      plainStitches: -1,
      increases: 0,
      decreases: 0,
      endStitches: 0,
    })
    expect(round.warning).toContain('négative')
    expect(round.warning).toContain('supérieur à zéro')
  })

  it('détecte une diminution qui consomme trop de mailles', () => {
    const round = validateRound({
      id: 'too-many-decreases',
      round: 3,
      startStitches: 6,
      plainStitches: 0,
      increases: 0,
      decreases: 4,
      endStitches: 2,
    })
    expect(round.warning).toContain('trop de diminutions')
  })
})

describe('generateSphereRounds', () => {
  it('génère augmentations, tours droits et diminutions symétriques', () => {
    const rounds = generateSphereRounds({
      pieceId: 'head',
      circumferenceCm: 12,
      gauge: { stitchesPer10cm: 20, rowsPer10cm: 20 },
      initialStitches: 6,
      straightRounds: 2,
    })
    const increases = rounds.filter((round) => round.increases > 0).map((round) => round.increases)
    const decreases = rounds.filter((round) => round.decreases > 0).map((round) => round.decreases)
    expect(increases).toEqual([...decreases].reverse())
    expect(rounds.every((round) => !round.warning)).toBe(true)
  })
})

describe('generateTubeRounds', () => {
  it('crée un fond puis des tours droits', () => {
    const rounds = generateTubeRounds({
      pieceId: 'body',
      circumferenceCm: 10,
      heightCm: 5,
      gauge: { stitchesPer10cm: 20, rowsPer10cm: 10 },
      initialStitches: 6,
    })
    expect(rounds.at(-1)?.endStitches).toBeGreaterThan(6)
    expect(rounds.every((round) => !round.warning)).toBe(true)
  })
})

describe('generateConeRounds', () => {
  it('augmente progressivement sans incohérence', () => {
    const rounds = generateConeRounds({
      pieceId: 'ear',
      circumferenceCm: 6,
      heightCm: 4,
      gauge: { stitchesPer10cm: 20, rowsPer10cm: 10 },
      initialStitches: 4,
    })
    expect(rounds[0].endStitches).toBe(4)
    expect(rounds.at(-1)?.endStitches).toBe(12)
    expect(rounds.every((round) => !round.warning)).toBe(true)
  })
})

describe('generateFlatPieceRows', () => {
  it('génère des rangs aller-retour constants', () => {
    const rows = generateFlatPieceRows({
      pieceId: 'vest',
      widthCm: 5,
      heightCm: 4,
      gauge: { stitchesPer10cm: 20, rowsPer10cm: 10 },
    })
    expect(rows).toHaveLength(4)
    expect(rows.every((row) => row.endStitches === 10)).toBe(true)
  })
})

describe('formes amigurumi réalistes', () => {
  const gauge = { stitchesPer10cm: 18, rowsPer10cm: 20 }

  it('donne à une boule autant de tours droits que de tours d’augmentation', () => {
    expect(sphereStraightRounds(36, 6, 6, gauge)).toBe(6)
    expect(sphereStraightRounds(60, 10, 5, gauge)).toBe(5)
    expect(sphereStraightRounds(36, 6, 9, gauge)).toBe(12)
  })

  it('calcule le tour d’une pièce aplatie plutôt que π × largeur', () => {
    expect(ellipsePerimeter(4, 4)).toBeCloseTo(Math.PI * 4)
    expect(ellipsePerimeter(6, 0.5)).toBeLessThan(13)
  })

  it('affine un membre régulièrement jusqu’au rapport demandé', () => {
    const rounds = generateTubeRounds({ pieceId: 'arm', circumferenceCm: 13, heightCm: 12, gauge, endRatio: 0.7 })
    expect(Math.max(...rounds.map(round => round.endStitches))).toBe(23)
    expect(rounds.at(-1)?.endStitches).toBe(16)
    expect(rounds.every(round => round.decreases <= 1 && !round.warning)).toBe(true)
  })

  it('diminue par 6 les pièces larges', () => {
    const rounds = generateTubeRounds({ pieceId: 'body', circumferenceCm: 33.3, heightCm: 15, gauge, endRatio: 0.6 })
    expect(rounds.at(-1)?.endStitches).toBe(36)
    expect(rounds.filter(round => round.decreases).every(round => round.decreases === 6)).toBe(true)
  })

  it('laisse un dôme ouvert sans diminutions', () => {
    const rounds = generateSphereRounds({ pieceId: 'muzzle', circumferenceCm: 13, gauge, straightRounds: 2, open: true })
    expect(rounds.some(round => round.decreases)).toBe(false)
    expect(rounds.at(-1)?.endStitches).toBe(rounds.at(-2)?.endStitches)
  })

  it('crochète un ovale plat en rond autour d’une chaînette', () => {
    const rounds = generateOvalPatchRounds({ pieceId: 'belly', widthCm: 7, heightCm: 10.3, gauge })
    expect(rounds.map(round => round.endStitches)).toEqual([14, 20, 26, 32, 38, 44, 50])
    expect(rounds[0].instruction).toContain('Monter 7 mailles en l’air')
    expect(rounds.every(round => !round.warning)).toBe(true)
  })

  it('change de couleur au bon tour', () => {
    const rounds = applyColorSections(generateTubeRounds({ pieceId: 'leg', circumferenceCm: 13, heightCm: 10, gauge }), [{ color: 'Crème', from: 0 }, { color: 'Beige', from: 0.25 }], 'Beige')
    expect(rounds[0].instruction).toMatch(/^En Crème/)
    const change = rounds.findIndex(round => round.colorChange)
    expect(rounds[change].colorChange).toBe('Beige')
    expect(change / rounds.length).toBeGreaterThanOrEqual(0.25)
    expect(rounds.filter(round => round.colorChange)).toHaveLength(1)
  })

  it('regroupe les tours identiques', () => {
    const groups = groupRounds(generateSphereRounds({ pieceId: 'head', circumferenceCm: 33.3, gauge, straightRounds: 8 }))
    expect(groups.some(group => group.label === 'Tours 11 à 18')).toBe(true)
  })
})
