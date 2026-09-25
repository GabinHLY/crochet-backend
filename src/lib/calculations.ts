import type { AmigurumiPiece, CrochetRound, Gauge, ImageGrid, ManualRowInput, PatternRow, Stitch } from '../types'

const stitchPlural = (stitch: Stitch, count: number) => {
  if (stitch === 'maille serrée') return count > 1 ? 'mailles serrées' : 'maille serrée'
  if (stitch === 'demi-bride') return count > 1 ? 'demi-brides' : 'demi-bride'
  return count > 1 ? 'brides' : 'bride'
}

export function assertPositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} doit être un nombre positif.`)
  }
}

export function calculateRectangle(widthCm: number, heightCm: number, gauge: Gauge) {
  assertPositiveNumber(widthCm, 'La largeur')
  assertPositiveNumber(heightCm, 'La hauteur')
  assertPositiveNumber(gauge.stitchesPer10cm, "Le nombre de mailles de l'échantillon")
  assertPositiveNumber(gauge.rowsPer10cm, "Le nombre de rangs de l'échantillon")

  return {
    stitchCount: Math.round((widthCm * gauge.stitchesPer10cm) / 10),
    rowCount: Math.round((heightCm * gauge.rowsPer10cm) / 10),
  }
}

export function generateRectangleRows(
  widthCm: number,
  heightCm: number,
  gauge: Gauge,
  stitch: Stitch,
  stripes: string[],
) {
  const { stitchCount, rowCount } = calculateRectangle(widthCm, heightCm, gauge)
  const colors = stripes.filter(Boolean)
  const rows: PatternRow[] = [
    {
      id: 'chain',
      index: 0,
      label: 'Montage',
      instruction: `Monter ${stitchCount} mailles en l'air.`,
      totalStitches: stitchCount,
    },
  ]

  for (let i = 1; i <= rowCount; i += 1) {
    const color = colors.length ? colors[(i - 1) % colors.length] : undefined
    rows.push({
      id: `row-${i}`,
      index: i,
      label: `Rang ${i}`,
      instruction: `Crocheter ${stitchCount} ${stitchPlural(stitch, stitchCount)}${color ? ` couleur ${color}` : ''}.`,
      totalStitches: stitchCount,
      color,
    })
  }

  return rows
}

export function calculateBasketRounds(
  diameterCm: number,
  heightCm: number,
  gauge: Gauge,
  initialStitches: number,
  stitch: Stitch,
) {
  assertPositiveNumber(diameterCm, 'Le diamètre')
  assertPositiveNumber(heightCm, 'La hauteur')
  assertPositiveNumber(initialStitches, 'Le nombre initial de mailles')
  assertPositiveNumber(gauge.stitchesPer10cm, "Le nombre de mailles de l'échantillon")
  assertPositiveNumber(gauge.rowsPer10cm, "Le nombre de rangs de l'échantillon")

  const targetCircumference = Math.PI * diameterCm
  const targetStitches = Math.max(initialStitches, Math.round((targetCircumference * gauge.stitchesPer10cm) / 10))
  const increaseRounds = Math.max(1, Math.ceil(targetStitches / initialStitches) - 1)
  const sideRounds = Math.max(1, Math.round((heightCm * gauge.rowsPer10cm) / 10))
  const rows: PatternRow[] = []

  for (let round = 1; round <= increaseRounds; round += 1) {
    const total = initialStitches * round
    const plainBeforeIncrease = round - 2
    const instruction =
      round === 1
        ? `${initialStitches} ${stitchPlural(stitch, initialStitches)} dans un anneau magique.`
        : round === 2
          ? `2 ${stitchPlural(stitch, 2)} dans chaque maille.`
          : `${plainBeforeIncrease + 1} ${stitchPlural(stitch, plainBeforeIncrease + 1)}, 1 augmentation. Répéter ${initialStitches} fois.`
    rows.push({
      id: `basket-increase-${round}`,
      index: round,
      label: `Tour ${round}`,
      instruction: `${instruction} Total : ${total}.`,
      totalStitches: total,
    })
  }

  const baseTotal = rows.at(-1)?.totalStitches ?? initialStitches
  for (let i = 1; i <= sideRounds; i += 1) {
    const index = increaseRounds + i
    rows.push({
      id: `basket-side-${i}`,
      index,
      label: `Tour ${index}`,
      instruction: `Crocheter ${baseTotal} ${stitchPlural(stitch, baseTotal)} sans augmentation. Total : ${baseTotal}.`,
      totalStitches: baseTotal,
    })
  }

  return rows
}

