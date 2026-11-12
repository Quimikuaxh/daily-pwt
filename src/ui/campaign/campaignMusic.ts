/**
 * Música y efectos de la campaña de Hoenn (pistas de Esmeralda elegidas por Jose el 12/11/2026, `data/audio.json`): combate por tipo de rival,
 * victoria en Resultado, Salón de la Fama y evolución. Como el reto diario (DEC-57), cada pantalla descarga solo su pista.
 */
import { useEffect } from 'react'
import { getAudio } from '../../audio/audio'
import type { SfxId } from '../../audio/audio'
import type { ResultMode } from './resultModel'

/** Tema de combate: líder de gimnasio, Alto Mando o campeón. */
export const battleMusic = (kind: 'gym' | 'elite' | 'champion'): string =>
  kind === 'champion' ? 'emerald-champion' : kind === 'elite' ? 'emerald-elite' : 'emerald-gym'

/** Resultado: la victoria contra un líder, la de la Liga tras el Alto Mando, el Salón de la Fama tras el campeón; sin música al perder. */
export const resultMusic = (mode: ResultMode): string | null =>
  mode === 'medal' ? 'emerald-gym-victory' : mode === 'beaten' ? 'emerald-league-victory' : mode === 'hallOfFame' ? 'emerald-hall-of-fame' : null

export const EVOLUTION_MUSIC = 'emerald-evolution'

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

export const BATTLE_SFX_IDS = ['emerald-hit-super', 'emerald-hit-neutral', 'emerald-hit-weak', 'emerald-faint', 'emerald-stat-up', 'emerald-stat-down',
  'emerald-select', 'emerald-ball-throw', 'emerald-ball-open'] as const
export const EVOLUTION_SFX_IDS = ['emerald-evo-spiral', 'emerald-evo-arc', 'emerald-evo-circle', 'emerald-evo-spray', 'emerald-evo-done'] as const

export const playSfx = (id: string): void => getAudio().playSfx(id)
/** Descarga los efectos de una pantalla al entrar (DEC-57: solo lo que va a sonar). */
export const preloadSfx = (ids: readonly string[]): void => getAudio().preload([], ids)
