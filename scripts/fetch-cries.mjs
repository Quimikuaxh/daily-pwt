import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMain } from './lib/cli.mjs'
import { CACHE_DIR, fromRoot } from './lib/paths.mjs'
import { ffprobeDuration, SFX_ARGS, TRIM_SILENCE } from './build-audio.mjs'
import { loadTargets } from './fetch-sprites.mjs'

/**
 * Gritos de los Pokémon (decisión de Jose, 31/10/2026): los de Pokémon Showdown (`audio/cries/<id>.mp3`), solo de las especies que
 * salen en el juego (rivales y pool del jugador), en AAC como los efectos (`build-audio.mjs`), en `public/audio/cries/<spriteId>.m4a`,
 * con su índice en `src/generated/cries-index.json`. Desde la nube Showdown está bloqueado: se lanza en local (`npm run gen:cries`,
 * necesita ffmpeg). Lo ya convertido no se vuelve a bajar.
 */
const CRIES_URL = 'https://play.pokemonshowdown.com/audio/cries'
const CRIES_CACHE = resolve(CACHE_DIR, 'cries')
const OUT_DIR = fromRoot('public', 'audio', 'cries')
const INDEX_PATH = fromRoot('src', 'generated', 'cries-index.json')
const USER_AGENT = 'daily-pwt (proyecto fan; gritos)'
const PAUSE_MS = 300

/** Nombres que se prueban para un `spriteId`, en orden: el suyo, sin guion y el de la especie base (las formas comparten grito en 5.ª gen.). */
export function cryCandidates(spriteId) {
  const base = spriteId.split('-')[0]
  return [...new Set([spriteId, spriteId.replace(/-/g, ''), base])]
}

const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

async function download(name) {
  const cached = resolve(CRIES_CACHE, `${name}.mp3`)
  if (existsSync(cached)) return cached
  const response = await fetch(`${CRIES_URL}/${name}.mp3`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) })
  await sleep(PAUSE_MS)
  if (!response.ok) return null
  mkdirSync(CRIES_CACHE, { recursive: true })
  writeFileSync(cached, Buffer.from(await response.arrayBuffer()))
  return cached
}

async function main() {
  const { spriteIds } = loadTargets()
  const index = existsSync(INDEX_PATH) ? JSON.parse(readFileSync(INDEX_PATH, 'utf8')) : {}
  const missing = []
  mkdirSync(OUT_DIR, { recursive: true })
  for (const spriteId of spriteIds) {
    const target = resolve(OUT_DIR, `${spriteId}.m4a`)
    if (index[spriteId] && existsSync(target)) continue
    let source = null
    for (const name of cryCandidates(spriteId)) {
      source = await download(name).catch(() => null)
      if (source) break
    }
    if (!source) {
      missing.push(spriteId)
      continue
    }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-af', TRIM_SILENCE, ...SFX_ARGS, target])
    index[spriteId] = { path: `audio/cries/${spriteId}.m4a`, durationSec: Math.round(ffprobeDuration(target) * 1000) / 1000 }
    console.log(`  ${spriteId}`)
  }
  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(INDEX_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`Gritos: ${Object.keys(sorted).length} de ${spriteIds.length}.`)
  if (missing.length) {
    console.error(`Sin grito en Showdown: ${missing.join(', ')}`)
    process.exitCode = 1
  }
}

if (isMain(import.meta.url)) await main()
