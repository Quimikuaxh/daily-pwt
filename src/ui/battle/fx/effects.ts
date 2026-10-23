/**
 * Animaciones de movimientos (DEC-53): dibujadas por código en el lienzo de la pantalla de arriba (256x192), en píxeles enteros y sin
 * suavizado, con los colores del tipo. Cada efecto es una función pura del progreso (0 a 1): se puede probar fotograma a fotograma.
 */

export type Point = { x: number; y: number }

/**
 * Lo que necesita un efecto: quién lo usa, a quién va, tipo y colores del movimiento, y un azar determinista que se crea de nuevo en cada
 * fotograma con la misma semilla (las esquirlas y gotas no saltan de un fotograma a otro).
 */
export type FxContext = {
  user: Point
  target: Point
  type: string
  color: string
  light: string
  dark: string
  random: () => number
}

/** Temblor de un sprite o de toda la pantalla en un instante del efecto, en píxeles lógicos. */
export type Shake = { who: 'user' | 'target' | 'screen'; dx: number; dy: number }

export type Painter = {
  /** Pinta un cuadrado de `size` píxeles con la esquina en coordenadas enteras. */
  dot: (x: number, y: number, size: number, color: string) => void
}

export type Effect = {
  /** Duración a x1 en ms (la velocidad del combate la divide). Cabe en el tiempo del mensaje «X usó Y». */
  duration: number
  draw: (paint: Painter, progress: number, context: FxContext) => void
  shake?: (progress: number) => Shake | null
}

export type FxKind = 'hit' | 'bite' | 'punch' | 'kick' | 'slash' | 'shot' | 'boost' | 'drop' | 'status' | 'heal' | 'protect' | 'substitute' | 'weather' | 'hazard' | 'screen' | 'self' | 'foe'

// ---------- utilidades ----------

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
/** Progreso de un tramo [start, end] dentro del efecto: 0 antes, 1 después. */
const phase = (progress: number, start: number, end: number): number => clamp01((progress - start) / (end - start))
const inPhase = (progress: number, start: number, end: number): boolean => progress >= start && progress < end
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t
const lerpPoint = (from: Point, to: Point, t: number): Point => ({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) })

/** Puntos de una circunferencia de radio `r` (cada `step` radianes). */
function ring(paint: Painter, center: Point, radius: number, color: string, size = 3, points = 16, offset = 0): void {
  for (let i = 0; i < points; i += 1) {
    const angle = offset + (i / points) * Math.PI * 2
    paint.dot(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, size, color)
  }
}

/** Estallido: `rays` rayos de puntos que salen del centro. */
function burst(paint: Painter, center: Point, t: number, color: string, light: string, rays = 8, length = 30): void {
  if (t <= 0 || t >= 1) return
  for (let i = 0; i < rays; i += 1) {
    const angle = (i / rays) * Math.PI * 2 + Math.PI / rays
    for (let step = 0; step < 3; step += 1) {
      const distance = t * length - step * 5
      if (distance < 3) continue
      paint.dot(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance, step === 0 ? 4 : 3, step === 0 ? light : color)
    }
  }
}

/** Esquirlas al azar alrededor de un punto, que se alejan y caen. Las posiciones salen de `seeds` (fijas por efecto). */
function shards(paint: Painter, center: Point, t: number, seeds: readonly number[], color: string, spread = 34): void {
  if (t <= 0 || t >= 1) return
  for (let i = 0; i < seeds.length; i += 2) {
    const angle = seeds[i] * Math.PI * 2
    const speed = 0.5 + seeds[i + 1]
    paint.dot(center.x + Math.cos(angle) * spread * speed * t, center.y + Math.sin(angle) * spread * speed * t + 16 * t * t, 3, color)
  }
}

function seedsFor(context: FxContext, count: number): number[] {
  return Array.from({ length: count }, () => context.random())
}

/** Bola de `radius` píxeles (disco lleno en cuadrados de 2). */
function orb(paint: Painter, center: Point, radius: number, color: string, light: string): void {
  for (let y = -radius; y <= radius; y += 2) {
    for (let x = -radius; x <= radius; x += 2) {
      if (x * x + y * y <= radius * radius) paint.dot(center.x + x, center.y + y, 2, x + y < -radius * 0.5 ? light : color)
    }
  }
}

/** Haz recto de cuadrados entre dos puntos, con un temblor lateral opcional. */
function beam(paint: Painter, from: Point, to: Point, t: number, color: string, light: string, width = 3, wiggle = 0): void {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.floor((length * t) / 3))
  const nx = -(to.y - from.y) / length
  const ny = (to.x - from.x) / length
  for (let i = 0; i <= steps; i += 1) {
    const point = lerpPoint(from, to, (i * 3) / length)
    const offset = wiggle ? Math.sin(i * 1.3) * wiggle : 0
    paint.dot(point.x + nx * offset, point.y + ny * offset, width, i % 3 === 0 ? light : color)
  }
}

const shakeTarget = (start: number, end: number, amplitude = 2) => (progress: number): Shake | null =>
  inPhase(progress, start, end) ? { who: 'target', dx: Math.round(Math.sin(progress * 90) * amplitude), dy: 0 } : null

// ---------- genéricas (por categoría y efecto) ----------

/** Golpe físico: destello en el objetivo, estallido y esquirlas; el objetivo tiembla. */
const hit: Effect = {
  duration: 650,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 16)
    if (inPhase(progress, 0.15, 0.3)) orb(paint, c.target, 10, c.light, '#ffffff')
    burst(paint, c.target, phase(progress, 0.25, 0.75), c.color, c.light)
    shards(paint, c.target, phase(progress, 0.3, 0.9), seeds, c.color)
  },
  shake: shakeTarget(0.25, 0.7),
}

/** Dos filas de `teeth`*2+1 colmillos que se cierran sobre `center` según `close` (0 abiertas, 1 cerradas). */
function jaws(paint: Painter, center: Point, close: number, teeth: number, color: string): void {
  const gap = Math.round(30 * (1 - close)) + 2
  for (let i = -teeth; i <= teeth; i += 1) {
    const x = center.x + i * 7
    for (let k = 0; k < 4; k += 1) {
      const half = 3 - k
      paint.dot(x - half, center.y - gap - 8 + k * 2, half * 2 + 1, color)
      paint.dot(x - half, center.y + gap + 6 - k * 2, half * 2 + 1, color)
    }
  }
}

/** Mordisco: dos filas de colmillos se cierran sobre el objetivo. */
const bite: Effect = {
  duration: 650,
  draw(paint, progress, c) {
    if (progress < 0.6) jaws(paint, c.target, phase(progress, 0.1, 0.45), 3, '#f8f8f8')
    burst(paint, c.target, phase(progress, 0.45, 0.85), c.color, c.light, 8, 24)
  },
  shake: shakeTarget(0.4, 0.75),
}

/** Puño en píxel (palma y nudillos), de `scale` veces su tamaño. */
function fist(paint: Painter, center: Point, scale: number, color: string, light: string): void {
  const s = Math.max(1, Math.round(scale))
  const rows = ['.####.', '######', '######', '######', '.####.']
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) if (row[x] === '#') paint.dot(center.x + (x - 3) * s, center.y + (y - 2) * s, s, y === 0 ? light : color)
  })
}

/** Puñetazo: un puño que se acerca creciendo y golpea. */
const punch: Effect = {
  duration: 650,
  draw(paint, progress, c) {
    const approach = phase(progress, 0.05, 0.4)
    if (progress < 0.45) fist(paint, c.target, 1 + approach * 3, c.color, c.light)
    burst(paint, c.target, phase(progress, 0.4, 0.85), c.color, c.light, 8, 28)
  },
  shake: shakeTarget(0.4, 0.75, 3),
}

/** Bota en píxel. */
function boot(paint: Painter, center: Point, size: number, color: string, light: string): void {
  const rows = ['..##..', '..##..', '..##..', '..###.', '.#####', '######']
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) if (row[x] === '#') paint.dot(center.x + (x - 3) * size, center.y + (y - 3) * size, size, y < 2 ? light : color)
  })
}

/** Patada: un pie que entra en barrido desde un lado y golpea. */
const kick: Effect = {
  duration: 650,
  draw(paint, progress, c) {
    const sweep = phase(progress, 0.05, 0.4)
    if (progress < 0.45) boot(paint, { x: c.target.x - 40 * (1 - sweep), y: c.target.y + 10 - 10 * sweep }, 3, c.color, c.light)
    burst(paint, c.target, phase(progress, 0.4, 0.85), c.color, c.light, 8, 26)
  },
  shake: shakeTarget(0.4, 0.75, 3),
}

/** Corte: tres tajos en diagonal, uno tras otro. */
const slash: Effect = {
  duration: 650,
  draw(paint, progress, c) {
    for (let k = 0; k < 3; k += 1) {
      const t = phase(progress, k * 0.12, k * 0.12 + 0.3)
      if (t <= 0 || progress > 0.8) continue
      const offset = (k - 1) * 10
      beam(paint, { x: c.target.x - 22 + offset, y: c.target.y - 24 }, { x: c.target.x + 18 + offset, y: c.target.y + 22 }, t, '#f8f8f8', c.light, 3)
    }
  },
  shake: shakeTarget(0.2, 0.7),
}

/** Ataque especial: una bola con estela va del usuario al objetivo y estalla. */
const shot: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    const travel = phase(progress, 0.05, 0.55)
    if (inPhase(progress, 0.05, 0.55)) {
      for (let i = 0; i < 4; i += 1) orb(paint, lerpPoint(c.user, c.target, Math.max(0, travel - i * 0.06)), 8 - i * 2, i === 0 ? c.color : c.dark, c.light)
    }
    burst(paint, c.target, phase(progress, 0.55, 0.95), c.color, c.light, 10, 32)
  },
  shake: shakeTarget(0.55, 0.9),
}

/** Sube características (Maquinación, Danza Dragón…): un aura del color del tipo late alrededor del usuario. Las flechas van con el mensaje («ha subido»). */
const boost: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    for (let k = 0; k < 3; k += 1) {
      const t = phase(progress, k * 0.2, k * 0.2 + 0.5)
      if (t > 0 && t < 1) ring(paint, c.user, 30 - t * 18, k % 2 ? c.light : c.color, 3, 18, progress * 4)
    }
    if (inPhase(progress, 0.6, 0.8)) orb(paint, c.user, 8, c.light, '#ffffff')
  },
}

/** Baja características del rival (Encanto, Chirrido…): ondas del color del tipo van del usuario al objetivo. Las flechas van con el mensaje («ha bajado»). */
const drop: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    for (let k = 0; k < 4; k += 1) {
      const t = phase(progress, k * 0.1, k * 0.1 + 0.55)
      if (t <= 0 || t >= 1) continue
      const at = lerpPoint(c.user, c.target, t)
      for (let i = -2; i <= 2; i += 1) paint.dot(at.x + i * 3, at.y + Math.abs(i) * 3 - 3, 3, k % 2 ? c.light : c.color)
    }
  },
  shake: shakeTarget(0.6, 0.9),
}

