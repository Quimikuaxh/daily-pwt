/**
 * Evoluciones de la Liga (D7, opción A aprobada el 11/11/2026): qué miembros evolucionan y a qué formas finales (las del núcleo,
 * `leagueEvolutionTargets`), y la secuencia de mensajes de la escena por miembro. Los de una forma no preguntan; los de varias, sí.
 */
import { leagueEvolutionTargets, type CampaignDefinition, type CampaignState } from '../../core/nuzlocke/campaign'
import emeraldSprites from '../../generated/emerald/sprites.json'

export type LeagueEvolution = { id: string; species: string; level: number; targets: string[] }

/** Miembros vivos que cambian de forma en la Liga, en el orden de la campaña. */
export function leagueEvolutions(definition: CampaignDefinition, state: CampaignState): LeagueEvolution[] {
  return state.members.flatMap((member) => {
    if (member.fainted) return []
    const targets = leagueEvolutionTargets(definition, member.species)
    if (!targets.length || (targets.length === 1 && targets[0] === member.species)) return []
    return [{ id: member.id, species: member.species, level: member.level, targets }]
  })
}

/** Paso de la escena de un miembro: anuncio, pregunta (si hay varias formas) y resultado. */
export type EvolutionStep = 'evolving' | 'choose' | 'animating' | 'evolved'
export const firstStep: EvolutionStep = 'evolving'
export const nextStep = (step: EvolutionStep, choices: number): EvolutionStep | null =>
  step === 'evolving' ? (choices > 1 ? 'choose' : 'animating') : step === 'choose' || step === 'animating' ? (step === 'choose' ? 'animating' : 'evolved') : null

/** Forma elegida por miembro (id → especie). */
export type EvolutionChoices = Record<string, string>

/** Ancho en teselas de la ventana de formas: letras del nombre más largo + 2, como los menús del juego. */
export const optionsWidth = (names: readonly string[]): number => Math.max(...names.map((name) => [...name].length)) + 2

/**
 * Animación de evolución, en fotogramas de 60 Hz (evolution_scene.c y evolution_graphics.c). El fondo recorre los pasos de paleta de
 * sBgAnim_PaletteControl (inicio, fin, vueltas, espera) tras 20 fotogramas en negro; cada paso dura su espera + 2 fotogramas.
 */
const PALETTE_CONTROL: readonly [number, number, number, number][] = [[0, 12, 1, 6], [13, 36, 5, 2], [13, 24, 1, 2], [37, 49, 1, 6]]

/** Paso de paleta del fondo en cada fotograma (−1: aún en negro). */
export function backgroundRows(): number[] {
  const rows: number[] = Array(20).fill(-1)
  for (const [start, end, cycles, delay] of PALETTE_CONTROL) {
    for (let cycle = 0; cycle < cycles; cycle++) {
      for (let row = start; row < end; row++) rows.push(...Array(delay + 2).fill(row))
    }
  }
  return rows
}

const MAX_SCALE = 256
const MIN_SCALE = 16

/**
 * Escalas (sobre 256) de las siluetas blancas de la forma actual y la nueva en cada fotograma: una crece mientras la otra encoge y
 * se alternan, cada vez más deprisa (la velocidad empieza en 8 y sube 2 por vuelta hasta 128), como CycleEvolutionMonSprite.
 */
export function silhouetteFrames(): [number, number][] {
  const frames: [number, number][] = []
  let pre = MAX_SCALE
  let post = MIN_SCALE
  let showingPost = false
  for (let speed = 10; speed <= 128; speed += 2) {
    showingPost = !showingPost
    let done = false
    while (!done) {
      const grow = (value: number) => (value < MAX_SCALE - speed ? value + speed : MAX_SCALE)
      const shrink = (value: number) => (value > MIN_SCALE + speed ? value - speed : MIN_SCALE)
      if (showingPost) { post = grow(post); pre = shrink(pre) } else { pre = grow(pre); post = shrink(post) }
      frames.push([pre, post])
      done = (showingPost ? post === MAX_SCALE && pre === MIN_SCALE : pre === MAX_SCALE && post === MIN_SCALE)
    }
  }
  return frames
}

