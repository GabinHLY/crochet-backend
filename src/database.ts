import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { CrochetPattern } from './types'

export class ConflictError extends Error {}
export type StoredPattern = { pattern: CrochetPattern; revision: number }

export function openDatabase(filename = process.env.DATABASE_PATH ?? './data/crochet.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
      revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS legacy_imports (id TEXT PRIMARY KEY);
    PRAGMA user_version = 1;`)
  const decode = (row: Record<string, unknown>): StoredPattern => ({ pattern: JSON.parse(String(row.document)), revision: Number(row.revision) })
  return {
    list: () => db.prepare('SELECT document, revision FROM patterns ORDER BY updated_at DESC, id').all().map(decode),
    get(id: string) {
      const row = db.prepare('SELECT document, revision FROM patterns WHERE id = ?').get(id)
      return row ? decode(row) : undefined
    },
    put(pattern: CrochetPattern, revision: number): StoredPattern {
      const document = JSON.stringify(pattern)
      if (revision === 0) {
        const result = db.prepare('INSERT OR IGNORE INTO patterns (id, document, updated_at) VALUES (?, ?, ?)').run(pattern.id, document, pattern.updatedAt)
        if (!result.changes) {
          const existing = this.get(pattern.id)!
          if (isDeepStrictEqual(existing.pattern, pattern)) return existing
          throw new ConflictError('Ce patron existe déjà. Votre copie locale est conservée ; rechargez la bibliothèque avant de le modifier.')
        }
      } else {
        const result = db.prepare('UPDATE patterns SET document = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').run(document, pattern.updatedAt, pattern.id, revision)
        if (!result.changes) {
          const existing = this.get(pattern.id)
          // A response may be lost after the transaction committed. Retrying is safe.
          if (existing && isDeepStrictEqual(existing.pattern, pattern)) return existing
          throw new ConflictError('Ce patron a été modifié ou supprimé ailleurs. Exportez votre copie avant de recharger la bibliothèque.')
        }
      }
      return this.get(pattern.id)!
    },
    remove(id: string, revision: number) {
      const result = db.prepare('DELETE FROM patterns WHERE id = ? AND revision = ?').run(id, revision)
      if (!result.changes && this.get(id)) throw new ConflictError('Le patron a changé. Rechargez la bibliothèque avant de le supprimer.')
    },
    migrate(patterns: CrochetPattern[]) {
      db.exec('BEGIN IMMEDIATE')
      let imported = 0
      try {
        for (const pattern of patterns) {
          if (db.prepare('SELECT id FROM legacy_imports WHERE id = ?').get(pattern.id)) continue
          imported += Number(db.prepare('INSERT OR IGNORE INTO patterns (id, document, updated_at) VALUES (?, ?, ?)').run(pattern.id, JSON.stringify(pattern), pattern.updatedAt).changes)
          db.prepare('INSERT INTO legacy_imports (id) VALUES (?)').run(pattern.id)
        }
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return imported
    },
    close: () => db.close(),
  }
}
export type PatternDatabase = ReturnType<typeof openDatabase>