/** Flecha en píxel de 6 de alto, hacia arriba (`up`) o hacia abajo. */
function arrow(paint: Painter, at: Point, up: boolean, color: string): void {
  for (let k = 0; k < 6; k += 1) {
    const y = up ? at.y + k : at.y - k
    paint.dot(at.x - k, y, 3, color)
    paint.dot(at.x + k, y, 3, color)
  }
}

/** Ha subido una característica: flechas rojas que suben por el Pokémon (con el mensaje). */
const statUp: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    for (let i = 0; i < 5; i += 1) {
      const t = (progress * 1.6 + i * 0.2) % 1
      arrow(paint, { x: c.target.x - 28 + i * 14, y: c.target.y + 22 - t * 50 }, true, t < 0.6 ? '#f85848' : '#f8a888')
    }
  },
}

/** Ha bajado una característica: flechas azules que caen sobre el Pokémon (con el mensaje). */
const statDown: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    for (let i = 0; i < 5; i += 1) {
      const t = (progress * 1.6 + i * 0.2) % 1
      arrow(paint, { x: c.target.x - 28 + i * 14, y: c.target.y - 28 + t * 50 }, false, t < 0.6 ? '#4890f8' : '#98c0f8')
    }
  },
}

/** Provoca un estado: anillos del color del tipo que se cierran sobre el objetivo. */
const status: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    for (let i = 0; i < 3; i += 1) {
      const t = phase(progress, i * 0.15, i * 0.15 + 0.6)
      if (t > 0 && t < 1) ring(paint, c.target, 38 * (1 - t) + 6, i % 2 ? c.light : c.color, 3, 16, progress * 6)
    }
  },
}

/** Recupera PS: cruces verdes que suben y brillan alrededor del usuario. */
const heal: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 12)
    for (let i = 0; i < 6; i += 1) {
      const t = (progress + seeds[i]) % 1
      const x = c.user.x - 28 + seeds[i + 6] * 56
      const y = c.user.y + 20 - t * 46
      const color = t < 0.5 ? '#78f878' : '#c8f8c8'
      paint.dot(x - 3, y, 3, color)
      paint.dot(x + 3, y, 3, color)
      paint.dot(x, y - 3, 3, color)
      paint.dot(x, y + 3, 3, color)
      paint.dot(x, y, 3, color)
    }
  },
}

/** Protección: un escudo hexagonal que aparece y brilla delante del usuario. */
const protect: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    const grow = phase(progress, 0, 0.35)
    const radius = 14 + 24 * grow
    const color = Math.floor(progress * 10) % 2 ? '#78f8f8' : '#48d848'
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2
      const b = ((i + 1) / 6) * Math.PI * 2
      const from = { x: c.user.x + Math.cos(a) * radius, y: c.user.y + Math.sin(a) * radius }
      const to = { x: c.user.x + Math.cos(b) * radius, y: c.user.y + Math.sin(b) * radius }
      beam(paint, from, to, 1, color, '#f8f8f8', 3)
    }
  },
}

/** Sustituto: una nube de humo blanca sobre el usuario. */
const substitute: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 20)
    const t = phase(progress, 0, 0.8)
    for (let i = 0; i < 10; i += 1) {
      const angle = seeds[i] * Math.PI * 2
      const distance = 8 + seeds[i + 10] * 26 * t
      orb(paint, { x: c.user.x + Math.cos(angle) * distance, y: c.user.y + Math.sin(angle) * distance }, 6, t < 0.6 ? '#f8f8f8' : '#c0c0c8', '#ffffff')
    }
  },
}

/** Clima: partículas por toda la pantalla, del color del tipo (lluvia en rayas si es de Agua; sol, arena o nieve en puntos). */
const weather: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 60)
    for (let i = 0; i < 30; i += 1) {
      const x = (seeds[i] * 256 + progress * 120) % 256
      const y = (seeds[i + 30] * 150 + progress * 260) % 150
      if (c.type === 'Water') {
        paint.dot(x, y, 1, c.light)
        paint.dot(x - 1, y + 2, 1, c.light)
        paint.dot(x - 2, y + 4, 1, c.light)
      } else paint.dot(x, y, 3, i % 2 ? c.light : c.color)
    }
  },
}

/** Trampas en el campo rival (Púas, Rocas…): piezas que caen y se quedan bajo el objetivo. */
const hazard: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    for (let i = 0; i < 5; i += 1) {
      const t = phase(progress, i * 0.08, i * 0.08 + 0.5)
      const x = c.target.x - 30 + i * 15
      const ground = c.target.y + 30
      const y = lerp(c.target.y - 60, ground, t * t)
      orb(paint, { x, y }, 5, c.color, c.light)
    }
  },
}

/** Pantallas (Reflejo, Pantalla de Luz, Viento Afín): un muro translúcido del color del tipo delante del usuario. */
const screen: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    const t = phase(progress, 0, 0.4)
    const height = Math.round(60 * t)
    const x = c.user.x + 34
    for (let y = 0; y < height; y += 4) paint.dot(x + ((y / 4) % 2), c.user.y - 30 + y, 4, y % 8 ? c.color : c.light)
  },
}

/** Otros de estado sobre uno mismo o sobre el rival: destellos del color del tipo. */
const sparkleOn = (who: 'user' | 'target'): Effect => ({
  duration: 650,
  draw(paint, progress, c) {
    const center = who === 'user' ? c.user : c.target
    const seeds = seedsFor(c, 16)
    for (let i = 0; i < 8; i += 1) {
      const blink = (progress * 3 + seeds[i]) % 1
      if (blink > 0.5) continue
      const x = center.x - 28 + seeds[i + 8] * 56
      const y = center.y - 24 + seeds[(i + 3) % 16] * 48
      paint.dot(x, y - 3, 3, c.light)
      paint.dot(x, y + 3, 3, c.light)
      paint.dot(x - 3, y, 3, c.light)
      paint.dot(x + 3, y, 3, c.light)
      paint.dot(x, y, 3, c.color)
    }
  },
})

export const GENERIC_EFFECTS: Record<FxKind, Effect> = {
  hit,
  bite,
  punch,
  kick,
  slash,
  shot,
  boost,
  drop,
  status,
  heal,
  protect,
  substitute,
  weather,
  hazard,
  screen,
  self: sparkleOn('user'),
  foe: sparkleOn('target'),
}

// ---------- especiales por tipo (no todo son bolas) ----------

/** Rombo en píxel (hojas, cristales, gemas). */
function diamond(paint: Painter, center: Point, radius: number, color: string, light: string): void {
  for (let y = -radius; y <= radius; y += 2) {
    const half = radius - Math.abs(y)
    for (let x = -half; x <= half; x += 2) paint.dot(center.x + x, center.y + y, 2, y < 0 ? light : color)
  }
}

/** Punto del recorrido usuario -> objetivo, con un arco hacia arriba de `lift` píxeles. */
const along = (c: FxContext, t: number, lift = 0): Point => {
  const point = lerpPoint(c.user, c.target, t)
  return { x: point.x, y: point.y - Math.sin(t * Math.PI) * lift }
}

/** Fuego: un chorro de llamas que ondean (no bolas) y llamaradas sobre el objetivo. */
const fireSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const head = phase(progress, 0.05, 0.55)
    for (let i = 0; i < 18; i += 1) {
      const t = head - i * 0.035
      if (t <= 0 || progress > 0.75) continue
      const point = along(c, t)
      const flicker = Math.sin(progress * 40 + i) * 3
      const size = 3 + ((i + Math.floor(progress * 20)) % 3)
      paint.dot(point.x, point.y + flicker, size, i % 3 === 0 ? '#f8e050' : i % 3 === 1 ? '#f88830' : '#e04020')
    }
    const flames = phase(progress, 0.5, 1)
    if (flames > 0 && flames < 1) {
      for (let i = 0; i < 5; i += 1) {
        const x = c.target.x - 20 + i * 10
        const height = 10 + ((i * 7 + Math.floor(progress * 24)) % 9)
        for (let y = 0; y < height; y += 3) paint.dot(x + Math.sin(y + progress * 30), c.target.y + 18 - y - flames * 10, 3, y > height - 4 ? '#f8e050' : '#f07030')
      }
    }
  },
  shake: shakeTarget(0.5, 0.9),
}

/** Agua: un chorro ondulante y salpicaduras. */
const waterSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    beam(paint, c.user, c.target, phase(progress, 0.05, 0.5), c.color, c.light, 5, 4)
    shards(paint, c.target, phase(progress, 0.5, 1), seedsFor(c, 16), c.light, 30)
  },
  shake: shakeTarget(0.5, 0.85),
}

/** Planta: hojas que vuelan girando hasta el objetivo. */
const grassSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let i = 0; i < 6; i += 1) {
      const t = phase(progress, i * 0.07, i * 0.07 + 0.55)
      if (t <= 0 || t >= 1) continue
      const point = along(c, t, 16 + i * 4)
      diamond(paint, { x: point.x, y: point.y + Math.sin(t * 12 + i) * 6 }, 4, c.color, c.light)
    }
  },
  shake: shakeTarget(0.55, 0.9),
}

/** Eléctrico: un rayo en zigzag del usuario al objetivo y chispas. */
const electricSpecial: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    if (inPhase(progress, 0.05, 0.6) && Math.floor(progress * 24) % 3 !== 0) {
      const segments = 8
      let from = c.user
      for (let i = 1; i <= segments; i += 1) {
        const base = lerpPoint(c.user, c.target, i / segments)
        const to = i === segments ? c.target : { x: base.x, y: base.y + (i % 2 ? -10 : 10) }
        beam(paint, from, to, 1, c.color, c.light, 3)
        from = to
      }
    }
    burst(paint, c.target, phase(progress, 0.4, 0.8), c.color, c.light, 8, 22)
  },
  shake: shakeTarget(0.35, 0.8),
}

/** Hielo: cristales que vuelan y estallan en esquirlas. */
const iceSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let i = 0; i < 4; i += 1) {
      const t = phase(progress, i * 0.08, i * 0.08 + 0.45)
      if (t > 0 && t < 1) diamond(paint, along(c, t, 6), 5, c.color, '#f8f8f8')
    }
    shards(paint, c.target, phase(progress, 0.55, 1), seedsFor(c, 18), c.light, 34)
  },
  shake: shakeTarget(0.55, 0.9),
}

/** Psíquico (genérico): ondas que viajan del usuario al objetivo. */
const psychicSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let i = 0; i < 4; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.55)
      if (t > 0 && t < 1) ring(paint, along(c, t), 6 + t * 10, i % 2 ? c.light : c.color, 3, 12)
    }
  },
  shake: (progress) => (inPhase(progress, 0.6, 0.95) ? { who: 'target', dx: Math.round(Math.sin(progress * 24) * 3), dy: 0 } : null),
}

