import audioIndex from '../generated/audio-index.json'
import { createAudioEngine, type AudioContextLike, type AudioEngine, type AudioIndex } from './audioEngine'

/** Música y efectos de cada momento (PRD §0, «Fuentes y temas del sonido»). */
export const SFX_IDS = ['hit-super', 'hit-neutral', 'hit-weak', 'ball-throw', 'ball-open', 'faint'] as const
export type SfxId = (typeof SFX_IDS)[number]
export const VICTORY_MUSIC = 'victory-pwt'

/**
 * Tema del rival: `gym-<región>` para líderes y `champion-<región>` para campeones (los 53 tienen región, `build-audio.test.ts`). Sin
 * región, el de Teselia.
 */
export const battleMusicFor = (trainer: { category: 'leader' | 'champion'; region: string | null }): string =>
  `${trainer.category === 'leader' ? 'gym' : 'champion'}-${trainer.region ?? 'unova'}`

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
