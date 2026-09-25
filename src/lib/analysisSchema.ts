import { z } from 'zod'

export const AmigurumiAnalysisSchema = z.object({
  subject: z.object({
    description: z.string(),
    category: z.enum(['human', 'animal', 'creature', 'object']),
    targetHeightCm: z.number().positive(),
    complexity: z.enum(['simple', 'medium', 'complex']),
    imageBoxes: z.array(z.array(z.number().min(0).max(1000)).length(4).nullable()).default([]),
  }),
  palette: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      usage: z.array(z.string()),
    }),
  ),
  parts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      quantity: z.number().int().min(1).max(12),
      primitive: z.enum(['sphere', 'ellipsoid', 'cylinder', 'tapered-cylinder', 'cone', 'dome', 'flat-oval', 'flat-piece']),
      relativeWidth: z.number().min(0).max(1),
      relativeHeight: z.number().min(0).max(1),
      relativeDepth: z.number().min(0).max(1),
      endWidthRatio: z.number().min(0.1).max(1).default(1),
      colorId: z.string(),
      colorSections: z.array(z.object({ colorId: z.string(), fromStart: z.number().min(0).max(1) })).default([]),
      symmetryGroup: z.string().nullable(),
      attachment: z.object({
        parentPartId: z.string().nullable(),
        position: z.enum(['top', 'bottom', 'left', 'right', 'front', 'back', 'custom']),
        description: z.string(),
      }),
      features: z.array(
        z.object({
          type: z.enum(['eye', 'mouth', 'nose', 'color-change', 'embroidery', 'accessory']),
          description: z.string(),
          relativeVerticalPosition: z.number().min(0).max(1),
          relativeHorizontalPosition: z.number().min(0).max(1),
        }),
      ),
      imageBox: z.array(z.number().min(0).max(1000)).length(4).nullable().default(null),
      photoIndex: z.number().int().min(0).max(3).default(0),
      confidence: z.number().min(0).max(1),
    }),
  ).min(1).max(30),
  clothes: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['dress', 'shirt', 'vest', 'trousers', 'belt', 'scarf', 'shoes', 'custom']),
      colorIds: z.array(z.string()),
      attachedToPartIds: z.array(z.string()),
      description: z.string(),
    }),
  ),
  assemblyOrder: z.array(z.string()),
  uncertainties: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

export type AmigurumiAnalysis = z.infer<typeof AmigurumiAnalysisSchema>

export const amigurumiAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'palette', 'parts', 'clothes', 'assemblyOrder', 'uncertainties'],
  properties: {
    subject: {
      type: 'object',
      additionalProperties: false,
      required: ['description', 'category', 'targetHeightCm', 'complexity', 'imageBoxes'],
      properties: {
        description: { type: 'string' },
        category: { type: 'string', enum: ['human', 'animal', 'creature', 'object'] },
        targetHeightCm: { type: 'number', exclusiveMinimum: 0 },
        complexity: { type: 'string', enum: ['simple', 'medium', 'complex'] },
        imageBoxes: { type: 'array', items: { type: ['array', 'null'], items: { type: 'number', minimum: 0, maximum: 1000 }, minItems: 4, maxItems: 4 } },
      },
    },
    palette: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'hex', 'usage'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          hex: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          usage: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    parts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'name',
          'quantity',
          'primitive',
          'relativeWidth',
          'relativeHeight',
          'relativeDepth',
          'endWidthRatio',
          'colorId',
          'colorSections',
          'symmetryGroup',
          'attachment',
          'features',
          'imageBox',
          'photoIndex',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          primitive: { type: 'string', enum: ['sphere', 'ellipsoid', 'cylinder', 'tapered-cylinder', 'cone', 'dome', 'flat-oval', 'flat-piece'] },
          relativeWidth: { type: 'number', minimum: 0, maximum: 1 },
          relativeHeight: { type: 'number', minimum: 0, maximum: 1 },
          relativeDepth: { type: 'number', minimum: 0, maximum: 1 },
          endWidthRatio: { type: 'number', minimum: 0.1, maximum: 1 },
          colorId: { type: 'string' },
          colorSections: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['colorId', 'fromStart'],
              properties: { colorId: { type: 'string' }, fromStart: { type: 'number', minimum: 0, maximum: 1 } },
            },
          },
          symmetryGroup: { type: ['string', 'null'] },
          attachment: {
            type: 'object',
            additionalProperties: false,
            required: ['parentPartId', 'position', 'description'],
            properties: {
              parentPartId: { type: ['string', 'null'] },
              position: { type: 'string', enum: ['top', 'bottom', 'left', 'right', 'front', 'back', 'custom'] },
              description: { type: 'string' },
            },
          },
          features: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'description', 'relativeVerticalPosition', 'relativeHorizontalPosition'],
              properties: {
                type: { type: 'string', enum: ['eye', 'mouth', 'nose', 'color-change', 'embroidery', 'accessory'] },
                description: { type: 'string' },
                relativeVerticalPosition: { type: 'number', minimum: 0, maximum: 1 },
                relativeHorizontalPosition: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          imageBox: { type: ['array', 'null'], items: { type: 'number', minimum: 0, maximum: 1000 }, minItems: 4, maxItems: 4 },
          photoIndex: { type: 'integer', minimum: 0, maximum: 3 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    clothes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'type', 'colorIds', 'attachedToPartIds', 'description'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['dress', 'shirt', 'vest', 'trousers', 'belt', 'scarf', 'shoes', 'custom'] },
          colorIds: { type: 'array', items: { type: 'string' } },
          attachedToPartIds: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
        },
      },
    },
    assemblyOrder: { type: 'array', items: { type: 'string' } },
    uncertainties: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'message', 'confidence'],
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const

export function validateAmigurumiAnalysis(value: unknown) {
  const analysis = AmigurumiAnalysisSchema.parse(value)
  const ids = new Set(analysis.parts.map(part => part.id))
  const colors = new Set(analysis.palette.map(color => color.id))
  if (ids.size !== analysis.parts.length || !analysis.parts.length || !colors.size) throw new Error('Analyse incomplète ou identifiants dupliqués.')
  for (const part of analysis.parts) {
    if (!colors.has(part.colorId) || part.colorSections.some(section => !colors.has(section.colorId)) || (part.attachment.parentPartId && !ids.has(part.attachment.parentPartId))) throw new Error('Les pièces et couleurs de l’analyse sont incohérentes.')
  }
  return analysis
}
