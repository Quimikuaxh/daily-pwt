import spriteBoxes from '../../generated/sprite-boxes.json'
import type { Avatar } from './introAssets'
import { PLAYER_SPRITE_CENTER_X, PLAYER_SPRITE_SCALE, backSpriteHeight, playerSpriteBottom } from './playerSpriteAnchor'

/**
 * Geometría del lanzamiento de la Poké Ball (píxeles lógicos de la pantalla superior): sale de la MANO del entrenador y cae donde aparece
 * el Pokémon (el centro de su sprite, sobre su plataforma). Las posiciones del entrenador son las de battle.css (`.bt-trainer-*`).
 */
export type Point = { x: number; y: number }

const PLAYER_TRAINER = { centerX: 78, bottom: 182, width: 90, height: 120 }
const RIVAL_TRAINER_FEET: Point = { x: 186, y: 102 }
const RIVAL_MON_FEET: Point = { x: 186, y: 97 }
const MESSAGE_BOX_TOP = 147
const FALLBACK_SPRITE_HEIGHT = 96
/** La mano del rival (sus sprites no tienen pose de lanzamiento): a la izquierda del centro, que es su brazo derecho de cara a nosotros, y a media altura. */
const RIVAL_HAND = { fromCenter: -0.28, fromFeet: -0.55 }

type SpriteTable = Record<string, Record<string, number[]>>
const boxes = spriteBoxes as SpriteTable

export function playerHandPoint(avatar: Avatar): Point {
  const [, , raiseWidth, raiseHeight] = avatar.raise
  const trainerLeft = PLAYER_TRAINER.centerX - PLAYER_TRAINER.width / 2
  const trainerTop = PLAYER_TRAINER.bottom - PLAYER_TRAINER.height
  return {
    x: trainerLeft + (PLAYER_TRAINER.width - raiseWidth) / 2 + avatar.hand.x,
    y: trainerTop + (PLAYER_TRAINER.height - raiseHeight) + avatar.hand.y,
  }
}

/** Centro visible del Pokémon del jugador (a 2x, anclado como en TopScreen), sin bajar de la caja de mensajes para que la bola se vea llegar. */
export function playerLandingPoint(backSpriteId: string): Point {
  const height = backSpriteHeight(backSpriteId) * PLAYER_SPRITE_SCALE
  return { x: PLAYER_SPRITE_CENTER_X, y: Math.min(MESSAGE_BOX_TOP - 6, playerSpriteBottom(backSpriteHeight(backSpriteId)) - height / 2) }
}

export function rivalHandPoint(trainerSpriteId: string): Point {
  const box = boxes.trainer?.[trainerSpriteId]
  const [width, height] = box ? [box[2], box[3]] : [FALLBACK_SPRITE_HEIGHT, FALLBACK_SPRITE_HEIGHT]
  return { x: RIVAL_TRAINER_FEET.x + RIVAL_HAND.fromCenter * width, y: RIVAL_TRAINER_FEET.y + RIVAL_HAND.fromFeet * height }
}

export function rivalLandingPoint(frontSpriteId: string): Point {
  const height = boxes.front?.[frontSpriteId]?.[3] ?? FALLBACK_SPRITE_HEIGHT
  return { x: RIVAL_MON_FEET.x, y: RIVAL_MON_FEET.y - height / 2 }
}

export const offsetBetween = (from: Point, to: Point): Point => ({ x: from.x - to.x, y: from.y - to.y })
