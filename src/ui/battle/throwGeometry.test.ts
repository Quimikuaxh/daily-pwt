import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fromRoot, importScript } from '../../test-utils/paths'
import spriteBoxes from '../../generated/sprite-boxes.json'
import { AVATARS } from './introAssets'
import { PLAYER_SPRITE_CENTER_X } from './playerSpriteAnchor'
import { offsetBetween, playerHandPoint, playerLandingPoint, rivalHandPoint, rivalLandingPoint } from './throwGeometry'

const boxes = spriteBoxes as { front: Record<string, number[]>; back: Record<string, number[]>; trainer: Record<string, number[]> }
const insideTopScreen = ({ x, y }: { x: number; y: number }) => x >= 0 && x <= 256 && y >= 0 && y <= 192

// RF-72 / PRD §0: la Poké Ball sale de la mano del entrenador y cae donde aparece el Pokémon.
// Con los 53 entrenadores hay sprites estrechos (Millo 27 px, Yasmina 33, Cheren 34): la bola del juego mide 12 px y no se reduce por debajo de su tamaño nativo, así que el tercio del ancho se calcula sobre al menos 40 px.
const NARROW_TRAINER_WIDTH = 40

describe('geometría del lanzamiento de la Poké Ball', () => {
  it.each(Object.values(AVATARS))('la mano de $id está dentro del campo, en la parte alta de su pose y a la izquierda', (avatar) => {
    const hand = playerHandPoint(avatar)
    expect(insideTopScreen(hand)).toBe(true)
    expect(hand.y).toBeLessThan(100)
    expect(hand.x).toBeLessThan(128)
  })

  it('la mano coincide con la bola dibujada en la pose "raise" (esquina de su caja + posición de la mano)', () => {
    const nate = playerHandPoint(AVATARS.nate)
    expect(nate).toEqual({ x: 78 - 45 + (90 - 58) / 2 + 34, y: 182 - 120 + (120 - 117) + 4 })
  })

  it('el aterrizaje del jugador cae sobre su Pokémon, por encima de la caja de mensajes, para todas las especies', () => {
    for (const spriteId of Object.keys(boxes.back)) {
      const landing = playerLandingPoint(spriteId)
      expect(landing.x, spriteId).toBe(PLAYER_SPRITE_CENTER_X)
      expect(landing.y, spriteId).toBeGreaterThan(0)
      expect(landing.y, spriteId).toBeLessThan(147)
    }
  })

  it('el aterrizaje del rival está sobre su plataforma, en el centro de su sprite', () => {
    for (const [spriteId, box] of Object.entries(boxes.front)) {
      const landing = rivalLandingPoint(spriteId)
      expect(landing.x, spriteId).toBe(186)
      expect(landing.y, spriteId).toBeCloseTo(97 - box[3] / 2, 5)
      expect(insideTopScreen(landing), spriteId).toBe(true)
    }
  })

  it('la mano del rival cae sobre su sprite (a la izquierda del centro y entre los pies y la cabeza)', () => {
    for (const [spriteId, box] of Object.entries(boxes.trainer)) {
      const hand = rivalHandPoint(spriteId)
      expect(hand.x, spriteId).toBeLessThan(186)
      expect(hand.x, spriteId).toBeGreaterThan(186 - box[2])
      expect(hand.y, spriteId).toBeLessThan(102)
      expect(hand.y, spriteId).toBeGreaterThan(102 - box[3])
    }
  })

  it('el desplazamiento de salida es mano menos aterrizaje', () => {
    expect(offsetBetween({ x: 83, y: 69 }, { x: 72, y: 134 })).toEqual({ x: 11, y: -65 })
  })

  it('una especie o entrenador sin caja usa un tamaño de reserva en vez de fallar', () => {
    expect(insideTopScreen(rivalHandPoint('desconocido'))).toBe(true)
    expect(insideTopScreen(rivalLandingPoint('desconocido'))).toBe(true)
    expect(insideTopScreen(playerLandingPoint('desconocido'))).toBe(true)
  })

  it('la bola es pequeña respecto a sus entrenadores: a lo sumo un cuarto de la pose del protagonista y un tercio del sprite rival', async () => {
    const { decodePng } = await importScript('scripts/lib/png.mjs')
    const strip = decodePng(readFileSync(fromRoot('public', 'ui', 'battle', 'fx', 'pokeball-strip.png')))
    const ballFrameWidth = strip.width / 7
    for (const avatar of Object.values(AVATARS)) expect(ballFrameWidth, avatar.id).toBeLessThanOrEqual(avatar.raise[2] / 4)
    for (const [trainerId, box] of Object.entries(boxes.trainer)) expect(ballFrameWidth, trainerId).toBeLessThanOrEqual(Math.max(box[2], NARROW_TRAINER_WIDTH) * 0.3)
    expect(ballFrameWidth).toBeLessThanOrEqual(12)
  })
})
