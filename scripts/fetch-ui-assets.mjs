import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'
import { cleanImage, cloneBoxes, cropImage, decodePng, encodePng, eraseBoxes, fillBoxes, floodTransparent, makeColorsTransparent, PNG_SIGNATURE, shrinkImage, stripImage } from './lib/png.mjs'

const UI_DIR = fromRoot('public', 'ui')
const FONTS_DIR = fromRoot('public', 'fonts')
const MANIFEST_PATH = fromRoot('data', 'ui-assets.json')
const USER_AGENT = 'daily-pwt (proyecto fan; assets de interfaz)'
const PAUSE_BETWEEN_REQUESTS_MS = 700
const MAX_RETRIES = 5
const REQUEST_TIMEOUT_MS = 30_000

const SAFE_ASSET_PATH = /^[a-z0-9-]+(\/[a-z0-9-]+)*\.png$/
const SAFE_FONT_PATH = /^[a-z0-9-]+\.ttf$/
const SAFE_SOURCE_ID = /^[a-z0-9-]+$/

const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

/** Valida la cabecera mágica: una página de error HTML no debe guardarse como imagen (DEC-18). */
export const isPng = (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)

/** Ruta absoluta de destino; lanza si el nombre no es seguro o sale de public/ui. */
export function resolveUiTarget(relativePath) {
  if (typeof relativePath !== 'string' || !SAFE_ASSET_PATH.test(relativePath)) throw new Error(`Ruta de asset no válida: ${JSON.stringify(relativePath)}`)
  const target = resolve(UI_DIR, relativePath)
  const fromUi = relative(UI_DIR, target)
  if (fromUi === '' || fromUi.startsWith('..') || resolve(fromUi) === fromUi) throw new Error(`Ruta de asset fuera de public/ui: ${relativePath}`)
  return target
}

/** Cabecera de un TrueType: 00 01 00 00, 'true' o 'OTTO' (una página de error HTML no debe guardarse como fuente). */
export const isFont = (buffer) =>
  buffer.length >= 4 && [Buffer.from([0, 1, 0, 0]), Buffer.from('true'), Buffer.from('OTTO')].some((signature) => buffer.subarray(0, 4).equals(signature))

/** Ruta absoluta de una fuente en public/fonts; lanza si el nombre no es seguro. */
export function resolveFontTarget(fileName) {
  if (typeof fileName !== 'string' || !SAFE_FONT_PATH.test(fileName)) throw new Error(`Ruta de fuente no válida: ${JSON.stringify(fileName)}`)
  return resolve(FONTS_DIR, fileName)
}

function cleanupNamed(manifest, asset) {
  const cleanup = manifest.cleanups?.[asset.clean]
  if (!cleanup) throw new Error(`Limpieza desconocida en ${asset.path}: ${asset.clean}`)
  return cleanup
}

/** Cada asset resuelve a (url, recorte, transparencias); la URL puede venir del asset o de su hoja de origen. */
export function planAssets(manifest) {
  const seenPaths = new Set()
  return manifest.assets.map((asset) => {
    if (!SAFE_SOURCE_ID.test(asset.source) || !manifest.sources[asset.source]) throw new Error(`Origen desconocido en ${asset.path}: ${asset.source}`)
    if (seenPaths.has(asset.path)) throw new Error(`Ruta duplicada en el manifest: ${asset.path}`)
    seenPaths.add(asset.path)
    resolveUiTarget(asset.path)
    const url = asset.url ?? manifest.sources[asset.source].url
    if (!url?.startsWith('https://')) throw new Error(`Falta una URL https para ${asset.path}`)
    return { path: asset.path, url, crop: asset.crop ?? null, strip: asset.strip ?? null, shrink: asset.shrink ?? null, flood: asset.flood ?? null, transparent: asset.transparent ?? [], erase: asset.erase ?? [], clone: asset.clone ?? [], fill: asset.fill ?? [], clean: asset.clean ? cleanupNamed(manifest, asset) : null, size: asset.size ?? null }
  })
}

