// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import type { Server } from 'node:http'
import { openDatabase, type PatternDatabase } from './database'
import { patternRoutes } from './patternRoutes'
import { createNotebook } from './testFixtures'

describe('SQLite et API des patrons', () => {
  let directory: string
  let db: PatternDatabase
  let server: Server
  let base: string
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'crochet-sqlite-test-'))
    db = openDatabase(join(directory, 'test.sqlite'))
    const app = express(); app.use(express.json()); app.use('/api/patterns', patternRoutes(db))
    server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/patterns`
  })
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); rmSync(directory, { recursive: true }) })
  const json = (response: Response) => response.json() as Promise<{ revision: number; items: unknown[]; imported: number }>
  const request = (url: string, method: string, body: unknown) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  it('crée, modifie et retrouve un patron après réouverture du fichier', async () => {
    const pattern = createNotebook(true)
    const first = await request(`${base}/${pattern.id}`, 'PUT', { pattern, revision: 0 })
    expect(first.status).toBe(200)
    pattern.name = 'Carré en coton'; pattern.rows[0].done = true
    const saved = await request(`${base}/${pattern.id}`, 'PUT', { pattern, revision: 1 })
    expect((await json(saved)).revision).toBe(2)
    const reopened = openDatabase(join(directory, 'test.sqlite'))
    expect(reopened.get(pattern.id)?.pattern.rows[0].done).toBe(true)
    expect(reopened.get(pattern.id)?.pattern.name).toBe('Carré en coton')
    reopened.close()
    expect((await json(await fetch(base))).items).toHaveLength(1)
  })
  it('refuse une sauvegarde concurrente et permet de réessayer une réponse perdue', async () => {
    const pattern = createNotebook()
    db.put(pattern, 0)
    expect((await request(`${base}/${pattern.id}`, 'PUT', { pattern, revision: 0 })).status).toBe(200)
    const next = { ...pattern, name: 'Dernière version' }; db.put(next, 1)
    expect((await request(`${base}/${pattern.id}`, 'PUT', { pattern: { ...pattern, name: 'Version ancienne' }, revision: 1 })).status).toBe(409)
    expect(db.get(pattern.id)?.pattern.name).toBe('Dernière version')
  })
  it('migre une seule fois sans restaurer les patrons supprimés', async () => {
    const pattern = createNotebook(true)
    expect((await json(await request(`${base}/migrate`, 'POST', { patterns: [pattern] }))).imported).toBe(1)
    expect((await json(await request(`${base}/migrate`, 'POST', { patterns: [pattern] }))).imported).toBe(0)
    expect((await request(`${base}/${pattern.id}`, 'DELETE', { revision: 1 })).status).toBe(204)
    await request(`${base}/migrate`, 'POST', { patterns: [pattern] })
    expect(db.list()).toHaveLength(0)
    expect((await request(`${base}/${pattern.id}`, 'PUT', { pattern, revision: 1 })).status).toBe(409)
  })
  it('rejette les données invalides sans écriture partielle', async () => {
    const pattern = createNotebook()
    expect((await request(`${base}/migrate`, 'POST', { patterns: [pattern, {}] })).status).toBe(400)
    expect((await request(`${base}/autre-id`, 'PUT', { pattern, revision: 0 })).status).toBe(400)
    expect(db.list()).toHaveLength(0)
  })
})
