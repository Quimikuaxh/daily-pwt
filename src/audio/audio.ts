import audioIndex from '../generated/audio-index.json'
import { createAudioEngine, type AudioContextLike, type AudioEngine, type AudioIndex } from './audioEngine'

/** Música y efectos de cada momento (PRD §0, «Fuentes y temas del sonido»). */
export const SFX_IDS = [
  'hit-super', 'hit-neutral', 'hit-weak', 'ball-throw', 'ball-open', 'faint', 'low-hp',
  'menu-select', 'menu-cancel',
  'status-brn', 'status-psn', 'status-par', 'status-slp', 'status-frz', 'status-confusion',
  'berry', 'stat-up', 'stat-down',
] as const
export type SfxId = (typeof SFX_IDS)[number]
export const VICTORY_MUSIC = 'victory-pwt'

/** Temas propios por entrenador (`trainers` de `data/audio.json`): Mirto y Cheren, con los suyos de Negro y Blanco (Jose, 28/10/2026). */
const TRAINER_MUSIC: Record<string, string> = (audioIndex as { trainers?: Record<string, string> }).trainers ?? {}

/**
 * Tema del rival: el suyo propio si lo tiene (`TRAINER_MUSIC`); si no, `gym-<región>` para líderes y `champion-<región>` para campeones
 * (los 53 tienen región, `build-audio.test.ts`). Sin región, el de Teselia.
 */
export const battleMusicFor = (trainer: { id?: string; category: 'leader' | 'champion'; region: string | null }): string =>
  (trainer.id ? TRAINER_MUSIC[trainer.id] : undefined) ?? `${trainer.category === 'leader' ? 'gym' : 'champion'}-${trainer.region ?? 'unova'}`

function browserContext(): AudioContextLike | null {
  const Context = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  return Context ? new Context() : null
}

let engine: AudioEngine | null = null

/** El motor de la página (uno solo: un `AudioContext` por pestaña). */
export function getAudio(): AudioEngine {
  engine ??= createAudioEngine({
    index: audioIndex as AudioIndex,
    baseUrl: import.meta.env.BASE_URL,
    createContext: browserContext,
    fetchBytes: async (url) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.arrayBuffer()
    },
    unlockTarget: typeof window === 'undefined' ? null : window,
  })
  return engine
}
