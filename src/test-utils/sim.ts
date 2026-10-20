import { Battle } from '@pkmn/sim'
import type { ResolvedSet } from './types'

/** Empaqueta ResolvedSet[] en el formato de equipo del simulador (solo para montar Battles en los tests). */
export function packTeam(team: ResolvedSet[]): string {
  const stats = (t: Record<string, number>) => [t.hp, t.atk, t.def, t.spa, t.spd, t.spe].join(',')
  return team
    .map((p) => [p.species, '', p.item, p.ability, p.moves.join(','), p.nature, stats(p.evs), p.gender ?? '', stats(p.ivs), '', String(p.level), ''].join('|'))
    .join(']')
}

/** Battle síncrono gen5customgame sin Team Preview (DEC-08/09), con la semilla dada. */
export function newBattle(p1: ResolvedSet[], p2: ResolvedSet[], seed = '1,2,3,4'): Battle {
  const b = new Battle({ formatid: 'gen5customgame@@@!teampreview' as any, seed: seed as any })
  b.setPlayer('p1', { name: 'Jugador', team: packTeam(p1) })
  b.setPlayer('p2', { name: 'Rival', team: packTeam(p2) })
  return b
}
