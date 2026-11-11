/** Protagonista de espaldas de la intro y su secuencia de lanzamiento (hojas de public/ui/battle/trainers; atlas en data/ui-assets.json). */
export type Box = readonly [x: number, y: number, width: number, height: number]

export type Avatar = {
  id: 'nate' | 'rosa'
  /** Nombre que lleva en la pancarta VS. */
  name: string
  /** Retrato de la pancarta VS: sprite de frente (Showdown, trainers/<id>-front.png) recortado por arriba (`gen:trainer-vs`). */
  front: string
  /** Sprite de mapa de pie de lado, mirando a la derecha (escenario previo a la pancarta, `gen:trainer-side`). */
  side: string
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

/** Logo «VS.» de la pancarta VS, en pixel art (`npm run gen:vs-logo`). */
export const VS_LOGO = `${BASE}ui/battle/vs-logo.png`

/** Escudo del estadio bajo la franja de la pancarta, calcado del vídeo de N2/B2 (vs-emblem.png). */
export const VS_EMBLEM = `${BASE}ui/battle/vs-emblem.png`

/** Escenario del PWT con la pantalla gigante vacía (captura del juego sin entrenadores, retratos ni nombres): pwt-stage.png. */
export const PWT_STAGE = `${BASE}ui/battle/pwt-stage.png`

export const AVATARS: Record<Avatar['id'], Avatar> = {
  nate: { id: 'nate', name: 'Nate', front: trainers('nate-vs.png'), side: trainers('nate-side.png'), stand: trainers('nate-back.png'), sheet: trainers('nate-throw-sheet.png'), raise: [51, 11, 58, 117], throw: [112, 28, 87, 100], hand: { x: 34, y: 4 } },
  rosa: { id: 'rosa', name: 'Rosa', front: trainers('rosa-vs.png'), side: trainers('rosa-side.png'), stand: trainers('rosa-back.png'), sheet: trainers('rosa-throw-sheet.png'), raise: [50, 14, 70, 114], throw: [122, 38, 84, 90], hand: { x: 45, y: 3 } },
}

/** El protagonista sale de la semilla del combate: estable en los tests, variado entre combates. */
export function avatarForSeed(battleSeed: string): Avatar {
  const sum = Array.from(battleSeed).reduce((total, char) => total + char.charCodeAt(0), 0)
  return AVATARS[sum % 2 === 0 ? 'nate' : 'rosa']
}

export { uiAsset } from '../common/uiAssets'
