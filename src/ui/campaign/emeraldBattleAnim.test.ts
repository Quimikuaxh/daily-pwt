import { describe, expect, it } from 'vitest'
import type { BattleView, MonView } from '../../battle/protocol'
import { backSpot, ballParticles, ballTarget, barFrames, barHpAt, faintDrop, hpPauseMs, playerBallPath, recallFrame, releaseFrame, sendOutFrame, sendOutLength, viewHp } from './emeraldBattleModel'

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
    expect(sendOutFrame(false, 'geodude', sendOutLength(false, 'geodude'))).toMatchObject({ mon: { scale: 1, tint: 0 }, healthboxDx: 0 })
  })

  it('el jugador: la bola sube en arco desde (24,68), gira a un tercio de velocidad cerca de lo alto y baja hasta 24 px bajo su centro', () => {
    const path = playerBallPath('grovyle')
    const target = ballTarget(true, 'grovyle')
    // 25 pasos, de los que los del giro cuentan uno de cada tres: 43 fotogramas en total.
    expect(path).toHaveLength(43)
    expect(releaseFrame(true, 'grovyle')).toBe(43)
    expect(path[0]).toEqual({ x: 25, y: 65, angle: 0 })
    // Empieza a girar al llegar la fase del arco a 35 (25/256 de vuelta por fotograma) y se para al abrirse.
    expect(path[6].angle).toBe(0)
    expect(path[7].angle).toBeCloseTo(-35.16, 1)
    expect(Math.min(...path.map((step) => step.y))).toBeLessThan(58)
    expect(Math.abs(path.at(-1)!.x - target.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(path.at(-1)!.y - target.y)).toBeLessThanOrEqual(4)
    expect(sendOutFrame(true, 'grovyle', 43)).toMatchObject({ ball: { x: path.at(-1)!.x, y: path.at(-1)!.y, frame: 1, angle: 0 }, mon: { visible: true }, healthboxDx: 110 })
  })

  it('al abrirse salen 16 chispas, una por fotograma en 8 direcciones, que se alejan 2 px por fotograma desde 5 px por encima', () => {
    expect(ballParticles({ x: 100, y: 60 }, 0)).toEqual([{ x: 100, y: 55, frame: 0 }])
    expect(ballParticles({ x: 100, y: 60 }, 15)).toHaveLength(16)
    // La primera (hacia abajo: Sin 0, Cos 0) a los 10 fotogramas va 18 px más abajo.
    expect(ballParticles({ x: 100, y: 60 }, 10)[0]).toMatchObject({ x: 100, y: 55 + 18 })
    expect(ballParticles({ x: 100, y: 60 }, 40)).toHaveLength(0)
    expect(sendOutFrame(false, 'geodude', 15).particles).toEqual([])
    expect(sendOutFrame(false, 'geodude', 16).particles).toHaveLength(1)
  })

  it('la retirada encoge 2/256 por fotograma 18 fotogramas y 16/256 después, tomando el color de la bola', () => {
    expect(recallFrame(0)).toEqual({ visible: true, scale: 254 / 256, tint: 1 / 16 })
    expect(recallFrame(17).scale).toBe(220 / 256)
    expect(recallFrame(18).scale).toBe(204 / 256)
    expect(recallFrame(31)).toMatchObject({ visible: false, scale: 0, tint: 1 })
  })
})