/** Fantasma: sombras ondulantes que rodean al objetivo y se le meten dentro. */
const ghostSpecial: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + progress * 6
      const radius = 40 * (1 - phase(progress, 0.2, 0.85)) + 4
      const point = { x: c.target.x + Math.cos(angle) * radius, y: c.target.y + Math.sin(angle) * radius * 0.6 }
      for (let k = 0; k < 3; k += 1) paint.dot(point.x - k * 2, point.y + Math.sin(progress * 20 + k) * 2, 4 - k, k ? c.dark : c.color)
    }
  },
  shake: shakeTarget(0.6, 0.9),
}

/** Siniestro: ondas oscuras que salen del usuario y alcanzan al objetivo. */
const darkSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let i = 0; i < 4; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.55)
      if (t > 0 && t < 1) ring(paint, along(c, t), 6 + t * 14, i % 2 ? c.dark : c.color, 2, 14, i)
    }
  },
  shake: shakeTarget(0.45, 0.85),
}

/** Dragón: dos llamas que se retuercen en espiral hasta el objetivo. */
const dragonSpecial: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const head = phase(progress, 0.05, 0.6)
    for (let i = 0; i < 14; i += 1) {
      const t = head - i * 0.03
      if (t <= 0 || progress > 0.8) continue
      const point = along(c, t)
      const twist = Math.sin(t * 18) * 8
      paint.dot(point.x, point.y + twist, 4, c.color)
      paint.dot(point.x, point.y - twist, 3, c.light)
    }
    burst(paint, c.target, phase(progress, 0.6, 1), c.color, c.light, 10, 28)
  },
  shake: shakeTarget(0.6, 0.9),
}

/** Veneno: borbotones de lodo que caen en arco y salpican. */
const poisonSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let i = 0; i < 4; i += 1) {
      const t = phase(progress, i * 0.08, i * 0.08 + 0.5)
      if (t > 0 && t < 1) orb(paint, along(c, t, 30), 4 + (i % 2), c.color, c.light)
    }
    shards(paint, c.target, phase(progress, 0.55, 1), seedsFor(c, 14), c.color, 26)
  },
  shake: shakeTarget(0.55, 0.9),
}

/** Volador: ráfagas de viento en arco que cruzan hasta el objetivo. */
const flyingSpecial: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    for (let i = 0; i < 3; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.5)
      if (t <= 0 || t >= 1) continue
      const center = along(c, t, 10)
      for (let k = -3; k <= 3; k += 1) paint.dot(center.x + k * 3, center.y - Math.abs(k) * k * 0.6 + k * 2, 2, k % 2 ? c.light : '#f8f8f8')
    }
    burst(paint, c.target, phase(progress, 0.6, 0.95), c.light, '#f8f8f8', 6, 22)
  },
  shake: shakeTarget(0.6, 0.9),
}

/** Bicho: un enjambre de puntos que zumba hasta el objetivo. */
const bugSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 24)
    for (let i = 0; i < 12; i += 1) {
      const t = phase(progress, seeds[i] * 0.3, seeds[i] * 0.3 + 0.55)
      if (t <= 0 || t >= 1) continue
      const point = along(c, t)
      paint.dot(point.x + Math.sin(progress * 50 + i) * 8, point.y + Math.cos(progress * 43 + i) * 8 + (seeds[i + 12] - 0.5) * 16, 3, i % 2 ? c.color : c.light)
    }
  },
  shake: shakeTarget(0.6, 0.9),
}

/** Tierra: el suelo estalla bajo el objetivo y lanza terrones. */
const groundSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const t = phase(progress, 0.15, 0.85)
    if (t <= 0 || t >= 1) return
    const seeds = seedsFor(c, 16)
    for (let i = 0; i < 8; i += 1) {
      const x = c.target.x - 26 + seeds[i] * 52
      const height = (0.4 + seeds[i + 8]) * 46 * Math.sin(t * Math.PI)
      orb(paint, { x, y: c.target.y + 26 - height }, 4, c.color, c.light)
    }
  },
  shake: (progress) => (inPhase(progress, 0.15, 0.85) ? { who: 'target', dx: 0, dy: Math.round(Math.sin(progress * 60) * 2) } : null),
}

/** Roca: gemas o piedras que vuelan en arco y golpean. */
const rockSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let i = 0; i < 3; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.5)
      if (t > 0 && t < 1) diamond(paint, along(c, t, 20), 6, c.color, c.light)
    }
    burst(paint, c.target, phase(progress, 0.6, 0.95), c.color, c.light, 8, 24)
  },
  shake: shakeTarget(0.6, 0.9),
}

/** Lucha: un aura de energía que se carga en el usuario y sale disparada. */
const fightingSpecial: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const charge = phase(progress, 0, 0.3)
    const center = lerpPoint(c.user, c.target, phase(progress, 0.3, 0.65))
    if (progress < 0.65) {
      orb(paint, center, 5 + Math.round(charge * 3), c.color, c.light)
      ring(paint, center, 12, c.light, 2, 10, progress * 14)
    }
    burst(paint, c.target, phase(progress, 0.65, 1), c.color, c.light, 10, 30)
  },
  shake: shakeTarget(0.65, 0.95),
}

/** Acero: un destello metálico en haz recto y chispas brillantes. */
const steelSpecial: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    if (progress < 0.65) beam(paint, c.user, c.target, phase(progress, 0.05, 0.45), '#f8f8f8', c.color, 5)
    burst(paint, c.target, phase(progress, 0.45, 0.85), '#f8f8f8', c.light, 12, 26)
  },
  shake: shakeTarget(0.45, 0.8),
}

/** Estrella de cinco puntas en píxel. */
function star(paint: Painter, center: Point, radius: number, color: string): void {
  for (let arm = 0; arm < 5; arm += 1) {
    const angle = -Math.PI / 2 + (arm / 5) * Math.PI * 2
    for (let r = 0; r <= radius; r += 2) paint.dot(center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r, 3, color)
  }
}

/** Normal: estrellas que salen del usuario hacia el objetivo. */
const normalSpecial: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    for (let i = 0; i < 3; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.5)
      if (t > 0 && t < 1) star(paint, along(c, t, 8), 7, i % 2 ? c.light : '#f8f8c8')
    }
    burst(paint, c.target, phase(progress, 0.6, 0.95), c.color, c.light, 8, 24)
  },
  shake: shakeTarget(0.6, 0.9),
}

/** Ataques especiales: cada tipo con su forma (decisión de Jose: no todo son bolas). La bola genérica queda para tipos desconocidos. */
export const SPECIAL_BY_TYPE: Record<string, Effect> = {
  Fire: fireSpecial,
  Water: waterSpecial,
  Grass: grassSpecial,
  Electric: electricSpecial,
  Ice: iceSpecial,
  Psychic: psychicSpecial,
  Ghost: ghostSpecial,
  Dark: darkSpecial,
  Dragon: dragonSpecial,
  Poison: poisonSpecial,
  Flying: flyingSpecial,
  Bug: bugSpecial,
  Ground: groundSpecial,
  Rock: rockSpecial,
  Fighting: fightingSpecial,
  Steel: steelSpecial,
  Normal: normalSpecial,
}

// ---------- propias (los 20 movimientos más usados entre rivales y pool del jugador) ----------

/** Terremoto: la pantalla entera tiembla y se levanta polvo del suelo. */
const earthquake: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 40)
    for (let i = 0; i < 20; i += 1) {
      const t = (progress * 2 + seeds[i]) % 1
      paint.dot(seeds[i + 20] * 256, 140 - t * 30, 4, i % 2 ? c.color : c.light)
    }
  },
  shake: (progress) => (progress < 0.9 ? { who: 'screen', dx: Math.round(Math.sin(progress * 70) * 3), dy: Math.round(Math.cos(progress * 55)) } : null),
}

/** Roca Afilada: rocas puntiagudas que salen del suelo bajo el objetivo. */
const stoneedge: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    for (let i = 0; i < 4; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.35)
      const x = c.target.x - 27 + i * 18
      const base = c.target.y + 30
      const height = Math.round(44 * t * (i % 2 ? 0.8 : 1))
      for (let y = 0; y < height; y += 2) {
        const half = Math.max(1, Math.round(((height - y) / height) * 7))
        for (let k = -half; k <= half; k += 2) paint.dot(x + k, base - y, 3, y > height - 8 ? c.light : c.color)
      }
    }
  },
  shake: shakeTarget(0.35, 0.75),
}

/** Psíquico: ondas rosas concéntricas sobre el objetivo, que se balancea. */
const psychic: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    for (let i = 0; i < 4; i += 1) {
      const t = (progress * 2 + i * 0.25) % 1
      ring(paint, c.target, 8 + t * 40, i % 2 ? c.light : c.color, 3, 20, i)
    }
  },
  shake: (progress) => (progress < 0.9 ? { who: 'target', dx: Math.round(Math.sin(progress * 24) * 3), dy: 0 } : null),
}

/** Onda Certera: una gran bola de energía que crece en el usuario y sale disparada. */
const focusblast: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const charge = phase(progress, 0, 0.35)
    const travel = phase(progress, 0.35, 0.7)
    const center = lerpPoint(c.user, c.target, travel)
    if (progress < 0.7) orb(paint, center, Math.round(6 + 10 * charge), '#f8a830', '#f8f080')
    burst(paint, c.target, phase(progress, 0.7, 1), '#f8a830', '#f8f080', 12, 38)
  },
  shake: shakeTarget(0.7, 0.95, 3),
}

/** Avalancha: rocas que caen desde arriba sobre el objetivo. */
const rockslide: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let i = 0; i < 5; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.4)
      if (t <= 0 || t >= 1) continue
      orb(paint, { x: c.target.x - 30 + i * 15, y: lerp(-12, c.target.y + 8, t * t) }, 7, c.color, c.light)
    }
  },
  shake: shakeTarget(0.3, 0.85),
}

/** Rayo Hielo: un haz en zigzag hasta el objetivo y cristales de hielo. */
const icebeam: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    beam(paint, c.user, c.target, phase(progress, 0.05, 0.5), c.color, '#f8f8f8', 4, 4)
    const seeds = seedsFor(c, 12)
    shards(paint, c.target, phase(progress, 0.5, 1), seeds, c.light, 20)
  },
  shake: shakeTarget(0.5, 0.85),
}

