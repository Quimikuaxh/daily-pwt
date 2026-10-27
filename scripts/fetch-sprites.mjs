import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'
import { PWT_CACHE_DIR } from './lib/pwt-http.mjs'
import { ROSTER } from './lib/pwt-roster.mjs'

const SPRITES_DIR = fromRoot('public', 'sprites')
const SHOWDOWN_SPRITES_URL = 'https://play.pokemonshowdown.com/sprites'
const WIKIDEX_API_URL = 'https://www.wikidex.net/api.php'
const WAYBACK_URL = 'https://web.archive.org/web/2im_'
const USER_AGENT = 'daily-pwt (proyecto fan; sprites de desarrollo)'
const PAUSE_BETWEEN_REQUESTS_MS = 700
const WIKIDEX_PAUSE_MS = 5000
const MAX_RETRIES = 6
const REQUEST_TIMEOUT_MS = 20_000
const WIKIDEX_TITLES_PER_QUERY = 40

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Valida la cabecera mágica: una página de error HTML no debe guardarse como sprite (DEC-18). */
export function detectImageType(buffer) {
  const header = buffer.subarray(0, 6).toString('latin1')
  if (header === 'GIF87a' || header === 'GIF89a') return 'gif'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png'
  return null
}

/** Ruta absoluta de destino; lanza si sale de public/sprites. */
export function resolveSpriteTarget(relativePath) {
  const target = resolve(SPRITES_DIR, relativePath)
  const fromSprites = relative(SPRITES_DIR, target)
  if (fromSprites === '' || fromSprites.startsWith('..') || resolve(fromSprites) === fromSprites) {
    throw new Error(`Ruta de sprite fuera de public/sprites: ${relativePath}`)
  }
  return target
}

const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

