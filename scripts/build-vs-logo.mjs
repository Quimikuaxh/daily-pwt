/**
 * Logo «VS.» de la pancarta VS (RF-137), dibujado en pixel art a la resolución de la DS porque no hay gráficos del
 * juego: «V» y «S» de trazo grueso, desalineadas (la «S» más baja), con relleno en bandas de amarillo a naranja, filo
 * blanco de 1 px y contorno negro de 3 px comunes a las dos letras, y la bola naranja con sus anillos abajo a la
 * derecha. Calcado del vídeo de N2/B2 (`docs/PENDIENTE.md`, rama de animaciones). Escribe public/ui/battle/vs-logo.png.
 *
 * Uso: npm run gen:vs-logo (sin dependencias). El PNG se versiona.
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OUT = new URL('../public/ui/battle/vs-logo.png', import.meta.url).pathname

/** Bandas del relleno, de arriba (amarillo) a abajo (naranja). */
const BANDS = [[255, 224, 40], [255, 196, 0], [255, 164, 0], [255, 128, 0], [250, 96, 0]]
const WHITE = [255, 255, 255]
const BLACK = [20, 20, 20]
const OUTLINE = 3

/** «V»: brazos de 9 px con la parte de arriba plana y un hueco de 8 px que se cierra hacia abajo, con punta plana. */
const V_W = 26, V_H = 29
function letterV(x, y) {
  if (y < 0 || y >= V_H) return false
  const inset = Math.round((y * 8) / V_H)
  if (x < inset || x > V_W - 1 - inset) return false
  const notch = x >= inset + 9 && x <= V_W - 1 - inset - 9
  return !notch
}

/** «S» de bloques: tres barras de 7 px unidas por dos tramos verticales, con las esquinas de fuera achaflanadas y
   huecos de 5 px para que quepan el filo blanco y el contorno. */
const S_W = 24, S_H = 31
function letterS(x, y) {
  const W = S_W, H = S_H, T = 7
  if (x < 0 || x >= W || y < 0 || y >= H) return false
  const chamfer = (cx, cy) => Math.abs(x - cx) + Math.abs(y - cy) < 3
  if (chamfer(0, 0) || chamfer(W - 1, 0) || chamfer(0, H - 1) || chamfer(W - 1, H - 1)) return false
  const top = y < T
  const mid = y >= 12 && y < 12 + T
  const bottom = y >= H - T
  const leftUp = x < T && y < 12 + T
  const rightDown = x >= W - T && y >= 12
  const topEnd = x >= W - T && y < T + 1
  const bottomEnd = x < T && y >= H - T - 1
  return top || mid || bottom || leftUp || rightDown || topEnd || bottomEnd
}

const V_AT = { x: OUTLINE + 1, y: OUTLINE + 1 }
const S_AT = { x: V_AT.x + V_W + 1, y: V_AT.y + 8 }
const DOT = { x: S_AT.x + S_W + 2, y: S_AT.y + S_H - 2, r: 3.5 }
const W = DOT.x + Math.ceil(DOT.r) + OUTLINE + 2
const H = DOT.y + Math.ceil(DOT.r) + OUTLINE + 2

const inDot = (x, y, extra = 0) => (x - DOT.x) ** 2 + (y - DOT.y) ** 2 <= (DOT.r + extra) ** 2
const isV = (x, y) => letterV(x - V_AT.x, y - V_AT.y)
const isS = (x, y) => letterS(x - S_AT.x, y - S_AT.y)
const isFill = (x, y) => isV(x, y) || isS(x, y)

/** Distancia de Chebyshev a la letra más cercana (0 dentro), hasta `max`. */
function distance(x, y, max) {
  for (let d = 0; d <= max; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === d && isFill(x + dx, y + dy)) return d
      }
    }
  }
  return Infinity
}

function bandColor(x, y) {
  if (isV(x, y)) return BANDS[Math.min(BANDS.length - 1, Math.floor(((y - V_AT.y) / V_H) * BANDS.length))]
  // La «S» va en diagonal, de amarillo arriba a la izquierda a naranja abajo a la derecha.
  const t = ((x - S_AT.x) / S_W) * 0.35 + ((y - S_AT.y) / S_H) * 0.65
  return BANDS[Math.min(BANDS.length - 1, Math.floor(t * BANDS.length))]
}

/** Píxel RGBA de la imagen, o `null` si es transparente. */
export function pixel(x, y) {
  // La bola queda por encima del contorno de la «S».
  if (inDot(x, y)) return x - DOT.x + (y - DOT.y) < -2 ? [255, 176, 64] : [255, 104, 16]
  if (inDot(x, y, 1)) return WHITE
  if (inDot(x, y, 2.2)) return BLACK
  const d = distance(x, y, OUTLINE + 1)
  if (d === 0) return bandColor(x, y)
  if (d === 1) return WHITE
  if (d <= OUTLINE + 1) return BLACK
  return null
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

export function encodePng() {
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0
    for (let x = 0; x < W; x++) {
      const p = pixel(x, y)
      const i = y * (W * 4 + 1) + 1 + x * 4
      if (p) raw.set([...p, 255], i)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(OUT, encodePng())
  console.log(`Logo VS: ${W}x${H} en ${OUT}`)
}