/** Rayo: un relámpago en zigzag cae del cielo sobre el objetivo y deslumbra. */
const thunderbolt: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    if (!inPhase(progress, 0.1, 0.75) || Math.floor(progress * 20) % 3 === 0) return
    let x = c.target.x
    for (let y = 0; y < c.target.y; y += 8) {
      const next = x + (Math.floor(y / 8) % 2 ? 8 : -8)
      beam(paint, { x, y }, { x: next, y: y + 8 }, 1, '#f8e030', '#f8f8a8', 4)
      x = next
    }
    burst(paint, c.target, phase(progress, 0.3, 0.75), '#f8e030', '#f8f8a8', 8, 26)
  },
  shake: shakeTarget(0.3, 0.8),
}

/** Danza Espada: dos espadas que giran alrededor del usuario. */
const swordsdance: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    for (let k = 0; k < 2; k += 1) {
      const angle = progress * Math.PI * 4 + k * Math.PI
      const hilt = { x: c.user.x + Math.cos(angle) * 26, y: c.user.y + Math.sin(angle) * 14 }
      const tip = { x: hilt.x, y: hilt.y - 26 }
      beam(paint, hilt, tip, 1, '#d0d0e0', '#ffffff', 3)
      paint.dot(hilt.x - 4, hilt.y, 3, '#b07830')
      paint.dot(hilt.x + 4, hilt.y, 3, '#b07830')
      paint.dot(hilt.x, hilt.y + 3, 3, '#b07830')
    }
  },
}

/** Bola Sombra: una bola oscura con partículas que giran, va al objetivo y estalla. */
const shadowball: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const travel = phase(progress, 0.1, 0.6)
    if (progress < 0.6) {
      const center = lerpPoint(c.user, c.target, travel)
      orb(paint, center, 9, '#583878', '#9870c8')
      ring(paint, center, 13, '#9870c8', 3, 6, progress * 20)
    }
    burst(paint, c.target, phase(progress, 0.6, 1), '#583878', '#9870c8', 10, 34)
  },
  shake: shakeTarget(0.6, 0.9),
}

/** Poder Oculto: orbes del color del tipo giran alrededor del usuario y salen hacia el objetivo. */
const hiddenpower: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const gather = phase(progress, 0, 0.45)
    const travel = phase(progress, 0.45, 0.85)
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + progress * 8
      const around = { x: c.user.x + Math.cos(angle) * 30 * (1 - gather * 0.6), y: c.user.y + Math.sin(angle) * 18 * (1 - gather * 0.6) }
      const point = travel > 0 ? lerpPoint(around, c.target, travel) : around
      if (progress < 0.85) orb(paint, point, 4, c.color, c.light)
    }
    burst(paint, c.target, phase(progress, 0.85, 1), c.color, c.light)
  },
  shake: shakeTarget(0.85, 1),
}

/** Trampa Rocas: rocas que flotan girando alrededor del objetivo. */
const stealthrock: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const appear = phase(progress, 0, 0.3)
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2 + progress * 5
      orb(paint, { x: c.target.x + Math.cos(angle) * 36 * appear, y: c.target.y + 6 + Math.sin(angle) * 14 * appear }, 5, c.color, c.light)
    }
  },
}

/** Ida y Vuelta: el usuario tiembla al salir y un corte verde cruza al objetivo. */
const uturn: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    const t = phase(progress, 0.25, 0.65)
    if (t > 0 && t < 1) {
      const from = { x: c.target.x - 26, y: c.target.y - 26 }
      beam(paint, from, { x: c.target.x + 26, y: c.target.y + 26 }, t, c.color, c.light, 5)
    }
    burst(paint, c.target, phase(progress, 0.6, 0.95), c.color, c.light, 6, 24)
  },
  shake: (progress) => (progress < 0.25 ? { who: 'user', dx: Math.round(Math.sin(progress * 80) * 2), dy: 0 } : shakeTarget(0.6, 0.9)(progress)),
}

/** Llamarada: una estrella de fuego de cinco brazos se abre sobre el objetivo. */
const fireblast: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const travel = phase(progress, 0.05, 0.4)
    if (progress < 0.4) orb(paint, lerpPoint(c.user, c.target, travel), 7, '#f87830', '#f8d050')
    const t = phase(progress, 0.4, 0.95)
    if (t > 0 && t < 1) {
      for (let arm = 0; arm < 5; arm += 1) {
        const angle = -Math.PI / 2 + (arm / 5) * Math.PI * 2
        const tip = { x: c.target.x + Math.cos(angle) * 38 * t, y: c.target.y + Math.sin(angle) * 38 * t }
        beam(paint, c.target, tip, 1, '#f85820', '#f8d050', 6)
      }
    }
  },
  shake: shakeTarget(0.45, 0.95, 3),
}

/** Hidrobomba: un chorro grueso de agua con gotas. */
const hydropump: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const t = phase(progress, 0.05, 0.6)
    beam(paint, c.user, c.target, t, c.color, c.light, 7, 3)
    const seeds = seedsFor(c, 16)
    shards(paint, c.target, phase(progress, 0.55, 1), seeds, c.light, 36)
  },
  shake: shakeTarget(0.5, 0.9),
}

/** Golpe Bajo: dos golpes rápidos y oscuros en diagonal sobre el objetivo. */
const suckerpunch: Effect = {
  duration: 600,
  draw(paint, progress, c) {
    for (let k = 0; k < 2; k += 1) {
      const t = phase(progress, k * 0.25, k * 0.25 + 0.3)
      if (t <= 0 || t >= 1) continue
      const dir = k ? -1 : 1
      beam(paint, { x: c.target.x - 24 * dir, y: c.target.y - 24 }, { x: c.target.x + 24 * dir, y: c.target.y + 24 }, t, '#504050', '#9888a8', 5)
    }
  },
  shake: shakeTarget(0.2, 0.7),
}

/** Tóxico: burbujas moradas que suben del objetivo. */
const toxic: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 16)
    for (let i = 0; i < 8; i += 1) {
      const t = (progress * 1.5 + seeds[i]) % 1
      orb(paint, { x: c.target.x - 28 + seeds[i + 8] * 56, y: c.target.y + 26 - t * 52 }, 3 + (i % 2) * 3, '#a040a0', '#d888d8')
    }
  },
}

/** Fuerza Bruta: dos impactos fuertes con anillo de choque. */
const superpower: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let k = 0; k < 2; k += 1) {
      const t = phase(progress, 0.15 + k * 0.3, 0.45 + k * 0.3)
      if (t > 0 && t < 1) ring(paint, c.target, 8 + t * 34, k ? c.light : c.color, 4, 22)
      if (t > 0 && t < 0.4) orb(paint, c.target, 12, c.light, '#ffffff')
    }
  },
  shake: shakeTarget(0.15, 0.85, 3),
}

/** Puño Hielo: un puñetazo y cristales de hielo que salen despedidos. */
const icepunch: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    if (inPhase(progress, 0.1, 0.35)) orb(paint, c.target, 11, c.light, '#ffffff')
    const seeds = seedsFor(c, 20)
    shards(paint, c.target, phase(progress, 0.3, 0.95), seeds, c.color, 38)
    burst(paint, c.target, phase(progress, 0.25, 0.7), c.color, '#f8f8f8', 6, 26)
  },
  shake: shakeTarget(0.25, 0.7),
}

// ---------- propias, segunda tanda (los 20 siguientes por uso, 22/10/2026) ----------

/** Enfado: llamas del color del tipo se levantan del usuario, que tiembla de rabia, y caen tres golpes sobre el objetivo. */
const outrage: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 24)
    if (progress < 0.45) {
      for (let i = 0; i < 12; i += 1) {
        const t = (progress * 3 + seeds[i]) % 1
        paint.dot(c.user.x - 26 + seeds[i + 12] * 52, c.user.y + 22 - t * 44, 3 + (i % 2), t < 0.5 ? c.color : c.light)
      }
    }
    for (let k = 0; k < 3; k += 1) {
      const center = { x: c.target.x + (k - 1) * 14, y: c.target.y + (k % 2 ? -10 : 6) }
      burst(paint, center, phase(progress, 0.45 + k * 0.15, 0.7 + k * 0.15), c.color, c.light, 8, 20)
    }
  },
  shake: (progress) => (progress < 0.45 ? { who: 'user', dx: Math.round(Math.sin(progress * 90) * 2), dy: 0 } : shakeTarget(0.45, 0.95, 3)(progress)),
}

/** Triturar: unas fauces grandes y oscuras muerden dos veces. */
const crunch: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let k = 0; k < 2; k += 1) {
      const t = phase(progress, k * 0.35, k * 0.35 + 0.3)
      if (t > 0 && t < 1) jaws(paint, c.target, Math.min(1, t * 1.4), 4, k ? c.light : '#e8e0f0')
    }
    const seeds = seedsFor(c, 16)
    shards(paint, c.target, phase(progress, 0.65, 1), seeds, c.color, 30)
  },
  shake: shakeTarget(0.25, 0.9, 3),
}

/** A Bocajarro: una ráfaga de puños y patadas por todo el objetivo. */
const closecombat: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 16)
    for (let i = 0; i < 8; i += 1) {
      if (!inPhase(progress, i * 0.1, i * 0.1 + 0.16)) continue
      const at = { x: c.target.x - 22 + seeds[i] * 44, y: c.target.y - 20 + seeds[i + 8] * 40 }
      if (i % 2) boot(paint, at, 2, c.color, c.light)
      else fist(paint, at, 2, c.color, c.light)
      ring(paint, at, 12, '#f8f8f8', 2, 10)
    }
  },
  shake: shakeTarget(0.05, 0.9, 3),
}

/** Tierra Viva: el suelo se agrieta bajo el objetivo y sale una columna de energía. */
const earthpower: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    const base = c.target.y + 30
    const crack = phase(progress, 0, 0.35)
    for (let i = 0; i < Math.round(crack * 8); i += 1) {
      paint.dot(c.target.x + i * 4, base + (i % 2 ? 1 : -1), 2, c.dark)
      paint.dot(c.target.x - i * 4, base + (i % 2 ? -1 : 1), 2, c.dark)
    }
    const rise = phase(progress, 0.35, 0.8)
    if (rise > 0 && progress < 0.9) {
      for (let x = -12; x <= 12; x += 4) {
        const height = Math.round(70 * rise * (1 - Math.abs(x) / 24))
        for (let y = 0; y < height; y += 4) paint.dot(c.target.x + x, base - y, 4, (y / 4 + Math.floor(progress * 20)) % 3 ? c.color : c.light)
      }
    }
  },
  shake: shakeTarget(0.35, 0.85, 3),
}

/** Copo de nieve: una cruz con aspas. */
function snowflake(paint: Painter, center: Point, color: string): void {
  paint.dot(center.x, center.y, 2, '#ffffff')
  for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, -2], [2, -2], [-2, 2]]) paint.dot(center.x + dx, center.y + dy, 1, color)
}

