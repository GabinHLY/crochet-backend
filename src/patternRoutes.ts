import { Router } from 'express'
import { z } from 'zod'
import { patternSchema } from './patternSchema'
import type { CrochetPattern } from './types'
import { ConflictError, type PatternDatabase } from './database'

export function patternRoutes(db: PatternDatabase) {
  const router = Router()
  router.get('/', (_req, res) => res.json({ items: db.list() }))
  router.post('/migrate', (req, res, next) => {
    try {
      const items = z.array(patternSchema).max(500).parse(req.body.patterns) as CrochetPattern[]
      res.json({ imported: db.migrate(items) })
    } catch (error) { next(error) }
  })
  router.get('/:id', (req, res) => {
    const item = db.get(req.params.id)
    if (!item) { res.status(404).json({ error: 'Patron introuvable.' }); return }
    res.json(item)
  })
  router.put('/:id', (req, res, next) => {
    try {
      const { pattern, revision } = z.object({ pattern: patternSchema, revision: z.number().int().min(0) }).parse(req.body)
      if (pattern.id !== req.params.id) { res.status(400).json({ error: 'Identifiant incohérent.' }); return }
      res.json(db.put(pattern as CrochetPattern, revision))
    } catch (error) { next(error) }
  })
  router.delete('/:id', (req, res, next) => {
    try {
      const revision = z.number().int().positive().parse(req.body.revision)
      db.remove(req.params.id, revision)
      res.status(204).end()
    } catch (error) { next(error) }
  })
  router.use((error: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Le patron contient des données manquantes ou invalides.' }); return }
    if (error instanceof ConflictError) { res.status(409).json({ error: error.message }); return }
    console.error('Échec de la sauvegarde SQLite', error instanceof Error ? error.name : 'erreur')
    res.status(500).json({ error: 'La base de données est momentanément indisponible. Votre modification reste en attente.' })
  })
  return router
}
