import { z } from 'zod'

/** Shape of a saved pattern, shared with the front (src/lib/storage.ts): keep both in sync. */
const rowSchema = z.object({ id: z.string(), index: z.number(), label: z.string(), instruction: z.string(), totalStitches: z.number(), done: z.boolean().optional() }).passthrough()
export const patternSchema = z.object({
  id: z.string(), name: z.string(), kind: z.enum(['amigurumi', 'pixel', 'rectangle', 'basket', 'hat', 'image', 'manual']),
  createdAt: z.string(), updatedAt: z.string(), dimensions: z.record(z.string(), z.number()),
  material: z.object({ yarnName: z.string(), hookSize: z.string(), mainColor: z.string(), secondaryColors: z.array(z.string()) }),
  gauge: z.object({ stitchesPer10cm: z.number(), rowsPer10cm: z.number() }),
  stitch: z.enum(['maille serrée', 'demi-bride', 'bride']), rows: z.array(rowSchema), notes: z.string(), progressRow: z.number(),
  pieces: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string(), shape: z.string(), dimensions: z.object({ widthCm: z.number(), heightCm: z.number(), depthCm: z.number(), copies: z.number(), relativeSize: z.number(), stuffingOpening: z.number(), closed: z.boolean() }), initialStitches: z.number(), increaseSpeed: z.number(), elongation: z.number(), color: z.string(), rounds: z.array(z.object({ id: z.string(), round: z.number(), startStitches: z.number(), plainStitches: z.number(), increases: z.number(), decreases: z.number(), endStitches: z.number(), instruction: z.string() }).passthrough()) }).passthrough()).optional(),
  references: z.array(z.object({ id: z.string(), dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/), name: z.string() }).passthrough()).optional(),
  palette: z.array(z.object({ id: z.string(), name: z.string(), hex: z.string(), pieces: z.array(z.string()) }).passthrough()).optional(),
  assembly: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  imageGrid: z.object({ width: z.number().int().min(1).max(200), height: z.number().int().min(1).max(1000), colors: z.array(z.string()), cells: z.array(z.array(z.string())) }).optional(),
  guidedProgress: z.object({ pieceId: z.string(), roundIndex: z.number().int().min(0), copyIndex: z.number().int().min(0).optional() }).optional(),
  generation: z.object({ source: z.enum(['photo', 'demo']), gaugeProvided: z.boolean(), supplies: z.array(z.string()), preparation: z.array(z.string()), finishing: z.array(z.string()), uncertainties: z.array(z.string()) }).optional(),
}).passthrough()
