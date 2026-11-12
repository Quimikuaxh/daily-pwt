/**
 * Música de la campaña de Hoenn (pistas de Esmeralda elegidas por Jose el 12/11/2026, `data/audio.json`): combate por tipo de rival,
 * victoria en Resultado, Salón de la Fama y evolución. Como el reto diario (DEC-57), cada pantalla descarga solo su pista.
 */
import { useEffect } from 'react'
import { getAudio } from '../../audio/audio'
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
