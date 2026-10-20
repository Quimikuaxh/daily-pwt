import spriteBoxes from '../../generated/sprite-boxes.json'

/** Posición de los pies sin recorte, borde superior de la caja de mensajes y borde inferior de la pantalla (píxeles lógicos). */
export const MESSAGE_BOX_TOP = 147
export const SCREEN_BOTTOM = 192
export const PLAYER_SPRITE_SCALE = 2
export const PLAYER_SPRITE_CENTER_X = 62
/** Parte del sprite que como máximo se pierde bajo la caja de mensajes. */
const MAX_HIDDEN_FRACTION = 0.4
const MAX_HIDDEN_PIXELS = 40
const FALLBACK_HEIGHT = 96

type SpriteBoxTable = Record<string, Record<string, number[]>>

/** Alto visible (píxeles del GIF) del sprite de espaldas; los GIF de Showdown vienen recortados al contenido, y el manifest lo verifica. */
export function backSpriteHeight(spriteId: string): number {
  const box = (spriteBoxes as SpriteBoxTable).back?.[spriteId]
  return box ? box[3] : FALLBACK_HEIGHT
}

/**
 * Línea de los pies (borde inferior del sprite ya ampliado) del Pokémon del jugador. Como en el juego, el cuerpo queda sobre el campo y
 * solo se pierde la parte baja bajo la caja de mensajes; un sprite muy alto sube lo justo para no salirse por arriba.
 */
export function playerSpriteBottom(spriteHeight: number): number {
  const scaledHeight = spriteHeight * PLAYER_SPRITE_SCALE
  const hidden = Math.min(Math.round(scaledHeight * MAX_HIDDEN_FRACTION), MAX_HIDDEN_PIXELS)
  const preferredBottom = MESSAGE_BOX_TOP + hidden
  return Math.min(SCREEN_BOTTOM, Math.max(preferredBottom, scaledHeight))
}

/** Caja visible resultante: `{ top, bottom }` en la pantalla superior. */
export function playerSpriteVisibleSpan(spriteHeight: number): { top: number; bottom: number } {
  const bottom = playerSpriteBottom(spriteHeight)
  return { top: bottom - spriteHeight * PLAYER_SPRITE_SCALE, bottom }
}