/** Ventisca: un temporal de nieve cruza la pantalla hacia el objetivo y lo cubre. */
const blizzard: Effect = {
  duration: 1000,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 80)
    const dir = c.target.x > c.user.x ? 1 : -1
    for (let i = 0; i < 40; i += 1) {
      const t = (progress * 1.5 + seeds[i]) % 1
      const x = dir > 0 ? t * 264 - 4 : 260 - t * 264
      const y = seeds[i + 40] * 150 + Math.sin(t * 9 + i) * 6
      snowflake(paint, { x, y }, i % 3 ? c.light : c.color)
    }
    if (progress > 0.5 && progress < 0.95) orb(paint, c.target, 10 + Math.round(phase(progress, 0.5, 0.8) * 6), c.light, '#ffffff')
  },
  shake: shakeTarget(0.5, 0.95),
}

/** Respiro: plumas que caen meciéndose sobre el usuario y un brillo verde de curación. */
const roost: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 12)
    for (let i = 0; i < 6; i += 1) {
      const t = phase(progress, seeds[i] * 0.3, seeds[i] * 0.3 + 0.6)
      if (t <= 0 || t >= 1) continue
      const x = c.user.x - 24 + seeds[i + 6] * 48 + Math.sin(t * 8) * 6
      const y = c.user.y - 50 + t * 70
      for (let k = 0; k < 4; k += 1) paint.dot(x + k * 2 * (Math.sin(t * 8) > 0 ? 1 : -1), y + k, 2, k === 0 ? '#b0a090' : '#f8f8f0')
    }
    const glow = phase(progress, 0.55, 1)
    if (glow > 0 && glow < 1) ring(paint, c.user, 10 + glow * 22, glow < 0.5 ? '#78f878' : '#c8f8c8', 3, 14, progress * 4)
  },
}

/** Escaldar: un chorro de agua hirviendo en arco y vapor que sube del objetivo. */
const scald: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    const head = phase(progress, 0.05, 0.5)
    for (let i = 0; i < 12; i += 1) {
      const t = head - i * 0.04
      if (t <= 0 || progress > 0.65) continue
      const point = along(c, t, 22)
      paint.dot(point.x, point.y, 4, i % 3 ? c.color : c.light)
    }
    const seeds = seedsFor(c, 16)
    const steam = phase(progress, 0.45, 1)
    if (steam > 0 && steam < 1) {
      for (let i = 0; i < 8; i += 1) {
        const t = (steam + seeds[i] * 0.5) % 1
        orb(paint, { x: c.target.x - 20 + seeds[i + 8] * 40, y: c.target.y + 10 - t * 40 }, 3 + Math.round(t * 2), '#e0e8f0', '#ffffff')
      }
    }
  },
  shake: shakeTarget(0.45, 0.8),
}

/** Paz Mental: ondas en elipse que suben despacio desde la cabeza del usuario. */
const calmmind: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    for (let i = 0; i < 3; i += 1) {
      const t = (progress * 1.2 + i / 3) % 1
      const center = { x: c.user.x, y: c.user.y - 18 - t * 26 }
      for (let k = 0; k < 18; k += 1) {
        const angle = (k / 18) * Math.PI * 2
        paint.dot(center.x + Math.cos(angle) * (8 + t * 20), center.y + Math.sin(angle) * (3 + t * 6), 2, t < 0.5 ? c.color : c.light)
      }
    }
  },
}

/** Gigadrenado: orbes verdes salen del objetivo y vuelven en arco al usuario, que brilla. */
const gigadrain: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    for (let i = 0; i < 6; i += 1) {
      const t = phase(progress, 0.1 + i * 0.06, 0.55 + i * 0.06)
      if (t <= 0 || t >= 1) continue
      orb(paint, along({ ...c, user: c.target, target: c.user }, t, (i % 2 ? 1 : -1) * 18), 4, c.color, c.light)
    }
    const glow = phase(progress, 0.7, 1)
    if (glow > 0 && glow < 1) ring(paint, c.user, 8 + glow * 18, c.light, 3, 14)
  },
}

/** Retribución: un corazón sobre el usuario y una estrella que estalla en el objetivo. */
const returnFx: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    if (progress < 0.4) {
      const lift = phase(progress, 0, 0.4) * 10
      for (const [row, line] of ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'].entries()) {
        for (let x = 0; x < line.length; x += 1) if (line[x] === '#') paint.dot(c.user.x - 10 + x * 3, c.user.y - 44 - lift + row * 3, 3, row === 0 ? '#f8b0c8' : '#f86890')
      }
    }
    const t = phase(progress, 0.4, 0.9)
    if (t > 0 && t < 1) star(paint, c.target, 6 + t * 18, t < 0.5 ? '#f8f8c8' : c.light)
    burst(paint, c.target, phase(progress, 0.45, 0.95), c.color, '#f8f8c8', 8, 30)
  },
  shake: shakeTarget(0.4, 0.85),
}

/** Tijera X: dos tajos que se cruzan en X y un destello en el cruce. */
const xscissor: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    const t = phase(progress, 0.05, 0.4)
    if (t > 0 && progress < 0.7) {
      beam(paint, { x: c.target.x - 26, y: c.target.y - 26 }, { x: c.target.x + 26, y: c.target.y + 26 }, t, c.color, c.light, 4)
      beam(paint, { x: c.target.x + 26, y: c.target.y - 26 }, { x: c.target.x - 26, y: c.target.y + 26 }, t, c.color, c.light, 4)
    }
    if (inPhase(progress, 0.4, 0.6)) orb(paint, c.target, 9, '#f8f8f8', '#ffffff')
    burst(paint, c.target, phase(progress, 0.45, 0.9), c.color, c.light, 4, 34)
  },
  shake: shakeTarget(0.35, 0.8),
}

/** Corpulencia: el usuario se hincha y salen de él pulsos naranjas (las flechas, con el mensaje). */
const bulkup: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    for (let k = 0; k < 3; k += 1) {
      const t = phase(progress, k * 0.25, k * 0.25 + 0.35)
      if (t > 0 && t < 1) ring(paint, c.user, 14 + t * 22, k % 2 ? '#f8c060' : '#f88830', 3, 18)
    }
  },
  shake: (progress) => (inPhase(progress, 0.1, 0.8) ? { who: 'user', dx: 0, dy: Math.round(Math.sin(progress * 40) * 2) } : null),
}

/** Rayo Señal: un haz de luces de colores que parpadean hasta el objetivo. */
const signalbeam: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const colors = ['#f85050', '#f8e050', '#50d850', '#5090f8']
    const t = phase(progress, 0.05, 0.5)
    if (progress < 0.75) {
      const length = Math.hypot(c.target.x - c.user.x, c.target.y - c.user.y)
      const steps = Math.floor((length * t) / 5)
      for (let i = 0; i <= steps; i += 1) {
        const point = lerpPoint(c.user, c.target, (i * 5) / length)
        paint.dot(point.x - 2, point.y - 2, 5, colors[(i + Math.floor(progress * 16)) % colors.length])
      }
    }
    for (let i = 0; i < 4; i += 1) burst(paint, c.target, phase(progress, 0.5 + i * 0.05, 0.85 + i * 0.03), colors[i], '#ffffff', 4, 20 + i * 4)
  },
  shake: shakeTarget(0.45, 0.85),
}

/** Llama fatua: una lengua de fuego pequeña que parpadea. */
function wisp(paint: Painter, center: Point, frame: number, color: string, light: string): void {
  const rows = frame % 2 ? ['..#..', '.##..', '.###.', '#####', '.###.'] : ['..#..', '..##.', '.###.', '#####', '.###.']
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) if (row[x] === '#') paint.dot(center.x + (x - 2) * 2, center.y + (y - 3) * 2, 2, y < 2 ? light : color)
  })
}

/** Fuego Fatuo: tres llamas azuladas flotan ondulando hasta el objetivo y lo rodean. */
const willowisp: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const frame = Math.floor(progress * 16)
    const travel = phase(progress, 0, 0.5)
    const orbit = phase(progress, 0.5, 1)
    for (let i = 0; i < 3; i += 1) {
      let point: Point
      if (orbit === 0) {
        const base = along(c, Math.max(0, travel - i * 0.08))
        point = { x: base.x, y: base.y + Math.sin(travel * 14 + i * 2) * 8 }
      } else {
        const angle = orbit * Math.PI * 3 + (i / 3) * Math.PI * 2
        point = { x: c.target.x + Math.cos(angle) * 28, y: c.target.y + Math.sin(angle) * 12 }
      }
      if (progress < 0.95) wisp(paint, point, frame + i, '#5878f0', '#a8c8f8')
    }
  },
}

/** Megacuerno: un cuerno enorme carga desde el usuario y embiste al objetivo. */
const megahorn: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const travel = phase(progress, 0.05, 0.5)
    if (progress < 0.55) {
      const tip = lerpPoint(c.user, c.target, travel)
      const length = Math.hypot(c.target.x - c.user.x, c.target.y - c.user.y)
      const ux = (c.target.x - c.user.x) / length
      const uy = (c.target.y - c.user.y) / length
      for (let k = 0; k < 10; k += 1) {
        const back = { x: tip.x - ux * k * 3, y: tip.y - uy * k * 3 }
        const half = Math.round(k / 2)
        for (let w = -half; w <= half; w += 1) paint.dot(back.x - uy * w * 2, back.y + ux * w * 2, 3, k < 3 ? '#f8f8f0' : c.light)
      }
    }
    burst(paint, c.target, phase(progress, 0.5, 0.95), c.color, c.light, 12, 36)
  },
  shake: shakeTarget(0.5, 0.9, 4),
}

/** Voltio Cruel: el usuario se carga de chispas y una corriente envuelve al objetivo; el usuario acusa el retroceso. */
const wildcharge: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 16)
    if (progress < 0.4 && Math.floor(progress * 24) % 2) {
      for (let i = 0; i < 8; i += 1) paint.dot(c.user.x - 24 + seeds[i] * 48, c.user.y - 22 + seeds[i + 8] * 44, 3, i % 2 ? c.light : '#f8f8f8')
    }
    const t = phase(progress, 0.4, 0.8)
    if (t > 0 && t < 1 && Math.floor(progress * 20) % 3) {
      let from = { x: c.target.x + 30, y: c.target.y }
      for (let k = 1; k <= 12; k += 1) {
        const angle = (k / 12) * Math.PI * 2
        const radius = k % 2 ? 22 : 32
        const to = { x: c.target.x + Math.cos(angle) * radius, y: c.target.y + Math.sin(angle) * radius * 0.7 }
        beam(paint, from, to, 1, c.color, c.light, 3)
        from = to
      }
    }
  },
  shake: (progress) => (progress < 0.4 ? null : progress < 0.8 ? shakeTarget(0.4, 0.8, 3)(progress) : progress < 0.95 ? { who: 'user', dx: Math.round(Math.sin(progress * 80) * 2), dy: 0 } : null),
}

