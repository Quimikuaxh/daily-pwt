import { typeColors } from '../common/typeColors'

/** Bordes de las teselas de movimiento muestreados de la pantalla táctil de Negro/Blanco (shots/Pokemon_Battle_Moves_BW.png). */
const SAMPLED: Record<string, string> = {
  psychic: '#f84068',
  fighting: '#c05810',
  fire: '#f83028',
  normal: '#d0d0d0',
}

const NEUTRAL = '#a0a0a0'

export function moveTileColor(typeName: string | null): string {
  if (!typeName) return NEUTRAL
  const key = typeName.toLowerCase()
  return SAMPLED[key] ?? typeColors[key] ?? NEUTRAL
}