export function calculateHatRounds(headCircumferenceCm: number, heightCm: number, gauge: Gauge, stitch: Stitch) {
  const targetStitches = Math.round((headCircumferenceCm * gauge.stitchesPer10cm) / 10)
  const rounds = Math.round((heightCm * gauge.rowsPer10cm) / 10)
  assertPositiveNumber(targetStitches, 'Le tour de tête calculé')
  assertPositiveNumber(rounds, 'La hauteur calculée')

  return Array.from({ length: rounds }, (_, position) => {
    const index = position + 1
    return {
      id: `hat-${index}`,
      index,
      label: `Tour ${index}`,
      instruction:
        index === 1
          ? `Monter une chaînette souple puis fermer en rond. Crocheter ${targetStitches} ${stitchPlural(stitch, targetStitches)}. Total : ${targetStitches}.`
          : `Crocheter ${targetStitches} ${stitchPlural(stitch, targetStitches)}. Total : ${targetStitches}.`,
      totalStitches: targetStitches,
    }
  })
}

export function buildManualRows(inputs: ManualRowInput[]) {
  let previousTotal = 0
  return inputs.map((input, position) => {
    const index = position + 1
    const total = input.stitches + input.increases - input.decreases
    const warning =
      position > 0 && total !== previousTotal
        ? `Le total (${total}) est différent du rang précédent (${previousTotal}).`
        : undefined
    previousTotal = total
    return {
      id: `manual-${index}`,
      index,
      label: `Rang ${index}`,
      instruction: `${input.stitches} ${stitchPlural(input.stitch, input.stitches)}, ${input.increases} augmentation(s), ${input.decreases} diminution(s).`,
      totalStitches: total,
      color: input.color,
      note: input.note,
      warning,
    }
  })
}

export function gridRowsToInstructions(grid: ImageGrid) {
  return grid.cells.map((row, position) => {
    const index = position + 1
    const readRow = index % 2 === 0 ? [...row].reverse() : row
    const parts: string[] = []
    let current = readRow[0]
    let count = 0

    readRow.forEach((color) => {
      if (color === current) {
        count += 1
        return
      }
      parts.push(`${count} mailles couleur ${current}`)
      current = color
      count = 1
    })
    if (current) parts.push(`${count} mailles couleur ${current}`)

    return {
      id: `image-${index}`,
      index,
      label: `Rang ${index}`,
      instruction: `${parts.join(', ')}. Sens : ${index % 2 === 0 ? 'gauche vers droite' : 'droite vers gauche'}. Total : ${grid.width} mailles.`,
      totalStitches: grid.width,
    }
  })
}

function ms(count: number) {
  return count > 1 ? 'mailles serrées' : 'maille serrée'
}

