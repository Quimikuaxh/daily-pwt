import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isMain } from './lib/cli.mjs'
import { CACHE_DIR, fromRoot } from './lib/paths.mjs'

const MANIFEST_PATH = fromRoot('data', 'audio.json')
const INDEX_PATH = fromRoot('src', 'generated', 'audio-index.json')
const AUDIO_DIR = fromRoot('public', 'audio')
const MUSIC_CACHE = resolve(CACHE_DIR, 'audio')
const SFX_CACHE = resolve(CACHE_DIR, 'sfx')
const USER_AGENT = 'daily-pwt (proyecto fan; música)'
const REQUEST_TIMEOUT_MS = 300_000

const SAFE_ID = /^[a-z0-9-]+$/
/** AAC en MP4: lo decodifican Chromium, Firefox y Safari (también iOS) con `decodeAudioData`. */
const MUSIC_ARGS = ['-vn', '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart']
const SFX_ARGS = ['-vn', '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart']
/** Quita el silencio del principio y del final: el efecto debe sonar en cuanto se pide. */
const TRIM_SILENCE = 'silenceremove=start_periods=1:start_threshold=-60dB,areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse'

/** Puntos de bucle (DEC-57): los dos o ninguno, y el final después del principio. */
function loopOf(item) {
  const { loopStartSec: start, loopEndSec: end } = item
  if (start === undefined && end === undefined) return null
  if (!(Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start)) throw new Error(`Puntos de bucle no válidos en ${item.id}`)
  return { loopStartSec: start, loopEndSec: end }
}

/**
 * Tema propio de cada entrenador que no usa el de su categoría y región (`trainers` del manifiesto, sin las claves `_…`). Cada tema
 * tiene que ser una pista de `music`.
 */
export function trainerMusicOf(manifest) {
  const music = new Set(manifest.music.map((item) => item.id))
  const entries = Object.entries(manifest.trainers ?? {}).filter(([trainerId]) => !trainerId.startsWith('_'))
  for (const [trainerId, trackId] of entries) if (!music.has(trackId)) throw new Error(`Tema desconocido para ${trainerId}: ${trackId}`)
  return Object.fromEntries(entries)
}

/** Valida el manifiesto y devuelve cada pista con su origen, su URL o entrada del ZIP y su destino en public/audio. */
export function planAudio(manifest) {
  const seen = new Set()
  const plan = (kind) => (item) => {
    if (!SAFE_ID.test(item.id ?? '')) throw new Error(`Id de audio no válido: ${JSON.stringify(item.id)}`)
    if (seen.has(`${kind}/${item.id}`)) throw new Error(`Id de audio duplicado: ${kind}/${item.id}`)
    seen.add(`${kind}/${item.id}`)
    const source = manifest.sources[item.source]
    if (!source) throw new Error(`Origen desconocido en ${kind}/${item.id}: ${item.source}`)
    const path = `audio/${kind}/${item.id}.m4a`
    if (kind === 'music') {
      if (!source.baseUrl?.startsWith('https://') || !item.file) throw new Error(`Pista mal definida: ${item.id}`)
      const loop = loopOf(item)
      return { kind, id: item.id, path, url: source.baseUrl + encodeURIComponent(item.file).replaceAll('%2F', '/'), cacheName: item.file.split('/').pop(), ...(loop && { loop }) }
    }
    if (!source.zip || !item.entry) throw new Error(`Efecto mal definido: ${item.id}`)
    return { kind, id: item.id, path, zip: source.zip, entry: item.entry }
  }
  return [...manifest.music.map(plan('music')), ...manifest.sfx.map(plan('sfx'))]
}

const ffprobeDuration = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())

/** Una página de error guardada como FLAC no debe llegar a codificarse. */
const isFlac = (file) => existsSync(file) && statSync(file).size > 4 && readFileSync(file).subarray(0, 4).toString('latin1') === 'fLaC'

async function downloadFlac(item) {
  const target = resolve(MUSIC_CACHE, item.cacheName)
  if (isFlac(target)) return target
  const response = await fetch(item.url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${item.url}`)
  mkdirSync(MUSIC_CACHE, { recursive: true })
  writeFileSync(target, Buffer.from(await response.arrayBuffer()))
  if (!isFlac(target)) throw new Error(`No es un FLAC: ${item.url}`)
  return target
}

/** `input` es una ruta, o `pipe:0` con los bytes en `stdin`. */
function encode(input, target, args, filter, stdin) {
  mkdirSync(dirname(target), { recursive: true })
  const ffmpegArgs = ['-v', 'error', '-y', '-i', input, ...(filter ? ['-af', filter] : []), ...args, target]
  execFileSync('ffmpeg', ffmpegArgs, { input: stdin })
}

function extractEntry(zip, entry) {
  const zipPath = resolve(SFX_CACHE, zip)
  if (!existsSync(zipPath)) throw new Error(`Falta el ZIP de efectos en ${zipPath} (descárgalo a mano, ver README «Sonido»)`)
  return execFileSync('unzip', ['-p', zipPath, entry], { maxBuffer: 1 << 28 })
}

async function main() {
  const force = process.argv.includes('--force')
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const index = { music: {}, sfx: {}, trainers: trainerMusicOf(manifest) }
  const failures = []
  for (const item of planAudio(manifest)) {
    const target = resolve(AUDIO_DIR, item.path.replace(/^audio\//, ''))
    try {
      if (force || !existsSync(target)) {
        if (item.kind === 'music') encode(await downloadFlac(item), target, MUSIC_ARGS)
        else encode('pipe:0', target, SFX_ARGS, TRIM_SILENCE, extractEntry(item.zip, item.entry))
        console.log(`  ${item.path}`)
      }
      const durationSec = Math.round(ffprobeDuration(target) * 1000) / 1000
      if (item.loop && item.loop.loopEndSec >= durationSec) throw new Error(`El bucle acaba después de la pista (${durationSec} s)`)
      index[item.kind][item.id] = { path: item.path, durationSec, ...item.loop }
    } catch (error) {
      console.error(`  ${item.path}: ${error.message}`)
      failures.push(item.path)
    }
  }
  if (failures.length) {
    console.error(`Faltan ${failures.length} audios: ${failures.join(', ')}`)
    process.exitCode = 1
    return
  }
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`)
  console.log(`Audio completo (${Object.keys(index.music).length} pistas, ${Object.keys(index.sfx).length} efectos).`)
}

if (isMain(import.meta.url)) await main()
