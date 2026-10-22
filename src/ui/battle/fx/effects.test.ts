import { describe, expect, it } from 'vitest'
import moveFxKinds from '../../../generated/move-fx.json'
import { Prng } from '../../../core/prng'
import { CUSTOM_EFFECTS, effectFor, GENERIC_EFFECTS, type Effect, type FxKind } from './effects'
import { fxColorsFor } from './fxColors'

// UT-69 · Animaciones de movimientos (DEC-53).
const TEXT_PAUSE_MS = 1100
const all: [string, Effect][] = [...Object.entries(GENERIC_EFFECTS), ...Object.entries(CUSTOM_EFFECTS)]

function drawn(effect: Effect, progress: number, seed = 'x') {
  const dots: { x: number; y: number; size: number }[] = []
  const prng = new Prng(seed)
  effect.draw({ dot: (x, y, size) => dots.push({ x, y, size }) }, progress, {
    user: { x: 62, y: 110 },
    target: { x: 186, y: 78 },
    type: 'Fire',
    ...fxColorsFor('Fire'),
    random: () => prng.next(),
  })
  return dots
}

describe('efectos de movimientos', () => {
  it.each(all)('%s: cabe en el tiempo del mensaje «X usó Y» y dibuja algo a lo largo del efecto', (_, effect) => {
    expect(effect.duration).toBeLessThanOrEqual(TEXT_PAUSE_MS)
    const frames = [0.1, 0.3, 0.5, 0.7, 0.9].map((progress) => drawn(effect, progress).length)
    expect(frames.some((count) => count > 0)).toBe(true)
  })

  it.each(all)('%s: coordenadas finitas, puntos de 1 a 7 px y casi todo dentro del lienzo', (_, effect) => {
    for (let progress = 0; progress <= 1; progress += 0.05) {
      const dots = drawn(effect, progress)
      for (const dot of dots) {
        expect(Number.isFinite(dot.x) && Number.isFinite(dot.y)).toBe(true)
        expect(dot.size).toBeGreaterThanOrEqual(1)
        expect(dot.size).toBeLessThanOrEqual(7)
      }
      const inside = dots.filter((dot) => dot.x >= -8 && dot.x <= 264 && dot.y >= -16 && dot.y <= 200)
      expect(inside.length).toBe(dots.length)
    }
  })

  it.each(all)('%s: con la misma semilla dibuja lo mismo en el mismo instante (no salta entre fotogramas)', (_, effect) => {
    expect(drawn(effect, 0.42, 'a')).toEqual(drawn(effect, 0.42, 'a'))
  })

  it('los temblores son de pocos píxeles y se apagan al terminar', () => {
    for (const [name, effect] of all) {
      if (!effect.shake) continue
      for (let progress = 0; progress <= 1; progress += 0.02) {
        const shake = effect.shake(progress)
        if (shake) expect(Math.abs(shake.dx) + Math.abs(shake.dy), name).toBeLessThanOrEqual(6)
      }
      expect(effect.shake(1), name).toBeNull()
    }
  })

  it('20 movimientos con animación propia; el resto usa la genérica de su clase (Poder Oculto de cualquier tipo, la suya)', () => {
    expect(Object.keys(CUSTOM_EFFECTS)).toHaveLength(20)
    expect(effectFor('earthquake', 'hit')).toBe(CUSTOM_EFFECTS.earthquake)
    expect(effectFor('hiddenpowerfire', 'shot')).toBe(CUSTOM_EFFECTS.hiddenpower)
    expect(effectFor('tackle', 'hit')).toBe(GENERIC_EFFECTS.hit)
    expect(effectFor('calmmind', 'boost')).toBe(GENERIC_EFFECTS.boost)
  })

  it('move-fx.json: cada movimiento tiene una clase conocida y los de estado están bien clasificados', () => {
    const kinds = moveFxKinds as Record<string, FxKind>
    for (const kind of Object.values(kinds)) expect(Object.keys(GENERIC_EFFECTS)).toContain(kind)
    expect(kinds).toMatchObject({ earthquake: 'hit', icebeam: 'shot', swordsdance: 'boost', toxic: 'status', recover: 'heal', protect: 'protect', substitute: 'substitute', raindance: 'weather', stealthrock: 'hazard', reflect: 'screen' })
  })
})
