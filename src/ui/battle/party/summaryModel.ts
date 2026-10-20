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

/** Número de Pokédex nacional con tres cifras (la hoja de iconos se ordena por él). */
export const dexNumberText = (speciesId: string): string => String((iconIndex as Record<string, number>)[speciesId] ?? 0).padStart(3, '0')

/** Ancho y alto del GIF de frente (recortado al contenido), para anclarlo por los pies. */
export function frontSpriteSize(spriteId: string, fallback: number): { width: number; height: number } {
  const box = frontBoxes[spriteId]
  return { width: box ? box[2] : fallback, height: box ? box[3] : fallback }
}

export const hpFillColor = (percent: number): 'green' | 'yellow' | 'red' => (percent > 50 ? 'green' : percent > 20 ? 'yellow' : 'red')

/** Relleno de la barra de PS de 48 px: ancho en píxeles (al menos 1 si queda vida) y color por umbral. */
export function hpBar(member: Pick<PartyMember, 'hp' | 'maxHp'>, fullWidth: number): { width: number; color: 'green' | 'yellow' | 'red' } {
  const percent = member.maxHp > 0 ? Math.round((100 * member.hp) / member.maxHp) : 0
  const width = member.hp > 0 ? Math.max(1, Math.round((fullWidth * member.hp) / member.maxHp)) : 0
  return { width, color: hpFillColor(percent) }
}

export function natureEffectText(member: Pick<PartyMember, 'natureUp' | 'natureDown'>): string {
  const statName = (key: keyof StatsTable): string => es.today.statNames[key]
  return member.natureUp && member.natureDown ? es.battle.summary.natureEffect(statName(member.natureUp), statName(member.natureDown)) : es.battle.summary.natureNeutral
}

/** Las cinco estadísticas de la página de habilidades (los PS van aparte, con su barra). */
export const SKILL_STAT_KEYS = ['atk', 'def', 'spa', 'spd', 'spe'] as const
