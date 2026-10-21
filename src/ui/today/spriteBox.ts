import spriteBoxes from '../../generated/sprite-boxes.json'

/** Lado de la caja de los sprites de Hoy: los GIF caben a tamaño natural (x1); los pocos más grandes (Tornadus-Therian, 149x91) se reducen con `sprite-shrink`. */
export const TODAY_SPRITE_BOX = 100
export const TODAY_SPRITE_CLASS = 'sprite-natural'

const frontBoxes = (spriteBoxes as { front: Record<string, number[]> }).front

/** Clases de un sprite de Pokémon en Hoy: tamaño natural y, si no cabe en la caja, reducido para no recortarse. */
export function pokemonSpriteClass(spriteId: string | undefined): string {
  const box = spriteId ? frontBoxes[spriteId] : undefined
  return box && Math.max(box[4], box[5]) > TODAY_SPRITE_BOX ? `${TODAY_SPRITE_CLASS} sprite-shrink` : TODAY_SPRITE_CLASS
}
