import { describe, expect, it } from 'vitest'
import type { BattleView, MonView } from '../../battle/protocol'
import { backSpot, ballTarget, barFrames, barHpAt, faintDrop, hpPauseMs, recallFrame, sendOutFrame, sendOutLength, viewHp } from './emeraldBattleModel'

// UT-189 · Animaciones del combate de Esmeralda: barra de PS al ritmo de Gen 3 (CalcNewBarValue), caída al debilitarse, envío y retirada.
const mon = (species: string, extra: Partial<MonView>): MonView => ({ species, hpPercent: 100, status: null, fainted: false, ...extra })
const view = (player: MonView, rival: MonView) => ({ player: { active: 0, team: [player] }, rival: { active: 0, team: [rival] } }) as unknown as BattleView

describe('barra de PS de Gen 3', () => {
  it('con 48 PS máximos o más baja y sube 1 PS por fotograma', () => {
    expect([0, 1, 2, 30, 31].map((frame) => barHpAt(100, 70, 120, frame))).toEqual([100, 99, 98, 70, 70])
    expect(barHpAt(10, 15, 60, 3)).toBe(13)
    expect(barFrames(100, 70, 120)).toBe(30)
    expect(barFrames(120, 0, 120)).toBe(120)
  })

  it('con menos de 48 baja 1 píxel por fotograma (máximos/48 PS, redondeando hacia arriba al bajar)', () => {
    // 24 PS: medio PS por fotograma; de 24 a 12 son 24 fotogramas, y el número va 24, 24, 23, 23…
    expect([1, 2, 3, 4].map((frame) => barHpAt(24, 12, 24, frame))).toEqual([24, 23, 23, 22])
    expect(barFrames(24, 12, 24)).toBe(24)
    expect(barFrames(12, 24, 24)).toBe(24)
  })

  it('PS de la vista: los reales del jugador y, del rival, su porcentaje sobre sus PS máximos', () => {
    expect(viewHp(mon('grovyle', { hp: 40, maxHp: 80 }), () => 0)).toEqual({ hp: 40, maxHp: 80 })
    expect(viewHp(mon('geodude', { hpPercent: 50 }), () => 90)).toEqual({ hp: 45, maxHp: 90 })
    expect(viewHp(mon('geodude', { hpPercent: 0, fainted: true }), () => 90)).toEqual({ hp: 0, maxHp: 90 })
  })

  it('la espera tras un golpe es lo que tarda la barra más lenta, más 100 ms', () => {
    const before = view(mon('grovyle', { hp: 80, maxHp: 80 }), mon('geodude', { hpPercent: 100 }))
    const hitRival = view(mon('grovyle', { hp: 80, maxHp: 80 }), mon('geodude', { hpPercent: 40 }))
    // 60 % de 100 PS: 60 fotogramas = 1000 ms.
    expect(hpPauseMs(before, hitRival, () => 100)).toBe(1100)
    expect(hpPauseMs(before, before, () => 100)).toBe(100)
  })
})

describe('caída al debilitarse', () => {
  it('el rival baja 8 px cada 2 fotogramas en 8 − frontY/8 pasos (SpriteCB_AnimFaintOpponent)', () => {
    expect(faintDrop(false, 'geodude')).toEqual({ steps: 6, distance: 48, frames: 12 })
  })

  it('el del jugador baja 5 px por fotograma hasta que su centro pasa de y 160 (SpriteCB_FaintSlideAnim)', () => {
    const center = backSpot('grovyle').y + 32
    const drop = faintDrop(true, 'grovyle')
    expect(center + drop.distance).toBeGreaterThan(160)
    expect(center + drop.distance - 5).toBeLessThanOrEqual(160)
    expect(drop.frames).toBe(drop.steps)
  })
})

describe('envío y retirada', () => {
  it('el rival: bola cerrada 16 fotogramas en su sitio, se abre (5 + 5) y el Pokémon sale creciendo y subiendo con el color de la bola', () => {
    expect(sendOutFrame(false, 'geodude', 0)).toMatchObject({ ball: { ...ballTarget(false, 'geodude'), frame: 0 }, mon: { visible: false }, healthboxDx: null })
    expect(sendOutFrame(false, 'geodude', 16)).toMatchObject({ ball: { frame: 1 }, mon: { visible: true, scale: 0x28 / 256, dy: 14, tint: 1 }, healthboxDx: -110 })
    expect(sendOutFrame(false, 'geodude', 21).ball?.frame).toBe(2)
    expect(sendOutFrame(false, 'geodude', 26).ball).toBeNull()
    expect(sendOutFrame(false, 'geodude', 28).mon).toMatchObject({ scale: 1, dy: 0, tint: 0.25 })
    expect(sendOutFrame(false, 'geodude', sendOutLength(false))).toMatchObject({ mon: { scale: 1, tint: 0 }, healthboxDx: 0 })
  })

  it('el jugador: la bola vuela 25 fotogramas en arco desde (24,68) hasta 24 px bajo su centro', () => {
    const target = ballTarget(true, 'grovyle')
    expect(sendOutFrame(true, 'grovyle', 0).ball).toEqual({ x: 24, y: 68, frame: 0 })
    const middle = sendOutFrame(true, 'grovyle', 12).ball
    // A mitad de camino, 30 px por encima de la recta.
    expect(68 + ((target.y - 68) * 12) / 25 - middle!.y).toBeGreaterThan(28)
    expect(sendOutFrame(true, 'grovyle', 25)).toMatchObject({ ball: { ...target, frame: 1 }, mon: { visible: true }, healthboxDx: 110 })
  })

  it('la retirada encoge 2/256 por fotograma 18 fotogramas y 16/256 después, tomando el color de la bola', () => {
    expect(recallFrame(0)).toEqual({ visible: true, scale: 254 / 256, tint: 1 / 16 })
    expect(recallFrame(17).scale).toBe(220 / 256)
    expect(recallFrame(18).scale).toBe(204 / 256)
    expect(recallFrame(31)).toMatchObject({ visible: false, scale: 0, tint: 1 })
  })
})
