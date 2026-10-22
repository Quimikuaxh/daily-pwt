import spriteBoxes from '../../generated/sprite-boxes.json'

/** Lado de la caja de los sprites de Hoy: los GIF caben a tamaño natural (x1); los pocos más grandes (Tornadus-Therian, 149x91; los entrenadores Ciprián, 129x101, Hiedra, 75x114, y Sachiko, 106x68) se reducen con `sprite-shrink`. */
export const TODAY_SPRITE_BOX = 100
export const TODAY_SPRITE_CLASS = 'sprite-natural'

const frontBoxes = (spriteBoxes as { front: Record<string, number[]> }).front
const trainerBoxes = (spriteBoxes as unknown as { trainer: Record<string, number[]> }).trainer

function classForBox(box: number[] | undefined): string {
  return box && Math.max(box[4], box[5]) > TODAY_SPRITE_BOX ? `${TODAY_SPRITE_CLASS} sprite-shrink` : TODAY_SPRITE_CLASS
}

/** Clases de un sprite de Pokémon en Hoy: tamaño natural y, si no cabe en la caja, reducido para no recortarse. */
export function pokemonSpriteClass(spriteId: string | undefined): string {
  return classForBox(spriteId ? frontBoxes[spriteId] : undefined)
}

/** Igual que `pokemonSpriteClass`, para el sprite de un entrenador (`trainer.sprite`). */
export function trainerSpriteClass(spriteId: string | undefined): string {
  return classForBox(spriteId ? trainerBoxes[spriteId] : undefined)
}
