import { pokemonSpriteUrl, substituteSpriteUrl, trainerMiniSpriteUrl, trainerSpriteUrl, type PokemonSide } from '../../data/sprites'
import type { DexData } from '../../core/types'

const baseUrl = import.meta.env.BASE_URL

/** URL del sprite de una especie, o `null` si la especie no está en el dex (la UI enseña entonces la caja con el nombre). */
export function speciesSprite(dex: DexData, speciesId: string, side: PokemonSide): string | null {
  try {
    return pokemonSpriteUrl(dex, speciesId, side, baseUrl)
  } catch {
    return null
  }
}

export const trainerSprite = (sprite: string): string => trainerSpriteUrl(sprite, baseUrl)

export const trainerMiniSprite = (sprite: string): string => trainerMiniSpriteUrl(sprite, baseUrl)

export const substituteSprite = (side: PokemonSide): string => substituteSpriteUrl(side, baseUrl)