export function validateRound(round: Omit<CrochetRound, 'warning' | 'instruction'> & { instruction?: string }): CrochetRound {
  const consumed = round.plainStitches + round.increases + round.decreases * 2
  const expectedEnd = round.startStitches + round.increases - round.decreases
  const warnings: string[] = []
  const values = [round.plainStitches, round.increases, round.decreases, round.endStitches]

  if (round.round <= 0 || !Number.isFinite(round.round)) warnings.push('Le numéro du tour est invalide.')
  if (round.startStitches < 0 || !Number.isFinite(round.startStitches)) warnings.push('Le nombre de mailles au début est invalide.')
  if (values.some((value) => value < 0 || !Number.isInteger(value))) warnings.push('Aucune valeur négative ou fractionnaire : les nombres de mailles doivent être des entiers positifs ou nuls.')
  if (round.round > 1 && round.startStitches <= 0) warnings.push('Le tour précédent doit contenir au moins une maille.')
  if (round.endStitches <= 0) warnings.push('Le total final doit être supérieur à zéro.')

  if (round.round > 1 && consumed !== round.startStitches) {
    warnings.push(`Les opérations consomment ${consumed} mailles au lieu de ${round.startStitches}.`)
  }
  if (round.startStitches > 0 && round.endStitches !== expectedEnd) {
    warnings.push(`Le total devrait être ${expectedEnd}, pas ${round.endStitches}.`)
  }
  if (round.decreases * 2 > round.startStitches) {
    warnings.push('Il y a trop de diminutions pour le nombre de mailles disponibles.')
  }

  return {
    ...round,
    instruction: round.instruction ?? describeRound(round),
    warning: warnings.join(' '),
  }
}

export function describeRound(round: Pick<CrochetRound, 'round' | 'plainStitches' | 'increases' | 'decreases' | 'endStitches' | 'colorChange' | 'note' | 'stuffing' | 'closePiece'>) {
  const parts: string[] = []
  if (round.colorChange) parts.push(`changer pour la couleur ${round.colorChange}`)
  if (round.plainStitches > 0 && round.increases === 0 && round.decreases === 0) {
    parts.push(`${round.plainStitches} ${ms(round.plainStitches)}`)
  } else {
    const operations = round.increases || round.decreases
    const operation = round.increases ? 'aug' : 'dim'
    if (operations > 0 && !(round.increases && round.decreases)) {
      const plain = Math.floor(round.plainStitches / operations)
      const remainder = round.plainStitches % operations
      const group = (count: number) => count ? `${count} ms, 1 ${operation}` : `1 ${operation}`
      if (operations === 1) parts.push(group(plain))
      else if (remainder === 0) parts.push(`(${group(plain)}) × ${operations}`)
      else {
        parts.push(`(${group(plain + 1)}) × ${remainder}, puis (${group(plain)}) × ${operations - remainder}`)
      }
    } else {
      if (round.plainStitches) parts.push(`${round.plainStitches} ms`)
      if (round.increases) parts.push(`${round.increases} aug`)
      if (round.decreases) parts.push(`${round.decreases} dim`)
    }
  }
  if (round.stuffing && round.stuffing !== 'aucun') parts.push(round.stuffing)
  if (round.closePiece) parts.push('couper le fil en gardant 20 cm, passer dans les brins avant des mailles restantes, serrer pour fermer et rentrer le fil')
  if (round.note) parts.push(round.note)
  return `${parts.join(', ')}. Total : ${round.endStitches}.`
}

function makeRound(params: {
  id: string
  round: number
  startStitches: number
  plainStitches: number
  increases?: number
  decreases?: number
  color?: string
  colorChange?: string
  note?: string
  stuffing?: CrochetRound['stuffing']
  closePiece?: boolean
}) {
  const increases = params.increases ?? 0
  const decreases = params.decreases ?? 0
  return validateRound({
    ...params,
    increases,
    decreases,
    endStitches: params.startStitches + increases - decreases,
  })
}

function targetStitchesFromCircumference(circumferenceCm: number, gauge: Gauge) {
  assertPositiveNumber(circumferenceCm, 'La circonférence')
  return Math.max(6, Math.round((circumferenceCm * gauge.stitchesPer10cm) / 10))
}

/** Perimeter of an ellipse of the given diameters (Ramanujan). A flattened piece is much smaller around than π × its width. */
export function ellipsePerimeter(widthCm: number, depthCm: number) {
  const a = Math.max(widthCm, depthCm) / 2
  const b = Math.min(widthCm, depthCm) / 2
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
}

