import { toId } from '../core/id'

/** Posición de entrada, base cero; independiente del inicial y de los cambios del simulador. */
export function battleIdentity(species: string, teamIndex?: number): string {
  return teamIndex === undefined ? species : `${species}__${teamIndex}`
}

/** Las líneas y repeticiones anteriores solo contienen el id de especie. */
export function parseBattleIdentity(name: string): { species: string; teamIndex?: number } {
  const match = /^(.*)__(\d+)$/.exec(name)
  return match ? { species: toId(match[1]), teamIndex: Number(match[2]) } : { species: toId(name) }
}
