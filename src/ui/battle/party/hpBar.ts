import type { PartyMember } from './partyModel'

export const hpFillColor = (percent: number): 'green' | 'yellow' | 'red' => (percent > 50 ? 'green' : percent > 20 ? 'yellow' : 'red')

/** Relleno de la barra de PS de 48 px: ancho en píxeles (al menos 1 si queda vida) y color por umbral. Módulo aparte para que la pantalla de equipo no cargue las descripciones de la de datos. */
export function hpBar(member: Pick<PartyMember, 'hp' | 'maxHp'>, fullWidth: number): { width: number; color: 'green' | 'yellow' | 'red' } {
  const percent = member.maxHp > 0 ? Math.round((100 * member.hp) / member.maxHp) : 0
  const width = member.hp > 0 ? Math.max(1, Math.round((fullWidth * member.hp) / member.maxHp)) : 0
  return { width, color: hpFillColor(percent) }
}