async function fetchWithRetries(url, maxRetries = MAX_RETRIES) {
  let lastProblem = 'sin respuesta'
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (response.status === 429 || response.status >= 500) {
        const retryAfterSeconds = Number(response.headers.get('retry-after') ?? 12)
        lastProblem = `HTTP ${response.status}`
        await sleep((Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 12) * 1000 + 1000 * (attempt + 1))
        continue
      }
      if (response.status === 404) return null
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

function hasValidImage(relativePath, expectedType) {
  const target = resolveSpriteTarget(relativePath)
  return existsSync(target) && detectImageType(readFileSync(target)) === expectedType
}

/** Descarga `url` a `relativePath` si no existe ya una imagen válida. Devuelve true si el fichero queda bien. */
async function download(url, relativePath, expectedType, { retries = MAX_RETRIES } = {}) {
  if (hasValidImage(relativePath, expectedType)) return true
  const target = resolveSpriteTarget(relativePath)
  let body
  try {
    body = await fetchWithRetries(url, retries)
  } catch (error) {
    console.error(`  ${error.message}`)
    return false
  }
  if (!body) {
    console.error(`  no existe: ${url}`)
    return false
  }
  if (detectImageType(body) !== expectedType) {
    console.error(`  cabecera inválida (se esperaba ${expectedType}): ${url}`)
    return false
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, body)
  return true
}

const SAFE_SPRITE_ID = /^[a-z0-9-]+$/

function assertSafeSpriteId(kind, id) {
  if (typeof id !== 'string' || !SAFE_SPRITE_ID.test(id)) throw new Error(`${kind} no válido para un nombre de fichero: ${JSON.stringify(id)}`)
  return id
}

function loadTargets() {
  const dex = JSON.parse(readFileSync(fromRoot('src', 'generated', 'dex-gen5.json'), 'utf8'))
  const { trainers } = JSON.parse(readFileSync(fromRoot('data', 'trainers.json'), 'utf8'))
  const pool = JSON.parse(readFileSync(fromRoot('data', 'player-sets.json'), 'utf8'))
  const species = new Set([...trainers.flatMap((t) => t.variants.flatMap((v) => v.team)), ...pool].map((set) => set.species))
  const spriteIds = [...species].map((id) => assertSafeSpriteId('spriteId', dex.species[id].spriteId)).sort()
  for (const trainer of trainers) assertSafeSpriteId('sprite de entrenador', trainer.sprite)
  return { spriteIds, trainers }
}

async function fetchPokemonSprites(spriteIds) {
  const failures = []
  for (const spriteId of spriteIds) {
    for (const [side, directory] of [['front', 'gen5ani'], ['back', 'gen5ani-back']]) {
      const relativePath = `pokemon/${side}/${spriteId}.gif`
      if (hasValidImage(relativePath, 'gif')) continue
      const ok = await download(`${SHOWDOWN_SPRITES_URL}/${directory}/${spriteId}.gif`, relativePath, 'gif')
      if (!ok) failures.push(`${side}/${spriteId}`)
      await sleep(PAUSE_BETWEEN_REQUESTS_MS)
    }
  }
  return failures
}

/** El muñeco del sustituto de 5.ª gen. (Showdown), de frente y de espaldas: public/sprites/substitute/{front,back}.png. */
async function fetchSubstituteSprites() {
  const failures = []
  for (const [side, directory] of [['front', 'gen5'], ['back', 'gen5-back']]) {
    const relativePath = `substitute/${side}.png`
    if (hasValidImage(relativePath, 'png')) continue
    const ok = await download(`${SHOWDOWN_SPRITES_URL}/substitutes/${directory}/substitute.png`, relativePath, 'png')
    if (!ok) failures.push(relativePath)
    await sleep(PAUSE_BETWEEN_REQUESTS_MS)
  }
  return failures
}

/**
 * URLs del CDN de WikiDex que aparecen en las páginas de entrenadores ya descargadas por `gen:pwt-raw`
 * (scripts/.cache/pwt/wikidex__*.html): permiten localizar los sprites sin la API, que a veces da error.
 * Clave: nombre de fichero decodificado (`Lt._Surge_N2B2.gif`).
 */
function cdnUrlsFromCachedWikidexPages() {
  const urlByFileName = new Map()
  if (!existsSync(PWT_CACHE_DIR)) return urlByFileName
  for (const pageName of readdirSync(PWT_CACHE_DIR).filter((name) => name.startsWith('wikidex__'))) {
    const html = readFileSync(resolve(PWT_CACHE_DIR, pageName), 'utf8')
    for (const match of html.matchAll(/https?:\/\/images\.wikidexcdn\.net\/mwuploads\/wikidex\/[^"' ]+?\/([^/"' ]+_N2B2(?:_mini)?\.(?:gif|png))/g)) {
      urlByFileName.set(decodeURIComponent(match[1]), match[0])
    }
  }
  return urlByFileName
}

/** Nombre del fichero de WikiDex: el encabezado de su página si difiere del nombre en español («Lt. Surge»). */
function wikidexFileStem(trainer) {
  const rosterEntry = ROSTER.find((entry) => entry.id === trainer.id)
  return (rosterEntry?.wikidexHeading ?? trainer.nameEs).replace(/ /g, '_')
}

/**
 * WikiDex: <Nombre>_N2B2.gif y <Nombre>_N2B2_mini.png. La URL del CDN sale de las páginas en caché y, si falta, de la API;
 * si el CDN no responde (images.wikidexcdn.net no es alcanzable desde algunas redes) se usa la copia de Internet Archive de esa misma URL.
 */
async function fetchTrainerSprites(trainers) {
  const files = trainers
    .flatMap((trainer) => [
      { wikiFile: `${wikidexFileStem(trainer)}_N2B2.gif`, relativePath: `trainers/${trainer.sprite}.gif`, type: 'gif' },
      { wikiFile: `${wikidexFileStem(trainer)}_N2B2_mini.png`, relativePath: `trainers/${trainer.sprite}-mini.png`, type: 'png' },
    ])
    .filter((file) => !hasValidImage(file.relativePath, file.type))
  const urlByFileName = cdnUrlsFromCachedWikidexPages()
  const filesWithoutUrl = files.filter((file) => !urlByFileName.has(file.wikiFile))
  // La API de MediaWiki admite como mucho 50 títulos por consulta.
  for (let start = 0; start < filesWithoutUrl.length; start += WIKIDEX_TITLES_PER_QUERY) {
    const titles = filesWithoutUrl.slice(start, start + WIKIDEX_TITLES_PER_QUERY).map((file) => `Archivo:${file.wikiFile}`).join('|')
    const query = `${WIKIDEX_API_URL}?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(titles)}`
    try {
      const answer = JSON.parse((await fetchWithRetries(query, 2)).toString('utf8'))
      for (const page of answer.query.pages) {
        const url = page.imageinfo?.[0]?.url
        if (url) urlByFileName.set(page.title.replace(/^Archivo:/, '').replace(/ /g, '_'), url)
      }
    } catch (error) {
      console.error(`  la API de WikiDex no respondió con JSON (${error.message})`)
    }
    await sleep(WIKIDEX_PAUSE_MS)
  }

  const failures = []
  for (const file of files) {
    const cdnUrl = urlByFileName.get(file.wikiFile)
    let ok = false
    if (cdnUrl) {
      ok = await download(cdnUrl, file.relativePath, file.type, { retries: 1 })
      if (!ok) ok = await download(`${WAYBACK_URL}/${cdnUrl}`, file.relativePath, file.type)
    }
    if (!ok) failures.push(file.relativePath)
    await sleep(WIKIDEX_PAUSE_MS)
  }
  return failures
}

if (isMain(import.meta.url)) {
  const { spriteIds, trainers } = loadTargets()
  console.log(`Pokémon: ${spriteIds.length} especies; entrenadores: ${trainers.length}`)
  const pokemonFailures = await fetchPokemonSprites(spriteIds)
  const trainerFailures = await fetchTrainerSprites(trainers)
  const substituteFailures = await fetchSubstituteSprites()
  const failures = [...pokemonFailures, ...trainerFailures, ...substituteFailures]
  if (failures.length) {
    console.error(`Faltan ${failures.length} sprites: ${failures.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('Sprites completos.')
  }
}
