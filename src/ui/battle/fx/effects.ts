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

export type FxKind = 'hit' | 'shot' | 'boost' | 'drop' | 'status' | 'heal' | 'protect' | 'substitute' | 'weather' | 'hazard' | 'screen' | 'self' | 'foe'

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

/** Sube características: flechas que suben alrededor del usuario. */
const boost: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    for (let i = 0; i < 5; i += 1) {
      const t = (progress * 1.6 + i * 0.2) % 1
      const x = c.user.x - 28 + i * 14
      const y = c.user.y + 22 - t * 50
      for (let k = 0; k < 6; k += 1) {
        paint.dot(x - k, y + k, 3, '#f85848')
        paint.dot(x + k, y + k, 3, '#f85848')
      }
    }
  },
}

/** Baja características del rival: flechas azules que caen sobre el objetivo. */
const drop: Effect = {
  duration: 700,
  draw(paint, progress, c) {
    for (let i = 0; i < 5; i += 1) {
      const t = (progress * 1.6 + i * 0.2) % 1
      const x = c.target.x - 28 + i * 14
      const y = c.target.y - 28 + t * 50
      for (let k = 0; k < 6; k += 1) {
        paint.dot(x - k, y - k, 3, '#4890f8')
        paint.dot(x + k, y - k, 3, '#4890f8')
      }
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

/** Los 20 movimientos con animación propia (los más usados entre rivales y pool del jugador, 22/10/2026). */
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
}

/** Efecto de un movimiento: el propio si lo tiene (Poder Oculto de cualquier tipo usa el suyo), si no el genérico de su clase. */
export function effectFor(moveId: string, kind: FxKind): Effect {
  return CUSTOM_EFFECTS[moveId.startsWith('hiddenpower') ? 'hiddenpower' : moveId] ?? GENERIC_EFFECTS[kind]
}

/** Movimientos que se animan sobre el propio usuario (el «objetivo» es él mismo). */
export const SELF_KINDS: ReadonlySet<FxKind> = new Set(['boost', 'heal', 'protect', 'substitute', 'screen', 'self'])
