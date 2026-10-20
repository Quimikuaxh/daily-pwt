/** Protagonista de espaldas de la intro y su secuencia de lanzamiento (hojas de public/ui/battle/trainers; atlas en data/ui-assets.json). */
export type Box = readonly [x: number, y: number, width: number, height: number]

export type Avatar = {
  id: 'nate' | 'rosa'
  stand: string
  sheet: string
  /** Pose con el brazo en alto y pose de lanzamiento, recortes de la hoja (los pies quedan abajo en las dos). */
  raise: Box
  throw: Box
  /** Centro de la Poké Ball en la mano, en píxeles de la pose `raise` (esquina superior izquierda de su caja): de ahí sale el lanzamiento. */
  hand: { x: number; y: number }
}

const BASE = import.meta.env.BASE_URL
const trainers = (file: string): string => `${BASE}ui/battle/trainers/${file}`

export const AVATARS: Record<Avatar['id'], Avatar> = {
  nate: { id: 'nate', stand: trainers('nate-back.png'), sheet: trainers('nate-throw-sheet.png'), raise: [51, 11, 58, 117], throw: [112, 28, 87, 100], hand: { x: 34, y: 4 } },
  rosa: { id: 'rosa', stand: trainers('rosa-back.png'), sheet: trainers('rosa-throw-sheet.png'), raise: [50, 14, 70, 114], throw: [122, 38, 84, 90], hand: { x: 45, y: 3 } },
}

/** El protagonista sale de la semilla del combate: estable en los tests, variado entre combates. */
export function avatarForSeed(battleSeed: string): Avatar {
  const sum = Array.from(battleSeed).reduce((total, char) => total + char.charCodeAt(0), 0)
  return AVATARS[sum % 2 === 0 ? 'nate' : 'rosa']
}

export { uiAsset } from '../common/uiAssets'
