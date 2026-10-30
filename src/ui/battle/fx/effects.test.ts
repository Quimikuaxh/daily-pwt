import { describe, expect, it } from 'vitest'
import moveFxKinds from '../../../generated/move-fx.json'
import { Prng } from '../../../core/prng'
import { CONDITION_EFFECTS, CUSTOM_EFFECTS, effectFor, GENERIC_EFFECTS, SPECIAL_BY_TYPE, type Effect, type FxKind } from './effects'
import { fxColorsFor } from './fxColors'

// UT-69 · Animaciones de movimientos (DEC-53).
const TEXT_PAUSE_MS = 1100
const TYPES = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel']
const all: [string, Effect][] = [
  ...Object.entries(GENERIC_EFFECTS),
  ...Object.entries(SPECIAL_BY_TYPE).map(([type, effect]): [string, Effect] => [`especial ${type}`, effect]),
  ...Object.entries(CUSTOM_EFFECTS),
  ...Object.entries(CONDITION_EFFECTS),
]

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

  // UT-123 · Día Soleado (Jose, 30/10/2026): rayos de sol desde la esquina de arriba a la izquierda, no puntos que caen como fuego.
  it('Día Soleado pinta rayos de sol desde la esquina de arriba a la izquierda (no puntos que caen) y se apaga al terminar', () => {
    expect(effectFor('sunnyday', 'weather', 'Fire')).toBe(CUSTOM_EFFECTS.sunnyday)
    const middle = drawn(CUSTOM_EFFECTS.sunnyday, 0.5)
    expect(middle.length).toBeGreaterThan(100)
    // Todo dentro del cono que baja hacia la derecha desde el sol (abajo y a la derecha de su centro, con algo de margen por el disco).
    expect(middle.every((dot) => dot.x >= -12 && dot.y >= -12)).toBe(true)
    // Los haces cruzan la pantalla: llegan lejos del sol.
    expect(Math.max(...middle.map((dot) => Math.hypot(dot.x - 14, dot.y - 8)))).toBeGreaterThan(150)
    // Igual en dos instantes seguidos salvo el pulso: no hay partículas que caigan (la nube no se desplaza hacia abajo).
    const later = drawn(CUSTOM_EFFECTS.sunnyday, 0.55)
    const meanY = (dots: { y: number }[]) => dots.reduce((sum, dot) => sum + dot.y, 0) / dots.length
    expect(Math.abs(meanY(later) - meanY(middle))).toBeLessThan(15)
    expect(drawn(CUSTOM_EFFECTS.sunnyday, 1)).toEqual([])
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

  // Cambio de requisito del 30/10/2026 (Jose): cuarta tanda con los cuatro climas propios (la lluvia ya lo era) y 20 movimientos más, y
  // quinta tanda con los 20 siguientes por uso.
  it('104 movimientos con animación propia (cinco tandas de 20, Maldición y tres climas); el resto usa la genérica de su clase (Poder Oculto de cualquier tipo, la suya)', () => {
    expect(Object.keys(CUSTOM_EFFECTS)).toHaveLength(104)
    for (const id of ['sunnyday', 'raindance', 'sandstorm', 'hail', 'trick', 'dragondance', 'lightscreen', 'reflect']) expect(effectFor(id, 'foe'), id).toBe(CUSTOM_EFFECTS[id])
    expect(effectFor('flamethrower', 'shot', 'Fire')).toBe(CUSTOM_EFFECTS.flamethrower)
    expect(effectFor('crunch', 'bite', 'Dark')).toBe(CUSTOM_EFFECTS.crunch)
    expect(effectFor('earthquake', 'hit')).toBe(CUSTOM_EFFECTS.earthquake)
    expect(effectFor('hiddenpowerfire', 'shot')).toBe(CUSTOM_EFFECTS.hiddenpower)
    expect(effectFor('tackle', 'hit')).toBe(GENERIC_EFFECTS.hit)
    expect(effectFor('agility', 'boost')).toBe(GENERIC_EFFECTS.boost)
    expect(effectFor('firefang', 'bite', 'Fire')).toBe(GENERIC_EFFECTS.bite)
  })

  // UT-74 · Estados y bayas (decisiones de Jose del 23/10/2026).
  it('cada estado, la baya y las subidas y bajadas de características tienen su animación', () => {
    expect(Object.keys(CONDITION_EFFECTS).sort()).toEqual(['item:berry', 'stat:down', 'stat:up', 'status:brn', 'status:confusion', 'status:frz', 'status:par', 'status:psn', 'status:slp'])
    expect(effectFor('status:brn', 'foe')).toBe(CONDITION_EFFECTS['status:brn'])
    expect(effectFor('item:berry', 'foe')).toBe(CONDITION_EFFECTS['item:berry'])
  })

  it('Maldición sin ser Fantasma se dibuja sobre el propio usuario; siendo Fantasma, sobre el objetivo', () => {
    const at = (user: { x: number; y: number }, target: { x: number; y: number }) => {
      const dots: { x: number; y: number }[] = []
      const prng = new Prng('c')
      CUSTOM_EFFECTS.curse.draw({ dot: (x, y) => dots.push({ x, y }) }, 0.4, { user, target, type: 'Ghost', ...fxColorsFor('Ghost'), random: () => prng.next() })
      return dots
    }
    const user = { x: 62, y: 110 }
    const rival = { x: 186, y: 78 }
    expect(at(user, user).every((dot) => Math.abs(dot.x - user.x) < 40)).toBe(true)
    expect(at(user, rival).every((dot) => Math.abs(dot.x - rival.x) < 40)).toBe(true)
  })

  it('los ataques especiales sin animación propia usan la de su tipo (cada tipo, la suya; Lanzallamas no son bolas)', () => {
    expect(Object.keys(SPECIAL_BY_TYPE).sort()).toEqual([...TYPES].sort())
    expect(new Set(Object.values(SPECIAL_BY_TYPE)).size).toBe(TYPES.length)
    // Lanzallamas y Surf tienen animación propia desde la tercera tanda (23/10/2026), Onda Ígnea desde la cuarta y Sofoco desde la quinta
    // (30/10/2026): de ejemplo, Danza Llama y Agua Lodosa.
    expect(effectFor('fierydance', 'shot', 'Fire')).toBe(SPECIAL_BY_TYPE.Fire)
    expect(effectFor('muddywater', 'shot', 'Water')).toBe(SPECIAL_BY_TYPE.Water)
    expect(effectFor('icebeam', 'shot', 'Ice')).toBe(CUSTOM_EFFECTS.icebeam)
    expect(effectFor('fierydance', 'shot')).toBe(GENERIC_EFFECTS.shot)
  })

  it('move-fx.json: cada movimiento tiene una clase conocida y los de estado están bien clasificados', () => {
    const kinds = moveFxKinds as Record<string, FxKind>
    for (const kind of Object.values(kinds)) expect(Object.keys(GENERIC_EFFECTS)).toContain(kind)
    expect(kinds).toMatchObject({ earthquake: 'hit', icebeam: 'shot', swordsdance: 'boost', toxic: 'status', recover: 'heal', protect: 'protect', substitute: 'substitute', raindance: 'weather', stealthrock: 'hazard', reflect: 'screen' })
    // Físicos según cómo golpean: muerden, puñetazo, patada, corte; el resto, golpe.
    expect(kinds).toMatchObject({ crunch: 'bite', icepunch: 'punch', highjumpkick: 'kick', xscissor: 'slash', closecombat: 'hit', flamethrower: 'shot' })
  })
})