async function fetchWithRetries(url) {
  let lastProblem = 'sin respuesta'
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (response.status === 429 || response.status >= 500) {
        lastProblem = `HTTP ${response.status}`
        await sleep((Number(response.headers.get('retry-after')) || 10) * 1000 + 1000 * (attempt + 1))
        continue
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      if (error.message.startsWith('HTTP')) throw error
      lastProblem = error?.cause?.code ?? error.message
      await sleep(3000 * (attempt + 1))
    }
  }
  throw new Error(`Agotados los reintentos (${lastProblem}): ${url}`)
}

/** Descarga cada URL una sola vez por ejecución; las hojas grandes se reutilizan para todos sus recortes. */
function createDownloader() {
  const downloads = new Map()
  return (url) => {
    if (!downloads.has(url)) {
      downloads.set(url, (async () => {
        const body = await fetchWithRetries(url)
        await sleep(PAUSE_BETWEEN_REQUESTS_MS)
        if (!isPng(body)) throw new Error(`Cabecera PNG inválida: ${url}`)
        return body
      })())
    }
    return downloads.get(url)
  }
}

export function buildAssetFile(plan, sourceBytes) {
  const needsProcessing = plan.crop || plan.transparent.length > 0 || plan.erase.length > 0 || plan.clone.length > 0 || plan.fill.length > 0 || plan.clean !== null || plan.strip !== null || plan.shrink !== null || plan.flood !== null
  const image = decodePng(sourceBytes)
  if (plan.size && (image.width !== plan.size[0] || image.height !== plan.size[1])) {
    throw new Error(`${plan.path}: tamaño ${image.width}x${image.height}, se esperaba ${plan.size.join('x')}`)
  }
  if (!needsProcessing) return sourceBytes
  const cleaned = plan.clean ? cleanImage(image, plan.clean) : image
  const cropped = plan.strip ? stripImage(cleaned, plan.strip) : plan.crop ? cropImage(cleaned, plan.crop) : cleaned
  const flooded = plan.flood ? floodTransparent(cropped, plan.flood.seeds, plan.flood.stop) : cropped
  const keyedFull = plan.transparent.length > 0 ? makeColorsTransparent(flooded, plan.transparent) : flooded
  const keyed = plan.shrink ? shrinkImage(keyedFull, plan.shrink) : keyedFull
  const cloned = plan.clone.length > 0 ? cloneBoxes(keyed, plan.clone) : keyed
  const filled = plan.fill.length > 0 ? fillBoxes(cloned, plan.fill) : cloned
  return encodePng(plan.erase.length > 0 ? eraseBoxes(filled, plan.erase) : filled)
}

async function fetchFonts(manifest, download, force, failures) {
  for (const font of manifest.fonts ?? []) {
    const target = resolveFontTarget(font.path)
    if (!manifest.sources[font.source] || !font.url?.startsWith('https://')) throw new Error(`Fuente mal definida: ${font.path}`)
    if (!force && existsSync(target) && isFont(readFileSync(target))) continue
    try {
      const body = await fetchWithRetries(font.url)
      if (!isFont(body)) throw new Error(`Cabecera TrueType inválida: ${font.url}`)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, body)
      console.log(`  fonts/${font.path}`)
    } catch (error) {
      console.error(`  fonts/${font.path}: ${error.message}`)
      failures.push(`fonts/${font.path}`)
    }
  }
}

async function main() {
  const force = process.argv.includes('--force')
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const plans = planAssets(manifest)
  const download = createDownloader()
  const failures = []
  await fetchFonts(manifest, download, force, failures)
  for (const plan of plans) {
    const target = resolveUiTarget(plan.path)
    if (!force && existsSync(target) && isPng(readFileSync(target))) continue
    try {
      const file = buildAssetFile(plan, await download(plan.url))
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, file)
      console.log(`  ${plan.path}`)
    } catch (error) {
      console.error(`  ${plan.path}: ${error.message}`)
      failures.push(plan.path)
    }
  }
  if (failures.length) {
    console.error(`Faltan ${failures.length} assets: ${failures.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log(`Assets de interfaz completos (${plans.length}).`)
  }
}

if (isMain(import.meta.url)) await main()