/**
 * Fases de la animación en fotogramas (Task_EvolutionScene): espiral de destellos hacia arriba mientras el Pokémon se vuelve blanco
 * (EvolutionSparkles_SpiralUpward, 64 fotogramas creando y 96 de espera), arco de destellos hacia abajo (ArcDown, 96), siluetas
 * alternándose (CycleEvolutionMonSprite), círculo de destellos hacia dentro (CircleInward, 48) y lluvia de destellos con destello blanco
 * (SprayAndFlash, 128). El fondo animado empieza con la espiral.
 */
const SILHOUETTES = silhouetteFrames()
export const EVOLUTION_PHASES = (() => {
  const arc = 162
  const cycle = arc + 97
  const circle = cycle + SILHOUETTES.length
  const spray = circle + 49
  return { arc, cycle, circle, spray, end: spray + 129 }
})()
export const evolutionLength = (): number => EVOLUTION_PHASES.end

/** Destello de 8 x 8 (evo_sparkle.png) centrado en (x,y), con su escala (las matrices sEvoSparkleMatrices). */
export type Sparkle = { x: number; y: number; scale: number }

/** Tabla de senos del juego (gSineTable: el seno en Q8.8 truncado) y Sin/Cos de trig.c. */
const sine = (index: number) => Math.trunc(Math.sin(((index & 0xff) * Math.PI) / 128) * 256)
const sin = (index: number, amplitude: number) => Math.floor((amplitude * sine(index)) / 256)
const cos = (index: number, amplitude: number) => sin((index & 0xff) + 64, amplitude)
/** Escala de las matrices 20–31 (0x3C0 … 0x100 sobre 0x100). */
const MATRICES = [0x3c0, 0x380, 0x340, 0x300, 0x2c0, 0x280, 0x240, 0x200, 0x1c0, 0x180, 0x140, 0x100]
const matrixScale = (num: number) => 256 / MATRICES[Math.min(31, Math.max(20, num)) - 20]

type Particle = { x: number; y: number; x2: number; y2: number; trig: number; amp: number; timer: number; speed: number; matrix: number; step: (p: Particle) => boolean }

/** Random() del juego (generador congruencial de random.c), con semilla fija para que la lluvia salga siempre igual. */
function gameRandom(seed: number) {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1103515245) + 24691) >>> 0; return state >>> 16 }
}

const spiral = (p: Particle) => {
  if (p.y <= 8) return false
  p.y = 88 - Math.trunc((p.timer * p.timer) / 80)
  p.y2 = Math.trunc(sin(p.trig, p.amp) / 4)
  p.x2 = cos(p.trig, p.amp)
  p.trig += 4
  if (p.timer & 1) p.amp--
  p.timer++
  p.matrix = Math.min(31, Math.trunc(p.amp / 4) + 20)
  return true
}
const arc = (p: Particle) => {
  if (p.y >= 88) return false
  p.y = 8 + Math.trunc((p.timer * p.timer) / 5)
  p.y2 = Math.trunc(sin(p.trig, p.amp) / 4)
  p.x2 = cos(p.trig, p.amp)
  p.amp = 8 + sin((p.timer * 4) & 0xff, 40)
  p.timer++
  return true
}
const circle = (p: Particle) => {
  if (p.amp <= 8) return false
  p.y2 = sin(p.trig, p.amp)
  p.x2 = cos(p.trig, p.amp)
  p.amp -= p.speed
  p.trig += 4
  return true
}
const spray = (p: Particle) => {
  if (!(p.timer & 3)) p.y++
  if (p.trig >= 128) return false
  p.y2 = -sin(p.trig, p.amp)
  p.x = 120 + Math.trunc((p.speed * p.timer) / 3)
  p.trig++
  p.matrix = Math.max(20, 31 - Math.trunc((p.trig * 12) / 128))
  p.timer++
  return true
}