/** Acróbata: estelas blancas que cruzan el objetivo en todas direcciones, muy rápidas. */
const acrobatics: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    for (let k = 0; k < 5; k += 1) {
      const t = phase(progress, k * 0.13, k * 0.13 + 0.22)
      if (t <= 0 || t >= 1) continue
      const angle = k * 2.3
      const from = { x: c.target.x + Math.cos(angle) * 34, y: c.target.y + Math.sin(angle) * 26 }
      const to = { x: c.target.x - Math.cos(angle) * 34, y: c.target.y - Math.sin(angle) * 26 }
      beam(paint, from, to, t, '#f8f8f8', c.light, 3)
    }
    burst(paint, c.target, phase(progress, 0.7, 1), c.color, c.light, 6, 22)
  },
  shake: shakeTarget(0.1, 0.9),
}

/** Onda Trueno: una onda eléctrica débil llega al objetivo y lo deja rodeado de chispas que crepitan. */
const thunderwave: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    for (let i = 0; i < 3; i += 1) {
      const t = phase(progress, i * 0.08, i * 0.08 + 0.45)
      if (t > 0 && t < 1) ring(paint, along(c, t), 6 + i * 3, i % 2 ? c.light : c.color, 2, 12, progress * 10)
    }
    if (progress > 0.5 && progress < 0.95 && Math.floor(progress * 20) % 2) {
      const seeds = seedsFor(c, 12)
      for (let i = 0; i < 6; i += 1) {
        const angle = seeds[i] * Math.PI * 2
        const from = { x: c.target.x + Math.cos(angle) * 18, y: c.target.y + Math.sin(angle) * 18 }
        beam(paint, from, { x: from.x + 5, y: from.y + 5 }, 1, c.color, c.light, 2)
        beam(paint, { x: from.x + 5, y: from.y + 5 }, { x: from.x, y: from.y + 10 }, 1, c.color, c.light, 2)
      }
    }
  },
}

/** Media luna de aire: arco de puntos orientado hacia donde vuela. */
function crescent(paint: Painter, center: Point, heading: number, radius: number, color: string, light: string): void {
  for (let k = -3; k <= 3; k += 1) {
    const angle = heading + k * 0.35
    paint.dot(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, Math.abs(k) < 2 ? 3 : 2, Math.abs(k) < 2 ? light : color)
  }
}

/** Tajo Aéreo: medias lunas de aire cortante vuelan hacia el objetivo. */
const airslash: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const heading = Math.atan2(c.target.y - c.user.y, c.target.x - c.user.x)
    for (let i = 0; i < 3; i += 1) {
      const t = phase(progress, i * 0.12, i * 0.12 + 0.45)
      if (t > 0 && t < 1) crescent(paint, along(c, t, (i - 1) * 12), heading, 12, c.color, '#f8f8f8')
    }
    burst(paint, c.target, phase(progress, 0.55, 0.95), c.color, '#f8f8f8', 6, 24)
  },
  shake: shakeTarget(0.5, 0.9),
}

/** Cascada: una columna de agua cae sobre el objetivo y salpica. */
const waterfall: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const fall = phase(progress, 0.05, 0.4)
    const end = phase(progress, 0.45, 0.65)
    if (progress < 0.65) {
      const bottom = lerp(-10, c.target.y + 10, fall)
      const top = lerp(-10, c.target.y + 10, end)
      for (let y = top; y < bottom; y += 4) {
        for (let x = -10; x <= 10; x += 5) paint.dot(c.target.x + x + (Math.floor(y / 4) % 2), y, 4, (Math.floor(y / 4) + x / 5 + Math.floor(progress * 20)) % 3 ? c.color : c.light)
      }
    }
    const seeds = seedsFor(c, 20)
    shards(paint, { x: c.target.x, y: c.target.y + 10 }, phase(progress, 0.35, 0.95), seeds, c.light, 34)
  },
  shake: shakeTarget(0.35, 0.8, 3),
}

// ---------- tercera tanda (las 20 siguientes por uso, 23/10/2026, acordada con Jose) ----------

/** Centro de la pantalla de arriba: los movimientos de campo (Danza Lluvia, Espacio Raro) no van sobre nadie. */
const FIELD_CENTER: Point = { x: 128, y: 80 }

/** Mofa: una vena de enfado roja late sobre el objetivo, que se agita. */
const taunt: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    if (progress > 0.92) return
    // Vena de enfado: cuatro ganchos en cruz, que laten.
    const pulse = Math.floor(progress * 8) % 2
    const at = { x: c.target.x + 16, y: c.target.y - 32 }
    const reach = 8 + pulse * 3
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      for (let k = 3; k <= reach; k += 2) paint.dot(at.x + dx * k, at.y + dy * 3, 3, '#e82838')
      for (let k = 3; k <= reach; k += 2) paint.dot(at.x + dx * 3, at.y + dy * k, 3, k + 2 > reach ? '#f8a0a0' : '#e82838')
    }
  },
  shake: (progress) => (inPhase(progress, 0.15, 0.85) ? { who: 'target', dx: 0, dy: Math.round(Math.sin(progress * 50) * 2) } : null),
}

/** Surf: una ola entra por la izquierda, barre el campo y rompe sobre el objetivo. */
const surf: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const front = lerp(-8, 264, phase(progress, 0.05, 0.8))
    const fade = phase(progress, 0.8, 1)
    if (fade >= 1) return
    for (let x = -8; x < front; x += 4) {
      const crest = Math.sin(x * 0.09 + progress * 14) * 6
      const height = 34 - fade * 30 + (front - x < 30 ? (front - x) * 0.6 : 18)
      for (let y = 0; y < height; y += 4) paint.dot(x, c.target.y + 40 - y + crest, 4, y + 4 >= height ? '#f8f8f8' : y > height - 10 ? c.light : c.color)
    }
  },
  shake: shakeTarget(0.45, 0.85, 3),
}

/** Psicocarga: bloques psíquicos aparecen alrededor del objetivo y chocan contra él. */
const psyshock: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const close = phase(progress, 0.3, 0.6)
    for (let i = 0; i < 6; i += 1) {
      if (progress < i * 0.04) continue
      const angle = (i / 6) * Math.PI * 2 + progress * 2
      const radius = 40 * (1 - close) + 6
      const at = { x: c.target.x + Math.cos(angle) * radius, y: c.target.y + Math.sin(angle) * radius * 0.8 }
      if (progress < 0.62) for (let y = -4; y <= 4; y += 2) for (let x = -4; x <= 4; x += 2) paint.dot(at.x + x, at.y + y, 2, Math.abs(x) === 4 || Math.abs(y) === 4 ? c.color : c.light)
    }
    burst(paint, c.target, phase(progress, 0.6, 0.95), c.color, c.light, 10, 28)
  },
  shake: shakeTarget(0.6, 0.9, 3),
}

/** Divide Dolor: un orbe sale de cada uno, se cruzan a medio camino y llegan al otro; los dos se estremecen. */
const painsplit: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const t = phase(progress, 0.1, 0.75)
    if (t > 0 && t < 1) {
      orb(paint, along(c, t, 18), 5, '#a070d0', '#e0c8f8')
      orb(paint, along(c, 1 - t, -18), 5, '#a070d0', '#e0c8f8')
    }
    if (inPhase(progress, 0.4, 0.5)) orb(paint, lerpPoint(c.user, c.target, 0.5), 9, '#e0c8f8', '#ffffff')
    const glow = phase(progress, 0.75, 1)
    if (glow > 0 && glow < 1) {
      ring(paint, c.user, 8 + glow * 18, '#c8a0f0', 2, 12)
      ring(paint, c.target, 8 + glow * 18, '#c8a0f0', 2, 12)
    }
  },
  shake: (progress) => (inPhase(progress, 0.75, 0.95) ? { who: 'screen', dx: Math.round(Math.sin(progress * 80) * 2), dy: 0 } : null),
}

/** Hierba Lazo: hierba que brota a los pies del objetivo, se enrosca y lo derriba. */
const grassknot: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const grow = phase(progress, 0.05, 0.45)
    const tighten = phase(progress, 0.45, 0.7)
    if (progress < 0.85) {
      for (let i = 0; i < 7; i += 1) {
        const x = c.target.x - 24 + i * 8
        const height = grow * (14 + (i % 3) * 6)
        for (let y = 0; y < height; y += 3) {
          const bend = Math.sin(y * 0.3 + i) * 3 + (x < c.target.x ? 1 : -1) * tighten * y * 0.5
          paint.dot(x + bend, c.target.y + 30 - y, 3, y + 3 >= height ? c.light : c.color)
        }
      }
    }
    burst(paint, { x: c.target.x, y: c.target.y + 20 }, phase(progress, 0.65, 0.95), c.color, c.light, 6, 22)
  },
  shake: (progress) => (inPhase(progress, 0.65, 0.9) ? { who: 'target', dx: 0, dy: Math.round(phase(progress, 0.65, 0.9) < 0.5 ? 3 : 1) } : null),
}

/** Voltiocambio: una bola eléctrica golpea al objetivo y una chispa vuelve al usuario (que se retira). */
const voltswitch: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const go = phase(progress, 0.05, 0.4)
    if (go > 0 && go < 1) {
      const at = along(c, go, 10)
      orb(paint, at, 6, '#f8e030', '#f8f8a8')
      for (let k = 0; k < 4; k += 1) paint.dot(at.x + Math.cos(progress * 30 + k * 1.6) * 10, at.y + Math.sin(progress * 30 + k * 1.6) * 10, 2, '#f8f8a8')
    }
    burst(paint, c.target, phase(progress, 0.4, 0.7), '#f8e030', '#f8f8a8', 8, 24)
    const back = phase(progress, 0.6, 0.95)
    if (back > 0 && back < 1) beam(paint, c.target, c.user, back, '#f8e030', '#f8f8a8', 2, 5)
  },
  shake: shakeTarget(0.4, 0.7),
}

/** Lanzallamas: un chorro de fuego continuo que se ensancha al llegar y envuelve al objetivo. */
const flamethrower: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const head = phase(progress, 0.05, 0.4)
    const tail = phase(progress, 0.6, 0.85)
    const length = Math.hypot(c.target.x - c.user.x, c.target.y - c.user.y)
    for (let d = tail * length; d < head * length; d += 4) {
      const t = d / length
      const point = lerpPoint(c.user, c.target, t)
      const width = 2 + Math.round(t * 4)
      for (let w = -width; w <= width; w += 3) {
        const flicker = Math.sin(d * 0.4 + progress * 50 + w) * 2
        paint.dot(point.x + flicker, point.y + w, 3, Math.abs(w) < 2 ? '#f8e050' : Math.abs(w) < 5 ? '#f88830' : '#e04020')
      }
    }
    const engulf = phase(progress, 0.4, 0.95)
    if (engulf > 0 && engulf < 1) {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + progress * 6
        paint.dot(c.target.x + Math.cos(angle) * 18, c.target.y + Math.sin(angle) * 14 - engulf * 6, 4, i % 2 ? '#f8e050' : '#f07030')
      }
    }
  },
  shake: shakeTarget(0.4, 0.9),
}

