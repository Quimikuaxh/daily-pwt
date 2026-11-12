import moveSoundData from '../../generated/emerald/move-sounds.json'
/**
 * Música y efectos de la campaña de Hoenn (pistas de Esmeralda elegidas por Jose el 12/11/2026, `data/audio.json`): combate por tipo de rival,
 * victoria en Resultado, Salón de la Fama y evolución. Como el reto diario (DEC-57), cada pantalla descarga solo su pista.
 */
import { useEffect } from 'react'
import { getAudio as baseAudio } from '../../audio/audio'
import type { AudioIndex } from '../../audio/audioEngine'
import emeraldAudio from '../../generated/emerald/audio-index.json'
import emeraldCries from '../../generated/emerald/cries.json'
import type { SfxId } from '../../audio/audio'
import type { ResultMode } from './resultModel'

/**
 * Música, efectos y gritos de Esmeralda: se registran en el motor la primera vez que la campaña lo usa (no van en el índice del reto
 * diario, para no pesar en su ruta crítica, E2E-21). Los gritos, como `emerald-<especie>`.
 */
let registered = false
function getAudio() {
  const audio = baseAudio()
  if (!registered) {
    registered = true
    const cries = Object.fromEntries(Object.entries(emeraldCries as NonNullable<AudioIndex['cries']>).map(([id, entry]) => [`emerald-${id}`, entry]))
    audio.register({ ...(emeraldAudio as Partial<AudioIndex>), cries })
  }
  return audio
}

/** Tema de combate: líder de gimnasio, Alto Mando o campeón. */
export const battleMusic = (kind: 'gym' | 'elite' | 'champion'): string =>
  kind === 'champion' ? 'emerald-champion' : kind === 'elite' ? 'emerald-elite' : 'emerald-gym'

/** Resultado: la victoria contra un líder, la de la Liga tras el Alto Mando, el Salón de la Fama tras el campeón; sin música al perder. */
export const resultMusic = (mode: ResultMode): string | null =>
  mode === 'medal' ? 'emerald-gym-victory' : mode === 'beaten' ? 'emerald-league-victory' : mode === 'hallOfFame' ? 'emerald-hall-of-fame' : null

/**
 * Música de los menús de cada tramo (Jose, 12/11/2026): el tema de la ciudad del gimnasio que toca; donde el juego repite el de otra
 * ciudad (Malvalona y Algaria usan el de Férrica; Lavacalda, el de Villa Raíz), una pista de la zona: Pueblo Verdegal, Monte Cenizo y
 * Ciudad Calagua. En la Liga, Ciudad Colosalia.
 */
const TOWN_MUSIC: Record<string, string> = {
  petra: 'emerald-town-rustboro', marcial: 'emerald-town-dewford', erico: 'emerald-town-verdanturf', candela: 'emerald-town-chimney',
  norman: 'emerald-town-petalburg', alana: 'emerald-town-fortree', 'vito-y-leti': 'emerald-town-lilycove', galano: 'emerald-town-sootopolis',
}
export const townMusic = (encounterId: string): string => TOWN_MUSIC[encounterId] ?? 'emerald-town-evergrande'

export const EVOLUTION_MUSIC = 'emerald-evolution'
/** Créditos de Esmeralda, en la pantalla final para compartir (Jose, 12/11/2026); una vez. */
export const CREDITS_MUSIC = 'emerald-credits'
/** Fanfarria de «¡Enhorabuena! … ha evolucionado» (MUS_EVOLVED), una vez. */
export const EVOLVED_MUSIC = 'emerald-evolved'

/** Suena `id` mientras no sea `null` (con transición si cambia) y se funde al quitarla o al salir de la pantalla. */
export function useCampaignMusic(id: string | null): void {
  useEffect(() => {
    if (!id) return
    const audio = getAudio()
    audio.preload([id], [])
    audio.playMusic(id)
    return () => audio.stopMusic()
  }, [id])
}

/**
 * Efectos de Esmeralda (`emerald-*` de `data/audio.json`, del ZIP de The Sounds Resource) para los del presentador del combate. Los de
 * la Poké Ball no van aquí: los pone `EmeraldBattle` al ritmo de su envío. Los de estado y la baya no tienen equivalente en Esmeralda
 * (allí son animaciones de movimiento): no suenan.
 */
const BATTLE_SFX: Partial<Record<SfxId, string>> = {
  'hit-super': 'emerald-hit-super', 'hit-neutral': 'emerald-hit-neutral', 'hit-weak': 'emerald-hit-weak',
  faint: 'emerald-faint', 'stat-up': 'emerald-stat-up', 'stat-down': 'emerald-stat-down',
  'menu-select': 'emerald-select', 'menu-cancel': 'emerald-select',
}
export const emeraldSfxFor = (id: SfxId): string | null => BATTLE_SFX[id] ?? null

export const LOW_HEALTH_SFX = 'emerald-low-health'
/** El pitido de vida baja: el fichero trae dos vueltas de 0,6 s (`[`/`]` de se_low_health.mid, 36 pulsos a 400 000 µs/24). */
export const LOW_HEALTH_PERIOD_MS = 1200

export const BATTLE_SFX_IDS = [LOW_HEALTH_SFX, 'emerald-hit-super', 'emerald-hit-neutral', 'emerald-hit-weak', 'emerald-faint', 'emerald-stat-up', 'emerald-stat-down',
  'emerald-select', 'emerald-ball-throw', 'emerald-ball-open'] as const
export const EVOLUTION_SFX_IDS = ['emerald-evo-spiral', 'emerald-evo-arc', 'emerald-evo-circle', 'emerald-evo-spray', 'emerald-evo-done'] as const

export const playSfx = (id: string): void => getAudio().playSfx(id)
/** Descarga los efectos de una pantalla al entrar (DEC-57: solo lo que va a sonar). */
export const preloadSfx = (ids: readonly string[]): void => getAudio().preload([], ids)

/** Gritos de la tercera generación (`gen:emerald-cries`): `emerald-<especie>` en el índice de gritos. */
const cryOf = (species: string) => `emerald-${species}`
export const playCry = (species: string, faint = false): void => getAudio().playCry(cryOf(species), { faint })
export const preloadCries = (species: readonly string[]): void => getAudio().preload([], [], species.map(cryOf))

/**
 * Sonidos de cada ataque (`gen:emerald-move-sounds`, de los guiones de animación de pokeemerald): los efectos del ataque con el fotograma
 * en que suenan. Suenan al decir «X usó Y» (Jose, 12/11/2026); el golpe (eficaz, poco eficaz…) sigue sonando al recibir el daño.
 */
const moveSounds = moveSoundData as unknown as Record<string, [number, string][]>
export const moveSoundIds = (moves: readonly string[]): string[] => [...new Set(moves.flatMap((move) => (moveSounds[move] ?? []).map(([, id]) => id)))]
export function playMoveSounds(move: string, speed: number): () => void {
  const timers = (moveSounds[move] ?? []).map(([frame, id]) => setTimeout(() => playSfx(id), (frame * 1000) / 60 / speed))
  return () => { timers.forEach(clearTimeout) }
}