/**
 * Plain rounds between increases and decreases of a ball. A round ball of 6n stitches needs about n + 1 plain rounds
 * (e.g. 36 stitches: 6 increase rounds, 6 plain, 5 decrease rounds). Taller pieces add rounds, flatter ones remove some.
 */
export function sphereStraightRounds(maxStitches: number, widthCm: number, heightCm: number, gauge: Gauge, initialStitches = 6) {
  const base = Math.ceil(maxStitches / initialStitches)
  if (heightCm <= widthCm) return Math.max(0, Math.round(base * heightCm / Math.max(widthCm, 0.1)))
  return base + Math.round((heightCm - widthCm) * gauge.rowsPer10cm / 10)
}

export function generateSphereRounds(options: {
  pieceId: string
  circumferenceCm: number
  gauge: Gauge
  initialStitches?: number
  straightRounds?: number
  increaseSpeed?: number
  elongation?: number
  color?: string
  /** Stop after the plain rounds: open dome sewn on another piece (muzzle, cheek). */
  open?: boolean
}) {
  const initial = options.initialStitches ?? 6
  const speed = Math.max(1, Math.round(options.increaseSpeed ?? 1))
  const target = Math.max(initial, targetStitchesFromCircumference(options.circumferenceCm, options.gauge))
  const straightRounds = Math.max(0, Math.round((options.straightRounds ?? 2) * (options.elongation ?? 1)))
  const rounds: CrochetRound[] = []
  let current = 0

  rounds.push(
    validateRound({
      id: `${options.pieceId}-r1`,
      round: 1,
      startStitches: 0,
      plainStitches: 0,
      increases: 0,
      decreases: 0,
      endStitches: initial,
      color: options.color,
      instruction: `${initial} ${ms(initial)} dans un anneau magique. Total : ${initial}.`,
    }),
  )
  current = initial

  for (let i = 1; current < target; i += 1) {
    const increaseCount = Math.min(initial * speed, target - current, current)
    const plain = current - increaseCount
    rounds.push(
      makeRound({
        id: `${options.pieceId}-inc-${i}`,
        round: rounds.length + 1,
        startStitches: current,
        plainStitches: plain,
        increases: increaseCount,
        color: options.color,
      }),
    )
    current += increaseCount
  }

  for (let i = 0; i < straightRounds; i += 1) {
    rounds.push(
      makeRound({
        id: `${options.pieceId}-straight-${i + 1}`,
        round: rounds.length + 1,
        startStitches: current,
        plainStitches: current,
        color: options.color,
      }),
    )
  }

  if (options.open) return rounds
  const increases = rounds.filter((round) => round.increases > 0).map((round) => round.increases).reverse()
  increases.forEach((decreaseCount, index) => {
    rounds.push(
      makeRound({
        id: `${options.pieceId}-dec-${index + 1}`,
        round: rounds.length + 1,
        startStitches: current,
        plainStitches: current - decreaseCount * 2,
        decreases: decreaseCount,
        color: options.color,
        stuffing: index === 0 ? 'rembourrer fermement' : 'aucun',
        closePiece: index === increases.length - 1,
      }),
    )
    current -= decreaseCount
  })

  return rounds
}