/** Danza Lluvia: nubes oscuras arriba y lluvia que cae en diagonal por todo el campo. */
const raindance: Effect = {
  duration: 1000,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 80)
    const clouds = phase(progress, 0, 0.3)
    for (let i = 0; i < 8; i += 1) orb(paint, { x: 16 + i * 32, y: -6 + clouds * 14 + (i % 2) * 4 }, 9, '#586070', '#8890a0')
    const rain = phase(progress, 0.2, 1)
    if (rain <= 0) return
    for (let i = 0; i < 40; i += 1) {
      const x = (seeds[i] * 280 + rain * 60) % 264
      const y = 14 + ((seeds[i + 40] * 170 + rain * 420) % 170)
      for (let k = 0; k < 3; k += 1) paint.dot(x - k, y + k * 2, 1, '#a8c8f8')
    }
  },
}

/** Pájaro Osado: el usuario se lanza envuelto en un aura azul con alas abiertas y embiste; el retroceso lo sacude también. */
const bravebird: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    const t = phase(progress, 0.05, 0.5)
    if (t > 0 && t < 1) {
      const at = along(c, t, 6)
      const heading = Math.atan2(c.target.y - c.user.y, c.target.x - c.user.x)
      orb(paint, at, 10, '#4870f0', '#c8d8f8')
      for (const side of [-1, 1]) crescent(paint, { x: at.x - Math.cos(heading) * 8, y: at.y + side * 10 }, heading + Math.PI + side * 0.9, 16, '#4870f0', '#f8f8f8')
      for (let k = 1; k < 5; k += 1) paint.dot(at.x - Math.cos(heading) * k * 8, at.y - Math.sin(heading) * k * 8, 3, k % 2 ? '#88a8f8' : '#f8f8f8')
    }
    burst(paint, c.target, phase(progress, 0.5, 0.9), '#4870f0', '#f8f8f8', 10, 30)
  },
  shake: (progress) =>
    inPhase(progress, 0.5, 0.75) ? { who: 'target', dx: Math.round(Math.sin(progress * 90) * 3), dy: 0 } : inPhase(progress, 0.75, 0.9) ? { who: 'user', dx: Math.round(Math.sin(progress * 90) * 2), dy: 0 } : null,
}

/** Somnífero: polvo azul verdoso que cae en nube sobre el objetivo. */
const sleeppowder: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 48)
    for (let i = 0; i < 24; i += 1) {
      const t = phase(progress, seeds[i] * 0.35, seeds[i] * 0.35 + 0.6)
      if (t <= 0 || t >= 1) continue
      const x = c.target.x - 26 + seeds[i + 24] * 52 + Math.sin(t * 9 + i) * 4
      const y = c.target.y - 50 + t * 70
      paint.dot(x, y, 2, i % 3 ? '#68c8a8' : '#c8f8e8')
    }
  },
}

/** Descanso: el usuario se echa a dormir (zetas) y una luz verde lo cura. */
const rest: Effect = {
  duration: 1000,
  draw(paint, progress, c) {
    for (let i = 0; i < 3; i += 1) {
      const t = phase(progress, i * 0.15, i * 0.15 + 0.55)
      if (t > 0 && t < 1) sleepZ(paint, { x: c.user.x + 10 + t * 16, y: c.user.y - 24 - t * 24 }, 2 + Math.round(t), '#f8f8f8')
    }
    const glow = phase(progress, 0.5, 1)
    if (glow > 0 && glow < 1) ring(paint, c.user, 10 + glow * 20, glow < 0.5 ? '#78f878' : '#c8f8c8', 3, 14, progress * 3)
  },
}

/** Hipnosis: ondas en anillo salen del usuario y se cierran sobre el objetivo, que se balancea. */
const hypnosis: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    for (let i = 0; i < 4; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.55)
      if (t <= 0 || t >= 1) continue
      ring(paint, along(c, t), 6 + Math.sin(t * Math.PI) * 10, i % 2 ? '#c878e8' : '#f8c8f8', 2, 14, t * 3)
    }
  },
  shake: (progress) => (inPhase(progress, 0.6, 0.95) ? { who: 'target', dx: Math.round(Math.sin(progress * 14) * 3), dy: 0 } : null),
}

/** Púas: puñados de púas vuelan en arco y se clavan en el suelo del rival. */
const spikes: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    for (let i = 0; i < 4; i += 1) {
      const t = phase(progress, i * 0.1, i * 0.1 + 0.55)
      if (t <= 0) continue
      const landing = { x: c.target.x - 30 + i * 20, y: c.target.y + 30 }
      const at = t >= 1 ? landing : { x: lerp(c.user.x, landing.x, t), y: lerp(c.user.y, landing.y, t) - Math.sin(t * Math.PI) * 40 }
      // Abrojo: una púa alta en el centro y dos más bajas a los lados.
      for (let k = 0; k < 3; k += 1) paint.dot(at.x - 3, at.y - k * 3, 3, k === 2 ? '#e8e0c8' : '#a09078')
      paint.dot(at.x - 8, at.y, 3, '#a09078')
      paint.dot(at.x + 2, at.y, 3, '#a09078')
    }
  },
}

/** Espacio Raro: una cuadrícula rosa se despliega por todo el campo y se tuerce. */
const trickroom: Effect = {
  duration: 1000,
  draw(paint, progress) {
    const open = phase(progress, 0, 0.4)
    const fade = phase(progress, 0.8, 1)
    if (fade >= 1) return
    const half = { x: 120 * open, y: 70 * open }
    const twist = Math.sin(progress * Math.PI) * 6
    for (let k = -4; k <= 4; k += 1) {
      for (let s = -1; s <= 1; s += 0.08) {
        const color = (k + Math.floor(progress * 10)) % 2 ? '#f878c8' : '#f8c8e8'
        paint.dot(FIELD_CENTER.x + (k / 4) * half.x + s * twist, FIELD_CENTER.y + s * half.y, 2, color)
        paint.dot(FIELD_CENTER.x + s * half.x, FIELD_CENTER.y + (k / 4) * half.y + s * twist, 2, color)
      }
    }
  },
}

/** Puño Drenaje: un puño verde golpea y orbes de energía vuelven al usuario. */
const drainpunch: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const approach = phase(progress, 0.05, 0.35)
    if (progress < 0.4) fist(paint, c.target, 1 + approach * 3, '#58c058', '#b8f8a8')
    burst(paint, c.target, phase(progress, 0.35, 0.6), '#58c058', '#b8f8a8', 8, 24)
    for (let i = 0; i < 5; i += 1) {
      const t = phase(progress, 0.5 + i * 0.06, 0.8 + i * 0.04)
      if (t > 0 && t < 1) orb(paint, along({ ...c, user: c.target, target: c.user }, t, 14 + i * 4), 3, '#78f878', '#e0f8e0')
    }
  },
  shake: shakeTarget(0.35, 0.6, 3),
}

/** Tajo Umbrío: un tajo oscuro en media luna cruza al objetivo de un solo golpe. */
const nightslash: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    const t = phase(progress, 0.1, 0.45)
    if (t > 0 && progress < 0.6) {
      for (let k = 0; k < Math.floor(t * 20); k += 1) {
        const angle = -2.6 + k * 0.13
        for (const [radius, size, color] of [[34, 5, '#483858'], [30, 3, '#c8b8e8']] as const) {
          paint.dot(c.target.x + 12 + Math.cos(angle) * radius, c.target.y + 10 + Math.sin(angle) * radius, size, color)
        }
      }
    }
    burst(paint, c.target, phase(progress, 0.45, 0.85), '#483858', '#c8b8e8', 8, 26)
  },
  shake: shakeTarget(0.4, 0.75, 3),
}

/** Recuperación: destellos de luz convergen en el usuario, que brilla. */
const recover: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    const gather = phase(progress, 0, 0.6)
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + progress * 3
      const radius = 40 * (1 - gather) + 4
      if (gather < 1) star(paint, { x: c.user.x + Math.cos(angle) * radius, y: c.user.y + Math.sin(angle) * radius }, 3, i % 2 ? '#f8f8c8' : '#c8f8c8')
    }
    const glow = phase(progress, 0.55, 1)
    if (glow > 0 && glow < 1) orb(paint, c.user, Math.round(4 + glow * 12), glow < 0.5 ? '#c8f8c8' : '#78f878', '#ffffff')
  },
}

/** Giro Bola: una rueda de acero girando rueda hasta el objetivo y lo golpea. */
const gyroball: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const t = phase(progress, 0.05, 0.5)
    if (t > 0 && t < 1) {
      const at = along(c, t, 4)
      ring(paint, at, 15, '#a0a8b8', 4, 16, progress * 25)
      ring(paint, at, 11, '#d8e0e8', 2, 12, -progress * 25)
      for (let k = 0; k < 4; k += 1) {
        const angle = progress * 25 + (k / 4) * Math.PI * 2
        beam(paint, at, { x: at.x + Math.cos(angle) * 12, y: at.y + Math.sin(angle) * 12 }, 1, '#d8e0e8', '#f8f8f8', 3)
      }
    }
    burst(paint, c.target, phase(progress, 0.5, 0.9), '#a0a8b8', '#f8f8f8', 8, 28)
  },
  shake: shakeTarget(0.5, 0.85, 3),
}

/** Trueno: un rayo enorme cae del cielo sobre el objetivo, con destellos, y retumba toda la pantalla. */
const thunder: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const strike = inPhase(progress, 0.15, 0.7) && Math.floor(progress * 24) % 4 !== 0
    if (strike) {
      let x = c.target.x
      for (let y = -8; y < c.target.y; y += 10) {
        const next = x + (Math.floor(y / 10) % 2 ? 12 : -12)
        beam(paint, { x, y }, { x: next, y: y + 10 }, 1, '#f8e030', '#f8f8f8', 6)
        if (Math.floor(y / 10) % 3 === 1) beam(paint, { x: next, y: y + 10 }, { x: next + 16, y: y + 24 }, 1, '#f8e030', '#f8f8a8', 3)
        x = next
      }
    }
    if (inPhase(progress, 0.15, 0.25)) orb(paint, c.target, 16, '#f8f8a8', '#ffffff')
    burst(paint, c.target, phase(progress, 0.3, 0.85), '#f8e030', '#f8f8a8', 12, 36)
  },
  shake: (progress) => (inPhase(progress, 0.2, 0.8) ? { who: 'screen', dx: Math.round(Math.sin(progress * 70) * 2), dy: Math.round(Math.cos(progress * 55) * 2) } : null),
}

