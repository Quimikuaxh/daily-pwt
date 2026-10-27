import type { DexData } from '../core/types'

const DEFAULT_BASE_URL = '/'

export type PokemonSide = 'front' | 'back'

/** public/sprites/pokemon/{front,back}/<spriteId>.gif (Showdown gen5ani / gen5ani-back). */
export function pokemonSpriteUrl(dex: DexData, speciesId: string, side: PokemonSide, baseUrl = DEFAULT_BASE_URL): string {
  const species = dex.species[speciesId]
  if (!species) throw new Error(`Especie desconocida para el sprite: ${speciesId}`)
  return `${baseUrl}sprites/pokemon/${side}/${species.spriteId}.gif`
}

/** public/sprites/substitute/{front,back}.png: el muñeco del sustituto (Showdown, `substitutes/gen5` y `gen5-back`; `gen:sprites`). */
export const substituteSpriteUrl = (side: PokemonSide, baseUrl = DEFAULT_BASE_URL): string => `${baseUrl}sprites/substitute/${side}.png`

/** public/sprites/trainers/<sprite>.gif (animado N2/B2). */
export const trainerSpriteUrl = (sprite: string, baseUrl = DEFAULT_BASE_URL): string => `${baseUrl}sprites/trainers/${sprite}.gif`

/** public/sprites/trainers/<sprite>-mini.png (icono pequeño). */
export const trainerMiniSpriteUrl = (sprite: string, baseUrl = DEFAULT_BASE_URL): string => `${baseUrl}sprites/trainers/${sprite}-mini.png`