export function generateTubeRounds(options: {
  pieceId: string
  circumferenceCm: number
  heightCm: number
  gauge: Gauge
  initialStitches?: number
  hasBottom?: boolean
  taperPerRound?: number
  /** Circumference at the end of the piece relative to its widest round, reached by decreases spread evenly. */
  endRatio?: number
  /** The increase rounds form a rounded tip (ear) rather than a flat end (paw, foot): they count in the length. */
  roundedTip?: boolean
  color?: string
}) {
  const initial = options.initialStitches ?? 6
  const target = targetStitchesFromCircumference(options.circumferenceCm, options.gauge)
  const baseRounds = options.hasBottom === false ? 0 : Math.ceil((target - initial) / initial)
  // The increase rounds form the rounded tip and already add some length.
  const heightRounds = Math.max(1, Math.round((options.heightCm * options.gauge.rowsPer10cm) / 10) - (options.roundedTip ? baseRounds : Math.floor(baseRounds / 2)))
  const rounds: CrochetRound[] = []
  let current = options.hasBottom === false ? target : initial

  if (options.hasBottom === false) {
    rounds.push(
      makeRound({
        id: `${options.pieceId}-tube-open`,
        round: 1,
        startStitches: target,
        plainStitches: target,
        color: options.color,
        note: 'Travailler directement en tube ouvert.',
      }),
    )
  } else {
    rounds.push(
      validateRound({
        id: `${options.pieceId}-base-1`,
        round: 1,
        startStitches: 0,
        plainStitches: 0,
        increases: 0,
        decreases: 0,
        endStitches: initial,
        color: options.color,
        instruction: `${initial} ${ms(initial)} dans un anneau magique. Total : ${initial}.`,
      }),
    )
    current = initial
    while (current < target) {
      const increases = Math.min(initial, target - current)
      rounds.push(
        makeRound({
          id: `${options.pieceId}-base-${rounds.length + 1}`,
          round: rounds.length + 1,
          startStitches: current,
          plainStitches: current - increases,
          increases,
          color: options.color,
        }),
      )
      current += increases
    }
  }

  const widest = current
  const endStitches = options.endRatio === undefined ? widest : Math.max(initial, Math.round(widest * Math.min(1, options.endRatio)))
  const totalTaper = widest - endStitches
  for (let i = 0; i < heightRounds; i += 1) {
    const taper = Math.trunc(options.taperPerRound ?? 0)
    // A couple of plain rounds first keep the rounded end (paw, foot) before narrowing.
    // Wide pieces decrease 6 at a time (easy to space evenly), narrow limbs one stitch at a time.
    const spread = Math.max(1, heightRounds - 2)
    const batch = widest >= 30 && totalTaper >= 6 ? 6 : 1
    const batches = Math.ceil(totalTaper / batch)
    const due = (step: number) => Math.min(totalTaper, batch * Math.round(step * batches / spread))
    const planned = options.endRatio === undefined || i < 2 ? 0 : due(i - 1) - due(i - 2)
    const decreases = options.endRatio !== undefined ? Math.min(planned, Math.floor(current / 2))
      : taper < 0 ? Math.max(0, Math.min(Math.abs(taper), Math.floor(current / 2), current - initial)) : 0
    const increases = options.endRatio === undefined && taper > 0 ? Math.min(taper, current) : 0
    rounds.push(
      makeRound({
        id: `${options.pieceId}-side-${i + 1}`,
        round: rounds.length + 1,
        startStitches: current,
        plainStitches: current - decreases * 2 - increases,
        increases,
        decreases,
        color: options.color,
      }),
    )
    current += increases - decreases
  }

  return rounds
}

export function generateConeRounds(options: {
  pieceId: string
  circumferenceCm: number
  heightCm: number
  gauge: Gauge
  initialStitches?: number
  color?: string
}) {
  const initial = options.initialStitches ?? 4
  const target = targetStitchesFromCircumference(options.circumferenceCm, options.gauge)
  const totalRounds = Math.max(2, Math.round((options.heightCm * options.gauge.rowsPer10cm) / 10))
  const rounds: CrochetRound[] = []
  let current = initial

  rounds.push(
    validateRound({
      id: `${options.pieceId}-cone-1`,
      round: 1,
      startStitches: 0,
      plainStitches: 0,
      increases: 0,
      decreases: 0,
      endStitches: initial,
      color: options.color,
      instruction: `${initial} ${ms(initial)} dans un anneau magique. Total : ${initial}.`,
    }),
  )

  for (let i = 2; i <= totalRounds; i += 1) {
    const remainingRounds = totalRounds - i + 1
    const increases = Math.min(current, Math.max(0, Math.ceil((target - current) / remainingRounds)))
    rounds.push(
      makeRound({
        id: `${options.pieceId}-cone-${i}`,
        round: i,
        startStitches: current,
        plainStitches: current - increases,
        increases,
        color: options.color,
      }),
    )
    current += increases
  }

  return rounds
}

