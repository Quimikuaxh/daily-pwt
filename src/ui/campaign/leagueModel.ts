/**
 * Modelo de la Liga de la campaña (D7, maqueta aprobada el 11/11/2026): cuántos rivales de la Liga van superados, la elección de 1 a 6
 * participantes del Frente Batalla (tocar añade o quita, y el orden es el de salida) y lo que dice cada hueco: APTO, NO APTO o su orden.
 */
import { esCampaign } from '../../i18n/esCampaign'
import type { CampaignEncounter } from './hoennRoute'

const t = esCampaign.league
export const LEAGUE_SIZE = 6

/** Rivales de la Liga superados: los del Alto Mando y el campeón van después de los gimnasios. */
export function leagueBeaten(encounterIndex: number, encounters: readonly CampaignEncounter[]): number {
  const first = encounters.findIndex((encounter) => encounter.kind !== 'gym')
  return Math.max(0, encounterIndex - first)
}

/** Tocar un participante: lo quita si estaba (y los demás se renumeran) o lo añade al final si queda sitio. */
export function toggleParticipant(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((candidate) => candidate !== id)
  return selected.length < LEAGUE_SIZE ? [...selected, id] : [...selected]
}

/** Texto del hueco en lugar de los PS. */
export function participantText(id: string, fainted: boolean, selected: readonly string[]): string {
  if (fainted) return t.unable
  const order = selected.indexOf(id)
  return order >= 0 ? t.order(order + 1) : t.able
}
