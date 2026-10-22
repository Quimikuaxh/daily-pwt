import iconIndex from '../../../generated/icon-index.json'
import descriptions from '../../../generated/descriptions-es.json'
import spriteBoxes from '../../../generated/sprite-boxes.json'
import type { StatsTable } from '../../../core/types'
import { es } from '../../../i18n/es'
import type { PartyMember } from './partyModel'

const descriptionTable = descriptions as { moves: Record<string, string>; abilities: Record<string, string> }
const frontBoxes = (spriteBoxes as { front: Record<string, number[]> }).front

export const moveDescription = (moveId: string): string | undefined => descriptionTable.moves[moveId]
export const abilityDescription = (abilityId: string): string | undefined => descriptionTable.abilities[abilityId]

/**
 * Número de Pokédex nacional con tres cifras. La hoja de iconos se ordena por él en las especies base; las formas tienen icono propio
 * más allá del 1000, así que el número sale de la especie base (`landorus-therian` -> `landorus`).
 */
export const dexNumberText = (spriteId: string): string => String((iconIndex as Record<string, number>)[spriteId.split('-')[0]] ?? 0).padStart(3, '0')

/** Ancho y alto del GIF de frente (recortado al contenido), para anclarlo por los pies. */
export function frontSpriteSize(spriteId: string, fallback: number): { width: number; height: number } {
  const box = frontBoxes[spriteId]
  return { width: box ? box[2] : fallback, height: box ? box[3] : fallback }
}

export { hpBar, hpFillColor } from './hpBar'

export function natureEffectText(member: Pick<PartyMember, 'natureUp' | 'natureDown'>): string {
  const statName = (key: keyof StatsTable): string => es.today.statNames[key]
  return member.natureUp && member.natureDown ? es.battle.summary.natureEffect(statName(member.natureUp), statName(member.natureDown)) : es.battle.summary.natureNeutral
}

/** Las cinco estadísticas de la página de habilidades (los PS van aparte, con su barra). */
export const SKILL_STAT_KEYS = ['atk', 'def', 'spa', 'spd', 'spe'] as const
