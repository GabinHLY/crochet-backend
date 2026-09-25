import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import { analyzeWithGemini, AnalysisError } from './gemini'
import { analysisToPattern, calibrateProportions, demoCreatureAnalysis, estimatedGauge, estimatedMaterial, mergeAnalyses } from './lib/analysisToPattern'
import { imageSize } from './imageSize'
import { openDatabase } from './database'
import { patternRoutes } from './patternRoutes'
import { z } from 'zod'

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 4 } })
const port = Number(process.env.PORT ?? 8787)

// The front may be served from another origin: list it in CORS_ORIGIN (comma separated).
const allowedOrigins = (process.env.CORS_ORIGIN ?? '').split(',').map(origin => origin.trim()).filter(Boolean)
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  next()
})
app.use(express.json({ limit: '24mb' }))
const database = openDatabase()
app.use('/api/patterns', patternRoutes(database))
app.get('/api/status', (_req, res) => res.json({ storage: 'sqlite', photoAnalysisAvailable: Boolean(process.env.GEMINI_API_KEY), provider: 'gemini' }))
const generationSettings = z.object({
  gauge: z.object({ stitchesPer10cm: z.number().min(4).max(60), rowsPer10cm: z.number().min(4).max(80) }).default(estimatedGauge),
  material: z.object({ yarnName: z.string().max(120), hookSize: z.string().max(40), mainColor: z.string().max(80), secondaryColors: z.array(z.string().max(80)).max(12) }).default(estimatedMaterial),
  gaugeProvided: z.boolean().default(false),
  preferences: z.string().max(1200).default(''),
})

function fileToDataUrl(file: Express.Multer.File) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
}

function getFiles(files: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined) {
  if (!files) return []
  if (Array.isArray(files)) return files
  return Object.values(files).flat()
}

// Each analysis varies by about 15 % per measurement: several run in parallel and their median is kept.
async function analyzePhotos(imageUrls: string[], images: Buffer[], targetHeightCm: number, settings: Record<string, unknown>) {
  const samples = Math.max(1, Math.min(5, Math.round(Number(process.env.GEMINI_SAMPLES ?? 5)) || 1))
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  // Staggered starts and one late retry absorb the per-minute limits of the free tier.
  const attempt = async (sample: number) => {
    await wait(sample * 3000)
    try { return await analyzeWithGemini(imageUrls, targetHeightCm, settings, fetch, sample) } catch (error) {
      if (!(error instanceof AnalysisError) || ![429, 502].includes(error.status)) throw error
      await wait(15000)
      return analyzeWithGemini(imageUrls, targetHeightCm, settings, fetch, sample + 1)
    }
  }
  const results = await Promise.allSettled(Array.from({ length: samples }, (_, sample) => attempt(sample)))
  const analyses = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  if (!analyses.length) throw (results[0] as PromiseRejectedResult).reason
  const sizes = images.map(image => imageSize(image) ?? { width: 0, height: 0 })
  const analysis = mergeAnalyses(analyses.map(item => calibrateProportions(item, sizes)))
  if (analyses.length < samples) analysis.uncertainties.push({ field: 'analyse', message: `Seules ${analyses.length} analyses sur ${samples} ont abouti (quota Gemini) : les mesures sont moins stables, relancer plus tard peut les affiner.`, confidence: 0.5 })
  return analysis
}

app.post('/api/generate-amigurumi', upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'extraImages', maxCount: 3 }]), async (req, res) => {
  try {
    const files = getFiles(req.files)
    const main = Array.isArray(req.files) ? files[0] : req.files?.mainImage?.[0]
    if (!main) {
      res.status(400).json({ error: 'Image principale manquante.' })
      return
    }

    if (files.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype))) { res.status(400).json({ error: 'Choisissez des images PNG, JPEG ou WebP.' }); return }
    if (files.reduce((bytes, file) => bytes + file.size, 0) > 14 * 1024 * 1024) { res.status(400).json({ error: 'Les photos sont trop volumineuses ensemble. Choisissez des versions plus légères.' }); return }
    const targetHeightCm = Number(req.body.targetHeightCm)
    if (!Number.isFinite(targetHeightCm) || targetHeightCm <= 0 || targetHeightCm > 100) {
      res.status(400).json({ error: 'Hauteur finale invalide.' })
      return
    }

    const settings = generationSettings.parse(req.body.settings ? JSON.parse(req.body.settings) : {})
    if (!process.env.GEMINI_API_KEY && req.body.demo !== 'true') {
      res.status(503).json({ error: 'L’analyse photo n’est pas configurée. Ajoutez GEMINI_API_KEY dans .env sur le serveur, puis redémarrez-le.' })
      return
    }
    const isDemo = req.body.demo === 'true'
    // The main photo is always first: the analysis measures pieces relative to each photo's position.
    const photos = [main, ...files.filter(file => file !== main)]
    const imageUrls = photos.map(fileToDataUrl)
    const analysis = isDemo ? demoCreatureAnalysis(targetHeightCm) : await analyzePhotos(imageUrls, photos.map(file => file.buffer), targetHeightCm, settings)
    const pattern = analysisToPattern({
      analysis,
      imageDataUrl: fileToDataUrl(main),
      gauge: settings.gauge ?? estimatedGauge,
      material: settings.material ?? estimatedMaterial,
      gaugeProvided: settings.gaugeProvided,
      source: isDemo ? 'demo' : 'photo',
    })

    res.json({
      analysis,
      pattern,
      maskPreview: fileToDataUrl(main),
      usedFallbackAnalysis: isDemo,
    })
  } catch (error) {
    if (error instanceof AnalysisError) { res.status(error.status).json({ error: error.message }); return }
    if (error instanceof z.ZodError || error instanceof SyntaxError) { res.status(400).json({ error: 'Les réglages ou l’analyse sont invalides. Vérifiez les valeurs puis réessayez.' }); return }
    console.error('Échec de génération', error instanceof Error ? error.name : 'erreur')
    res.status(502).json({ error: 'Le service d’analyse n’a pas répondu correctement. Vérifiez sa configuration ou réessayez dans un instant.' })
  }
})

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: error instanceof multer.MulterError ? 'Image trop volumineuse (12 Mo maximum) ou trop de fichiers.' : 'Impossible de lire cet envoi.' })
})

const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`API amigurumi prête sur http://localhost:${port}`)
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close(() => { database.close(); process.exit(0) }))
