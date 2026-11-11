/**
 * Retratos de la pancarta VS (RF-137): para cada entrenador, el último fotograma de su gif (la pose activa, como el
 * retrato del juego, que no usa el primero) recortado a su tinta: por arriba desde la primera fila con píxeles, para que
 * la franja enseñe siempre el medio cuerpo de arriba, y sin columnas vacías a los lados. Escribe public/sprites/trainers/<sprite>-vs.png y, para el protagonista,
 * public/ui/battle/trainers/<id>-vs.png a partir de su sprite de frente (que es estático).
 *
 * Uso: npm run gen:trainer-vs (necesita ffmpeg y ffprobe en el PATH). Los PNG se versionan.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const TRAINERS = join(ROOT, 'public/sprites/trainers')
const PLAYER = join(ROOT, 'public/ui/battle/trainers')

const run = (cmd, args) => execFileSync(cmd, args, { maxBuffer: 1 << 26 })

/** Ancho, alto y número de fotogramas. */
function probe(file) {
  const out = run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames', '-of', 'csv=p=0', file])
  const [w, h, n] = String(out).trim().split(',').map(Number)
  return { w, h, n: n || 1 }
}

/** Filas del retrato que caben en la franja (62 px de alto, a 2x y con la cabeza a 3 px del borde). */
export const VISIBLE_ROWS = 28

/**
 * Recorte de un búfer RGBA: desde la primera fila con algún píxel no transparente hasta abajo, y a lo ancho entre la
 * primera y la última columna con píxeles en las filas que se ven en la franja. Así la caja del retrato es la tinta que
 * se ve y la pancarta puede centrar a los dos entrenadores a la misma distancia del centro sea cual sea el sprite (lo
 * que sobresale más abajo, oculto por la franja, se recorta).
 */
export function opaqueCrop(rgba, w, h, visibleRows = VISIBLE_ROWS) {
  const opaque = (x, y) => rgba[(y * w + x) * 4 + 3] > 0
  let top = -1
  for (let y = 0; y < h && top < 0; y++) {
    for (let x = 0; x < w; x++) if (opaque(x, y)) { top = y; break }
  }
  if (top < 0) return { x: 0, y: 0, w, h }
  let left = w, right = -1
  for (let y = top; y < Math.min(h, top + visibleRows); y++) {
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y)) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
  }
  return { x: left, y: top, w: right - left + 1, h: h - top }
}

function buildPortrait(src, dest) {
  const { w, h, n } = probe(src)
  const select = `select=eq(n\\,${n - 1})`
  const rgba = run('ffmpeg', ['-v', 'error', '-i', src, '-vf', select, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'])
  const c = opaqueCrop(rgba, w, h)
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `${select},crop=${c.w}:${c.h}:${c.x}:${c.y}`, '-frames:v', '1', '-pix_fmt', 'rgba', dest])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gifs = readdirSync(TRAINERS).filter((f) => f.endsWith('.gif'))
  for (const gif of gifs) buildPortrait(join(TRAINERS, gif), join(TRAINERS, gif.replace(/\.gif$/, '-vs.png')))
  for (const id of ['nate', 'rosa']) buildPortrait(join(PLAYER, `${id}-front.png`), join(PLAYER, `${id}-vs.png`))
  console.log(`Retratos VS: ${gifs.length} entrenadores y 2 protagonistas.`)
}
