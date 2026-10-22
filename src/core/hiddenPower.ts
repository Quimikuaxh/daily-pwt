import type { StatsTable } from './types'

/** Orden de los tipos de Poder Oculto en la fórmula (Lucha = 0 ... Siniestro = 15). */
const HIDDEN_POWER_TYPES = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark'] as const
/** Orden de las características en la fórmula: PS, Ataque, Defensa, Velocidad, At. Esp., Def. Esp. */
const FORMULA_ORDER: (keyof StatsTable)[] = ['hp', 'atk', 'def', 'spe', 'spa', 'spd']

/**
 * Tipo y potencia de Poder Oculto en la 5.ª generación, a partir de los IV (el set solo dice «Poder Oculto»; el simulador lo calcula igual).
 * El tipo sale del bit más bajo de cada IV y la potencia (30 a 70) del segundo.
 */
export function hiddenPower(ivs: StatsTable): { type: (typeof HIDDEN_POWER_TYPES)[number]; power: number } {
  let typeBits = 0
  let powerBits = 0
  FORMULA_ORDER.forEach((stat, index) => {
    typeBits += (ivs[stat] % 2) << index
    powerBits += ((ivs[stat] >> 1) % 2) << index
  })
  return { type: HIDDEN_POWER_TYPES[Math.floor((typeBits * 15) / 63)], power: Math.floor((powerBits * 40) / 63) + 30 }
}

/** `hiddenpower` -> `hiddenpowerfighting` (el id con tipo, que tiene nombre en español y tipo en el dex); el resto, igual. */
export function resolveHiddenPowerId(moveId: string, ivs: StatsTable | undefined): string {
  return moveId === 'hiddenpower' && ivs ? `hiddenpower${hiddenPower(ivs).type.toLowerCase()}` : moveId
}