export function generateFlatPieceRows(options: {
  pieceId: string
  widthCm: number
  heightCm: number
  gauge: Gauge
  color?: string
}) {
  const stitches = Math.max(1, Math.round((options.widthCm * options.gauge.stitchesPer10cm) / 10))
  const rows = Math.max(1, Math.round((options.heightCm * options.gauge.rowsPer10cm) / 10))
  return Array.from({ length: rows }, (_, index) =>
    validateRound({
      id: `${options.pieceId}-flat-${index + 1}`,
      round: index + 1,
      startStitches: stitches,
      plainStitches: stitches,
      increases: 0,
      decreases: 0,
      endStitches: stitches,
      color: options.color,
      instruction: index === 0
        ? `Monter ${stitches + 1} mailles en l’air. Piquer dans la deuxième maille depuis le crochet, puis faire 1 ms dans chaque maille. Total : ${stitches}.`
        : `Faire 1 maille en l’air (ne compte pas), tourner, puis 1 ms dans chacune des ${stitches} mailles. Total : ${stitches}.`,
    }),
  )
}

/**
 * Flat oval (or round when the chain is too short) worked in rounds, for appliqués: belly, spots, soles, flat muzzles.
 * The oval chain gives 2 × chain + 2 stitches, then 6 increases per round keep the piece flat.
 */
export function generateOvalPatchRounds(options: { pieceId: string; widthCm: number; heightCm: number; gauge: Gauge; color?: string }) {
  const { gauge } = options
  const shortSide = Math.min(options.widthCm, options.heightCm)
  const longSide = Math.max(options.widthCm, options.heightCm)
  const roundCount = Math.max(2, Math.round((shortSide * gauge.rowsPer10cm) / 20))
  const chain = Math.round(((longSide - shortSide) * gauge.stitchesPer10cm) / 10)
  const oval = chain >= 3
  const first = oval ? 2 * chain + 2 : 6
  const rounds: CrochetRound[] = [validateRound({
    id: `${options.pieceId}-patch-1`,
    round: 1,
    startStitches: 0,
    plainStitches: 0,
    increases: 0,
    decreases: 0,
    endStitches: first,
    color: options.color,
    instruction: oval
      ? `Monter ${chain + 1} mailles en l’air. En commençant dans la 2e maille depuis le crochet : ${chain - 1} ms, 3 ms dans la dernière maille, puis continuer sur l’autre côté de la chaînette : ${chain - 2} ms, 2 ms dans la dernière maille. Total : ${first}.`
      : `${first} ${ms(first)} dans un anneau magique. Total : ${first}.`,
  })]
  let current = first
  for (let i = 2; i <= roundCount; i += 1) {
    const round = makeRound({ id: `${options.pieceId}-patch-${i}`, round: i, startStitches: current, plainStitches: current - 6, increases: 6, color: options.color })
    if (oval) round.instruction = `Faire 3 aug réparties dans chacune des deux extrémités arrondies et 1 ms dans les autres mailles. Total : ${current + 6}.`
    rounds.push(round)
    current += 6
  }
  const last = rounds.at(-1)!
  last.note = 'Ne pas rembourrer. Arrêter en gardant 30 cm de fil pour coudre la pièce à plat.'
  return rounds
}

/** Colors along the piece, from the first round. `from` is the fraction of the piece where the color starts. */
export function applyColorSections(rounds: CrochetRound[], sections: { color: string; from: number }[] | undefined, fallback?: string) {
  if (!sections?.length) return rounds
  const ordered = [...sections].sort((a, b) => a.from - b.from)
  let previous: string | undefined
  return rounds.map((round, index) => {
    const position = index / rounds.length
    const color = [...ordered].reverse().find(section => section.from <= position + 1e-9)?.color ?? fallback
    const changed = index > 0 && color !== previous
    previous = color
    if (index === 0 && color !== fallback) return { ...round, color, instruction: `En ${color} : ${round.instruction}` }
    if (!changed) return { ...round, color }
    return { ...round, color, colorChange: color, instruction: `Changer pour la couleur ${color}. ${round.instruction}` }
  })
}

