import { describe, expect, it } from 'vitest'
import spriteBoxes from '../../generated/sprite-boxes.json'
import { MESSAGE_BOX_TOP, SCREEN_BOTTOM, backSpriteHeight, playerSpriteScale, playerSpriteVisibleSpan, substituteBackHeight } from './playerSpriteAnchor'

const backBoxes = (spriteBoxes as { back: Record<string, number[]> }).back

describe('ancla del sprite del jugador respecto a la caja de mensajes', () => {
  it.each(['stunfisk', 'milotic', 'venusaur', 'starmie', 'aerodactyl'])('%s: el cuerpo queda sobre la caja y solo se pierde la parte baja', (spriteId) => {
    const height = backSpriteHeight(spriteId)
    const { top, bottom } = playerSpriteVisibleSpan(height)
    expect(height).toBeGreaterThan(0)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(bottom).toBeLessThanOrEqual(SCREEN_BOTTOM)
    const visibleAboveBox = Math.min(bottom, MESSAGE_BOX_TOP) - top
    expect(visibleAboveBox / (bottom - top)).toBeGreaterThanOrEqual(0.58)
    expect(bottom).toBeGreaterThan(MESSAGE_BOX_TOP)
  })

  it('con todos los sprites de espaldas del repo: al menos el 58 % visible y nada sale por arriba', () => {
    const ids = Object.keys(backBoxes)
    expect(ids.length).toBeGreaterThanOrEqual(33)
    for (const spriteId of ids) {
      const { top, bottom } = playerSpriteVisibleSpan(backSpriteHeight(spriteId))
      expect(top, spriteId).toBeGreaterThanOrEqual(0)
      expect((Math.min(bottom, MESSAGE_BOX_TOP) - top) / (bottom - top), spriteId).toBeGreaterThanOrEqual(0.58)
    }
  })

  it('una especie sin caja usa un alto de reserva en vez de fallar', () => {
    expect(backSpriteHeight('inexistente')).toBeGreaterThan(0)
  })
})

describe('escala del sprite del jugador', () => {
  it('es 2x salvo que el sprite superase la pantalla, y entonces se reduce lo justo', () => {
    expect(playerSpriteScale(80)).toBe(2)
    expect(playerSpriteScale(98)).toBeCloseTo(SCREEN_BOTTOM / 98)
    expect(playerSpriteVisibleSpan(98).top).toBeGreaterThanOrEqual(0)
  })
})

// UT-89 · con un sustituto en pie, el jugador se apoya por el alto del muñeco (de sprite-boxes.json), no por el del Pokémon.
describe('ancla del muñeco del sustituto', () => {
  it('usa el alto real del muñeco de espaldas y queda sobre la caja como un Pokémon', () => {
    const height = (spriteBoxes as unknown as { substitute: { back: number[] } }).substitute.back[3]
    expect(substituteBackHeight()).toBe(height)
    const span = playerSpriteVisibleSpan(height)
    expect(span.top).toBeLessThan(MESSAGE_BOX_TOP)
    expect(span.bottom).toBeLessThanOrEqual(SCREEN_BOTTOM)
  })
})
