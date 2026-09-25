import { analyzeWithGemini } from './gemini'
import { demoCreatureAnalysis } from './lib/analysisToPattern'

const image = 'data:image/jpeg;base64,AAAA'

describe('analyse Gemini', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test'
    process.env.GEMINI_MODEL = 'principal'
    process.env.GEMINI_FALLBACK_MODELS = 'secours'
  })

  it('passe au modèle de secours quand le principal est saturé', async () => {
    const calls: string[] = []
    const transport = (async (url: string) => {
      calls.push(url)
      if (url.includes('principal')) return new Response('{}', { status: 503 })
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(demoCreatureAnalysis(20)) }] } }] })
    }) as typeof fetch
    const analysis = await analyzeWithGemini([image], 30, {}, transport)
    expect(calls.map(url => /models\/(\w+):/.exec(url)?.[1])).toEqual(['principal', 'secours'])
    expect(analysis.subject.targetHeightCm).toBe(30)
  })

  it('ne réessaie pas une clé refusée', async () => {
    let count = 0
    const transport = (async () => { count += 1; return new Response('{}', { status: 403 }) }) as typeof fetch
    await expect(analyzeWithGemini([image], 30, {}, transport)).rejects.toThrow('clé Gemini est refusée')
    expect(count).toBe(1)
  })
})
