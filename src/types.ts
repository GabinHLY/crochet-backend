export type PatternKind = 'amigurumi' | 'pixel' | 'rectangle' | 'basket' | 'hat' | 'image' | 'manual'
export type Stitch = 'maille serrée' | 'demi-bride' | 'bride'
export type PieceKind =
  | 'tête'
  | 'corps'
  | 'bras'
  | 'jambes'
  | 'oreilles'
  | 'museau'
  | 'queue'
  | 'cornes'
  | 'cheveux'
  | 'accessoires'
  | 'vêtement'
  | 'pièce personnalisée'
export type PieceShape =
  | 'sphère'
  | 'sphère aplatie'
  | 'ellipsoïde'
  | 'cylindre'
  | 'cône'
  | 'tube'
  | 'disque'
  | 'forme plate'
  | 'dôme'
  | 'forme personnalisée'

export type Gauge = {
  stitchesPer10cm: number
  rowsPer10cm: number
}

export type Material = {
  yarnName: string
  hookSize: string
  mainColor: string
  secondaryColors: string[]
}

export type PatternRow = {
  id: string
  index: number
  label: string
  instruction: string
  totalStitches: number
  color?: string
  note?: string
  done?: boolean
  warning?: string
}

export type CrochetRound = {
  id: string
  round: number
  startStitches: number
  plainStitches: number
  increases: number
  decreases: number
  endStitches: number
  instruction: string
  color?: string
  colorChange?: string
  note?: string
  eyePlacement?: string
  limbPlacement?: string
  stuffing?: 'aucun' | 'rembourrer légèrement' | 'rembourrer fermement'
  closePiece?: boolean
  warning?: string
  done?: boolean
  completedCopies?: number[]
}

export type PieceDimensions = {
  widthCm: number
  heightCm: number
  depthCm: number
  circumferenceCm?: number
  relativeSize: number
  copies: number
  stuffingOpening: number
  closed: boolean
}

export type AmigurumiPiece = {
  id: string
  name: string
  kind: PieceKind
  shape: PieceShape
  dimensions: PieceDimensions
  initialStitches: number
  maxCircumferenceStitches?: number
  straightRounds?: number
  increaseSpeed: number
  elongation: number
  taperPerRound?: number
  /** Tapered tubes: end circumference relative to the widest round. */
  endRatio?: number
  color: string
  /** Color zones along the piece; `from` is the fraction of the piece where the color starts. */
  colorSections?: { color: string; from: number }[]
  rounds: CrochetRound[]
  notes?: string
}

export type YarnColor = {
  id: string
  name: string
  hex: string
  reference?: string
  quantity?: string
  pieces: string[]
}

export type AssemblyStep = {
  id: string
  text: string
}

export type ReferenceImage = {
  id: string
  name: string
  dataUrl: string
  zoom: number
  crop: { x: number; y: number; width: number; height: number }
  maskBackground: boolean
  markers: string[]
}

export type ImageGrid = {
  width: number
  height: number
  colors: string[]
  cells: string[][]
}

export type CrochetPattern = {
  id: string
  name: string
  kind: PatternKind
  createdAt: string
  updatedAt: string
  dimensions: Record<string, number>
  material: Material
  gauge: Gauge
  stitch: Stitch
  rows: PatternRow[]
  pieces?: AmigurumiPiece[]
  palette?: YarnColor[]
  assembly?: AssemblyStep[]
  references?: ReferenceImage[]
  finalHeightCm?: number
  guidedProgress?: { pieceId: string; roundIndex: number; copyIndex?: number }
  analysis?: unknown
  generation?: {
    source: 'photo' | 'demo'
    gaugeProvided: boolean
    supplies: string[]
    preparation: string[]
    finishing: string[]
    uncertainties: string[]
  }
  notes: string
  imageGrid?: ImageGrid
  progressRow: number
}

export type ManualRowInput = {
  stitch: Stitch
  stitches: number
  color: string
  increases: number
  decreases: number
  note?: string
}