export function pieceCircumference(piece: Pick<AmigurumiPiece, 'dimensions'>) {
  const { widthCm, depthCm, circumferenceCm } = piece.dimensions
  return widthCm > 0 && depthCm > 0 ? Math.max(1, ellipsePerimeter(widthCm, depthCm)) : Math.max(1, circumferenceCm ?? 1)
}

export function generatePieceRounds(piece: AmigurumiPiece, gauge: Gauge) {
  const circumferenceCm = piece.maxCircumferenceStitches ? (piece.maxCircumferenceStitches * 10) / gauge.stitchesPer10cm : pieceCircumference(piece)
  const common = {
    pieceId: piece.id,
    circumferenceCm,
    heightCm: piece.dimensions.heightCm,
    gauge,
    initialStitches: piece.initialStitches,
    color: piece.color,
  }
  const maxStitches = Math.max(common.initialStitches, targetStitchesFromCircumference(circumferenceCm, gauge))
  const rounds = (() => {
    if (piece.shape === 'sphère' || piece.shape === 'sphère aplatie' || piece.shape === 'ellipsoïde' || piece.shape === 'dôme') {
      const open = piece.shape === 'dôme'
      return generateSphereRounds({
        ...common,
        open,
        straightRounds: piece.straightRounds ?? (open
          ? Math.max(1, Math.round((piece.dimensions.depthCm * gauge.rowsPer10cm) / 20))
          : sphereStraightRounds(maxStitches, Math.max(piece.dimensions.widthCm, piece.dimensions.depthCm), piece.dimensions.heightCm, gauge, common.initialStitches)),
        increaseSpeed: piece.increaseSpeed,
        elongation: piece.elongation,
      })
    }
    if (piece.shape === 'cylindre' || piece.shape === 'tube') {
      return generateTubeRounds({
        ...common,
        hasBottom: piece.shape !== 'tube',
        taperPerRound: piece.taperPerRound,
        endRatio: piece.endRatio,
        roundedTip: ['oreilles', 'cornes'].includes(piece.kind),
      })
    }
    if (piece.shape === 'cône') return generateConeRounds(common)
    if (piece.shape === 'disque') return generateOvalPatchRounds({ pieceId: piece.id, widthCm: piece.dimensions.widthCm, heightCm: piece.dimensions.heightCm, gauge, color: piece.color })
    return generateFlatPieceRows({
      pieceId: piece.id,
      widthCm: piece.dimensions.widthCm,
      heightCm: piece.dimensions.heightCm,
      gauge,
      color: piece.color,
    })
  })()
  return applyColorSections(rounds, piece.colorSections, piece.color)
}

/** Consecutive identical plain rounds, shown as « Tours 8 à 15 » as in printed patterns. */
export function groupRounds(rounds: CrochetRound[]) {
  const groups: { first: CrochetRound; last: CrochetRound; count: number }[] = []
  for (const round of rounds) {
    const previous = groups.at(-1)
    const plain = (item: CrochetRound) => !item.increases && !item.decreases && !item.colorChange && !item.note && !item.closePiece && (!item.stuffing || item.stuffing === 'aucun') && item.round > 1
    if (previous && plain(round) && plain(previous.last) && previous.last.endStitches === round.endStitches && previous.last.round === round.round - 1) {
      previous.last = round
      previous.count += 1
    } else groups.push({ first: round, last: round, count: 1 })
  }
  return groups.map(group => ({ ...group, label: group.count > 1 ? `Tours ${group.first.round} à ${group.last.round}` : `Tour ${group.first.round}` }))
}
