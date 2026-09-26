import { describe, expect, it } from 'vitest'
import { createAccessToken, isAccessTokenValid, passwordMatches } from './auth'

describe('site access protection', () => {
  it('accepts a signed, unexpired session', () => {
    const token = createAccessToken('une phrase bien privée', 1_000)
    expect(isAccessTokenValid(token, 'une phrase bien privée', 2_000)).toBe(true)
  })

  it('rejects altered, expired and wrong-password sessions', () => {
    const token = createAccessToken('secret', 1_000)
    expect(isAccessTokenValid(`${token}x`, 'secret', 2_000)).toBe(false)
    expect(isAccessTokenValid(token, 'autre secret', 2_000)).toBe(false)
    expect(isAccessTokenValid(token, 'secret', 31 * 24 * 60 * 60 * 1000)).toBe(false)
  })

  it('compares the submitted password exactly', () => {
    expect(passwordMatches('secret familial', 'secret familial')).toBe(true)
    expect(passwordMatches('Secret familial', 'secret familial')).toBe(false)
  })
})
