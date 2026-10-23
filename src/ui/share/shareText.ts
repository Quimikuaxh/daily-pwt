import { SITE_URL } from '../../config'
import { TEAM_SIZE } from '../../core/constants'
import { es } from '../../i18n/es'
import type { DayRecord } from '../../storage/gameStore'
import { computeStats } from '../../storage/playerStats'

const text = es.share

/**
 * Texto para compartir un oficial terminado (PRD §11), sin nombre del rival ni del equipo. Una casilla por Pokémon del jugador en el orden
 * del equipo; los días guardados antes de F3 no tienen ese dato y van sin casillas. `null` si el día no tiene resultado (en curso o anulado).
 */
export function shareText(record: DayRecord, winStreak: number): string | null {
  if (record.status !== 'won' && record.status !== 'lost') return null
  const result = record.status === 'won' ? text.victory(record.turns ?? 0) : text.defeat(record.rivalFainted ?? 0, TEAM_SIZE)
  const grid = record.playerFainted?.map((fainted) => (fainted ? text.fainted : text.alive)).join('')
  return [text.title(record.challengeNumber), result, ...(grid ? [grid] : []), text.streak(winStreak), SITE_URL].join('\n')
}

/** Texto del oficial de `date` con la racha de victorias que había al terminarlo (los días posteriores no cuentan). */
export function shareTextFor(days: readonly DayRecord[], date: string): string | null {
  const record = days.find((day) => day.date === date)
  if (!record) return null
  return shareText(record, computeStats(days.filter((day) => day.date <= date), date).winStreak)
}

export type ShareOutcome = 'copied' | 'failed'

/**
 * Copia el resultado al portapapeles, también en móvil (decisión de Jose, 23/10/2026: «Copiar» directamente, sin el panel de compartir del
 * sistema). Si el navegador no deja, `failed` y la pantalla enseña el texto para copiarlo a mano.
 */
export async function shareResult(content: string, nav: Navigator = navigator): Promise<ShareOutcome> {
  try {
    await nav.clipboard.writeText(content)
    return 'copied'
  } catch {
    return 'failed'
  }
}
