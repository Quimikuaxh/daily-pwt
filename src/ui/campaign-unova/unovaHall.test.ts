// UT-233: composición del Salón de la Fama de Teselia (PRD §0, 14/11/2026).
import { describe, expect, it } from 'vitest'
import { HALL_BALL, HALL_COLORS, ballColor, unovaHallOrder, unovaHallSpots } from './unovaHall'

describe('Salón de la Fama de Teselia', () => {
  it('seis huecos: tres atrás (lados y centro) y tres delante (lados y a los pies)', () => {
    const spots = unovaHallSpots(6)
    const back = spots.filter((spot) => !spot.front).map((spot) => spot.x).sort((a, b) => a - b)
    const front = spots.filter((spot) => spot.front).map((spot) => spot.x).sort((a, b) => a - b)
    expect(back).toEqual([52, 128, 204])
    expect(front).toEqual([72, 128, 184])
    // El primero, a los pies del protagonista (centrado).
    expect(spots[0]).toMatchObject({ x: 128, front: true })
  })

  it('con menos supervivientes, solo sus huecos; nunca más de seis', () => {
    expect(unovaHallSpots(1)).toHaveLength(1)
    expect(unovaHallSpots(0)).toHaveLength(0)
    expect(unovaHallSpots(9)).toHaveLength(6)
  })

  it('se pintan primero los de atrás: la fila de delante queda encima', () => {
    const order = unovaHallOrder(6)
    const spots = unovaHallSpots(6)
    const firstFront = order.findIndex((i) => spots[i].front)
    expect(order.slice(firstFront).every((i) => spots[i].front)).toBe(true)
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('Poké Ball del fondo del Salón', () => {
  it('borde oscuro, mitad de arriba más clara que la de abajo, banda y botón en el centro; fuera, nada', () => {
    expect(ballColor(0, 0)).toBeNull()
    expect(ballColor(HALL_BALL.cx, HALL_BALL.cy)).toBe(HALL_COLORS.buttonIn)
    expect(ballColor(HALL_BALL.cx - 50, HALL_BALL.cy - 20)).toBe(HALL_COLORS.top)
    expect(ballColor(HALL_BALL.cx - 50, HALL_BALL.cy + 20)).toBe(HALL_COLORS.bottom)
    expect(ballColor(HALL_BALL.cx - 50, HALL_BALL.cy)).toBe(HALL_COLORS.line)
    expect(ballColor(HALL_BALL.cx, HALL_BALL.cy - HALL_BALL.r + 1)).toBe(HALL_COLORS.line)
  })
})
