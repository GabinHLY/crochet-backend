// Test fixture: same as the front's notebook template (src/lib/notebook.ts).
import type { CrochetPattern } from './types'

export function createNotebook(template = false): CrochetPattern {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(), name: template ? 'Mon carré en mailles serrées' : 'Mon nouveau patron', kind: 'manual',
    createdAt: now, updatedAt: now, dimensions: {}, material: { yarnName: '', hookSize: '', mainColor: '', secondaryColors: [] },
    gauge: { stitchesPer10cm: 20, rowsPer10cm: 20 }, stitch: 'maille serrée', progressRow: 0,
    notes: template ? 'Modèle de départ à adapter à votre fil. Répéter le rang 2 jusqu’à la hauteur souhaitée, puis arrêter le fil et rentrer les fils.' : '',
    rows: (template ? [
      { label: 'Montage', instruction: 'Faire une chaînette de 21 mailles en l’air.', totalStitches: 21 },
      { label: 'Rang 1', instruction: 'Piquer dans la deuxième maille depuis le crochet. Faire 1 maille serrée dans chacune des 20 mailles suivantes.', totalStitches: 20 },
      { label: 'Rang 2', instruction: 'Faire 1 maille en l’air (elle ne compte pas comme une maille), tourner. Faire 1 maille serrée dans chaque maille.', totalStitches: 20 },
    ] : [{ label: 'Rang 1', instruction: '', totalStitches: 0 }]).map((row, index) => ({ ...row, id: crypto.randomUUID(), index, done: false })),
  }
}
