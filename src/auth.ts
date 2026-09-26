import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function signature(expiresAt: string, password: string) {
  return createHmac('sha256', password).update(`crochet-elise:${expiresAt}`).digest('base64url')
}

export function createAccessToken(password: string, now = Date.now()) {
  const expiresAt = String(now + SESSION_DURATION_MS)
  return `${expiresAt}.${signature(expiresAt, password)}`
}

export function isAccessTokenValid(token: string | undefined, password: string, now = Date.now()) {
  if (!token) return false
  const [expiresAt, suppliedSignature, extra] = token.split('.')
  if (!expiresAt || !suppliedSignature || extra || !Number.isSafeInteger(Number(expiresAt)) || Number(expiresAt) <= now) return false
  return safeEqual(suppliedSignature, signature(expiresAt, password))
}

export function accessProtection(password: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!password) { res.status(503).json({ error: 'Le mot de passe du site n’est pas encore configuré.' }); return }
    const authorization = req.header('authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
    if (!isAccessTokenValid(token, password)) { res.status(401).json({ error: 'Le mot de passe est nécessaire pour accéder à l’atelier.' }); return }
    next()
  }
}

export function passwordMatches(supplied: string, expected: string) {
  return safeEqual(supplied, expected)
}