/** Destellos visibles en cada fotograma: cada tarea crea los suyos y luego se mueven todos, como RunTasks y AnimateSprites. */
function sparkleFrames(): Sparkle[][] {
  const { arc: arcAt, circle: circleAt, spray: sprayAt, end } = EVOLUTION_PHASES
  const random = gameRandom(0x5eed)
  const particle = (x: number, y: number, step: Particle['step'], extra: Partial<Particle>): Particle =>
    ({ x, y, x2: 0, y2: 0, trig: 0, amp: 0, timer: 0, speed: 0, matrix: 31, step, ...extra })
  let live: Particle[] = []
  const frames: Sparkle[][] = []
  for (let frame = 0; frame < end; frame++) {
    const t = frame
    if (t < 64 && !(t & 7)) for (let i = 0; i < 4; i++) live.push(particle(120, 88, spiral, { amp: 48, trig: (t & 120) * 2 + i * 64 }))
    const a = frame - arcAt
    if (a >= 0 && a < 6) for (let i = 0; i < 9; i++) live.push(particle(120, 8, arc, { amp: 8, trig: i * 16, matrix: 25 }))
    const c = frame - circleAt
    if (c === 0 || c === 32) for (let i = 0; i < 16; i++) live.push(particle(120, 56, circle, { amp: 120, trig: i * 16, speed: c === 0 ? 4 : 8 }))
    const s = frame - sprayAt
    const sprayOne = () => live.push(particle(120, 56, spray, { speed: 3 - (random() % 7), amp: 48 + (random() & 0x3f) }))
    if (s === 0) for (let i = 0; i < 8; i++) sprayOne()
    else if (s > 0 && s < 50 && s !== 32) { random(); sprayOne() }
    live = live.filter((p) => p.step(p))
    frames.push(live.map((p) => ({ x: p.x + p.x2, y: p.y + p.y2, scale: matrixScale(p.matrix) })))
  }
  return frames
}

const ROWS = backgroundRows()
const SPARKLES = sparkleFrames()

/** Nivel de un fundido de paleta (BeginNormalPaletteFade): sube de 2 en 2 sobre 16 cada `delay` + 1 fotogramas. */
const fade = (elapsed: number, delay: number) => (elapsed < 0 ? 0 : Math.min(16, 2 * (Math.floor(elapsed / (delay + 1)) + 1)) / 16)

/**
 * Lo que se ve en un fotograma de la animación: paso del fondo, escalas de las siluetas (o nada), blanco del fondo (`flash`) y del
 * Pokémon (`white`), los destellos y si ya es la forma nueva. El Pokémon se vuelve blanco con la espiral (paletas 17 y 18, retardo 10);
 * la lluvia funde a blanco el fondo y, a los 32 fotogramas, devuelve el color a todo, también a la forma nueva.
 */
export function animationFrame(frame: number): { row: number; scales: [number, number] | null; flash: number; white: number; sparkles: Sparkle[]; evolved: boolean } {
  const { cycle: cycleAt, circle: circleAt, spray: sprayAt } = EVOLUTION_PHASES
  const cycle = frame - cycleAt
  const spraying = frame - sprayAt
  const back = spraying - 32
  const flash = spraying < 0 ? 0 : back < 0 ? fade(spraying, 0) : 1 - fade(back, 0)
  return {
    row: ROWS[Math.min(frame, ROWS.length - 1)],
    scales: cycle >= 0 && cycle < SILHOUETTES.length ? SILHOUETTES[cycle] : null,
    flash,
    white: back < 0 ? fade(frame, 10) : 1 - fade(back, 0),
    sparkles: SPARKLES[frame] ?? [],
    evolved: frame >= circleAt,
  }
}

/**
 * Arriba del sprite en la escena para que el dibujo quede centrado en (120,64), el centro del remolino del fondo (Jose, 12/11/2026):
 * el frente va pegado abajo en su recuadro de 64 x 64 con `frontY` filas vacías encima, así que se sube la mitad de ese hueco.
 */
export const sceneSpriteTop = (species: string): number =>
  32 - Math.round(((emeraldSprites as Record<string, { frontY: number }>)[species]?.frontY ?? 0) / 2)
