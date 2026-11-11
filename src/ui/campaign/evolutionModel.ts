/**
 * Evoluciones de la Liga (D7, opción A aprobada el 11/11/2026): qué miembros evolucionan y a qué formas finales (las del núcleo,
 * `leagueEvolutionTargets`), y la secuencia de mensajes de la escena por miembro. Los de una forma no preguntan; los de varias, sí.
 */
import { leagueEvolutionTargets, type CampaignDefinition, type CampaignState } from '../../core/nuzlocke/campaign'

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

/** Fases de la animación en fotogramas: el Pokémon en color, las siluetas alternándose, el destello y la forma nueva. */
export const EVOLUTION_INTRO_FRAMES = 40
export const EVOLUTION_FLASH_FRAMES = 30
export function evolutionLength(): number {
  return EVOLUTION_INTRO_FRAMES + silhouetteFrames().length + EVOLUTION_FLASH_FRAMES
}

const ROWS = backgroundRows()
const SILHOUETTES = silhouetteFrames()

/** Lo que se ve en un fotograma de la animación: paso del fondo, escalas de las siluetas (o nada), destello y si ya es la forma nueva. */
export function animationFrame(frame: number): { row: number; scales: [number, number] | null; flash: number; evolved: boolean } {
  const cycle = frame - EVOLUTION_INTRO_FRAMES
  const inCycle = cycle >= 0 && cycle < SILHOUETTES.length
  const after = cycle - SILHOUETTES.length
  return {
    row: ROWS[Math.min(frame, ROWS.length - 1)],
    scales: inCycle ? SILHOUETTES[cycle] : null,
    flash: after >= 0 ? Math.max(0, 1 - after / EVOLUTION_FLASH_FRAMES) : 0,
    evolved: after >= 0,
  }
}