/** Cabezazo Zen: el usuario se rodea de un aura psíquica y embiste de cabeza; estalla en estrellas rosas. */
const zenheadbutt: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const charge = phase(progress, 0, 0.25)
    if (charge > 0 && charge < 1) ring(paint, c.user, 22 - charge * 10, '#f878c8', 3, 14, progress * 8)
    const t = phase(progress, 0.25, 0.55)
    if (t > 0 && t < 1) {
      const at = along(c, t, 8)
      ring(paint, at, 10, '#f878c8', 3, 12, progress * 10)
      orb(paint, at, 4, '#f8c8e8', '#ffffff')
    }
    const hit = phase(progress, 0.55, 0.95)
    if (hit > 0 && hit < 1) for (let i = 0; i < 5; i += 1) star(paint, { x: c.target.x + Math.cos(i * 1.26) * hit * 30, y: c.target.y + Math.sin(i * 1.26) * hit * 24 }, 4, i % 2 ? '#f878c8' : '#f8c8e8')
  },
  shake: shakeTarget(0.55, 0.85, 3),
}

// ---------- estados y objetos (sobre el Pokémon que los sufre: `user` y `target` son él; decisiones de Jose del 23/10/2026) ----------

/** Quemado: llamas que suben por el Pokémon, que se encoge de dolor. */
const burned: Effect = {
  duration: 800,
  draw(paint, progress, c) {
    const seeds = seedsFor(c, 16)
    for (let i = 0; i < 6; i += 1) {
      const t = phase(progress, seeds[i] * 0.4, seeds[i] * 0.4 + 0.55)
      if (t <= 0 || t >= 1) continue
      const x = c.target.x - 22 + seeds[i + 6] * 44
      const height = 8 + Math.round(seeds[i + 10 > 15 ? i : i + 10] * 8)
      for (let y = 0; y < height; y += 3) {
        const color = y > height - 4 ? '#f8e050' : y > height / 2 ? '#f88830' : '#e04020'
        paint.dot(x + Math.round(Math.sin(y + progress * 30)), c.target.y + 20 - t * 34 - y, 3, color)
      }
    }
  },
  shake: shakeTarget(0.1, 0.7),
}

/** Paralizado: chispas amarillas que crepitan alrededor del Pokémon, que se queda rígido y tiembla. */
const paralyzed: Effect = {
  duration: 750,
  draw(paint, progress, c) {
    if (Math.floor(progress * 20) % 3 === 2 || progress > 0.9) return
    const seeds = seedsFor(c, 12)
    for (let i = 0; i < 4; i += 1) {
      const angle = seeds[i] * Math.PI * 2 + Math.floor(progress * 6)
      let from = { x: c.target.x + Math.cos(angle) * 24, y: c.target.y + Math.sin(angle) * 20 }
      for (let k = 0; k < 3; k += 1) {
        const to = { x: from.x + (k % 2 ? -5 : 5), y: from.y + 6 }
        beam(paint, from, to, 1, '#f8e030', '#f8f8a8', 2)
        from = to
      }
    }
  },
  shake: (progress) => (progress < 0.85 ? { who: 'target', dx: Math.round(Math.sin(progress * 120)), dy: 0 } : null),
}

/** Letra Z en píxel. */
function sleepZ(paint: Painter, at: Point, size: number, color: string): void {
  for (let i = 0; i < 4; i += 1) {
    paint.dot(at.x + i * size, at.y, size, color)
    paint.dot(at.x + i * size, at.y + 3 * size, size, color)
    paint.dot(at.x + (3 - i) * size, at.y + i * size, size, color)
  }
}

/** Dormido: zetas que salen de la cabeza y suben meciéndose. */
const asleep: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    for (let i = 0; i < 3; i += 1) {
      const t = phase(progress, i * 0.2, i * 0.2 + 0.6)
      if (t <= 0 || t >= 1) continue
      sleepZ(paint, { x: c.target.x + 10 + t * 18 + Math.sin(t * 7) * 3, y: c.target.y - 22 - t * 26 }, 2 + Math.round(t), t < 0.7 ? '#f8f8f8' : '#a8b8f8')
    }
  },
}

/** Congelado: cristales de hielo que encierran al Pokémon y brillan. */
const frozen: Effect = {
  duration: 850,
  draw(paint, progress, c) {
    const grow = phase(progress, 0, 0.45)
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2
      const radius = 30 - grow * 8
      diamond(paint, { x: c.target.x + Math.cos(angle) * radius, y: c.target.y + Math.sin(angle) * radius * 0.8 }, 2 + Math.round(grow * 3), '#98d8f8', '#f8f8f8')
    }
    if (inPhase(progress, 0.5, 0.65)) orb(paint, c.target, 10, '#c8f0f8', '#ffffff')
  },
  shake: shakeTarget(0.45, 0.7),
}

/** Confuso: pájaros (estrellitas) que giran sobre la cabeza; el Pokémon se tambalea. */
const confused: Effect = {
  duration: 900,
  draw(paint, progress, c) {
    if (progress > 0.92) return
    for (let i = 0; i < 3; i += 1) {
      const angle = progress * Math.PI * 4 + (i / 3) * Math.PI * 2
      star(paint, { x: c.target.x + Math.cos(angle) * 20, y: c.target.y - 30 + Math.sin(angle) * 6 }, 4, i % 2 ? '#f8e050' : '#f8f8c8')
    }
  },
  shake: (progress) => (progress < 0.85 ? { who: 'target', dx: Math.round(Math.sin(progress * 18) * 3), dy: 0 } : null),
}

/** Baya en píxel con un mordisco de `bites` (0 entera, 3 casi comida). */
function berryArt(paint: Painter, center: Point, bites: number): void {
  const rows = ['...##...', '..####..', '.######.', '########', '########', '.######.', '..####..']
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== '#' || x >= 8 - bites * 2) continue
      paint.dot(center.x + (x - 4) * 2, center.y + (y - 3) * 2, 2, y < 2 ? '#f8a8b8' : '#e83858')
    }
  })
  if (bites < 3) paint.dot(center.x - 1, center.y - 10, 2, '#48b048')
}

/** Baya que sube una característica: aparece sobre el Pokémon, se la come a bocados y le suben las flechas rojas. */
const berry: Effect = {
  duration: 1000,
  draw(paint, progress, c) {
    if (progress < 0.5) berryArt(paint, { x: c.target.x, y: c.target.y - 34 }, Math.floor(phase(progress, 0.15, 0.5) * 4))
    const rise = phase(progress, 0.5, 1)
    if (rise > 0 && rise < 1) statUp.draw(paint, rise, c)
  },
}

/** Maldición: sin ser Fantasma, un aura oscura sobre el usuario (las subidas y la bajada salen con sus mensajes); siendo Fantasma, un clavo maldito cae sobre el objetivo. */
const curse: Effect = {
  duration: 950,
  draw(paint, progress, c) {
    const self = c.user.x === c.target.x && c.user.y === c.target.y
    if (self) {
      // Las flechas de subir y bajar van con sus mensajes: aquí, un aura oscura que se cierra sobre el usuario.
      for (let k = 0; k < 3; k += 1) {
        const t = phase(progress, k * 0.2, k * 0.2 + 0.5)
        if (t > 0 && t < 1) ring(paint, c.user, 30 - t * 20, k % 2 ? '#9870c8' : '#583878', 3, 16, progress * 3)
      }
      return
    }
    const fall = phase(progress, 0.1, 0.5)
    if (progress < 0.75) {
      const tip = { x: c.target.x, y: lerp(c.target.y - 70, c.target.y - 6, fall) }
      for (let y = 0; y < 22; y += 2) paint.dot(tip.x - 1, tip.y - y, 3, y < 4 ? '#d0d0e0' : '#787088')
      for (let x = -4; x <= 4; x += 2) paint.dot(tip.x + x, tip.y - 22, 3, '#9870c8')
    }
    burst(paint, c.target, phase(progress, 0.5, 0.9), '#583878', '#9870c8', 8, 26)
  },
  shake: (progress) => (progress > 0.5 && progress < 0.9 ? { who: 'target', dx: Math.round(Math.sin(progress * 90) * 2), dy: 0 } : null),
}

/** Estados (`status:<id>`), bayas (`item:berry`) y cambios de características (`stat:up`, `stat:down`): se animan con su mensaje sobre quien los sufre. */
export const CONDITION_EFFECTS: Record<string, Effect> = {
  'status:brn': burned,
  'status:psn': toxic,
  'status:par': paralyzed,
  'status:slp': asleep,
  'status:frz': frozen,
  'status:confusion': confused,
  'item:berry': berry,
  'stat:up': statUp,
  'stat:down': statDown,
}

/** Los movimientos con animación propia: los 60 más usados entre rivales y pool del jugador (tres tandas de 20, 22 y 23/10/2026) y Maldición. */
export const CUSTOM_EFFECTS: Record<string, Effect> = {
  earthquake,
  stoneedge,
  psychic,
  focusblast,
  rockslide,
  icebeam,
  thunderbolt,
  swordsdance,
  shadowball,
  hiddenpower,
  stealthrock,
  uturn,
  fireblast,
  substitute,
  hydropump,
  suckerpunch,
  toxic,
  superpower,
  protect,
  icepunch,
  outrage,
  crunch,
  closecombat,
  earthpower,
  blizzard,
  roost,
  scald,
  calmmind,
  gigadrain,
  return: returnFx,
  xscissor,
  bulkup,
  signalbeam,
  willowisp,
  megahorn,
  wildcharge,
  acrobatics,
  thunderwave,
  airslash,
  waterfall,
  curse,
  taunt,
  surf,
  psyshock,
  painsplit,
  grassknot,
  voltswitch,
  flamethrower,
  raindance,
  bravebird,
  sleeppowder,
  rest,
  hypnosis,
  spikes,
  trickroom,
  drainpunch,
  nightslash,
  recover,
  gyroball,
  thunder,
  zenheadbutt,
}

/**
 * Efecto de un movimiento: el propio si lo tiene (Poder Oculto de cualquier tipo usa el suyo); si no, los especiales según su tipo y el
 * resto según su clase.
 */
export function effectFor(moveId: string, kind: FxKind, type?: string): Effect {
  const condition = CONDITION_EFFECTS[moveId]
  if (condition) return condition
  const custom = CUSTOM_EFFECTS[moveId.startsWith('hiddenpower') ? 'hiddenpower' : moveId]
  if (custom) return custom
  if (kind === 'shot' && type && SPECIAL_BY_TYPE[type]) return SPECIAL_BY_TYPE[type]
  return GENERIC_EFFECTS[kind]
}

/** Movimientos que se animan sobre el propio usuario (el «objetivo» es él mismo). */
export const SELF_KINDS: ReadonlySet<FxKind> = new Set(['boost', 'heal', 'protect', 'substitute', 'screen', 'self'])
