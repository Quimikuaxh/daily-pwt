// UT-233: composición del Salón de la Fama de Teselia, según las maquetas aprobadas (PRD §0, 14/11/2026).
import { describe, expect, it } from 'vitest'
import { HALL_BAND, HALL_BAR, HALL_COLORS, HALL_PROTAGONIST, hallColor, unovaHallOrder, unovaHallSpots } from './unovaHall'

describe('Salón de la Fama de Teselia', () => {
  it('seis huecos: tres atrás (lados y centro) y tres delante (lados y a los pies del protagonista)', () => {
    const spots = unovaHallSpots(6)
    expect(spots.filter((spot) => !spot.front)).toHaveLength(3)
    expect(spots.filter((spot) => spot.front)).toHaveLength(3)
    // El tercero, atrás en el centro, sobre el protagonista; el sexto, delante, a sus pies.
    const middle = (spot: { x: number; size: number }) => spot.x + spot.size / 2
    const protagonist = HALL_PROTAGONIST.left + HALL_PROTAGONIST.size / 2
    expect(Math.abs(middle(spots[2]) - protagonist)).toBeLessThan(40)
    expect(spots[5].front).toBe(true)
    expect(spots[5].y).toBeGreaterThan(spots[2].y)
  })

  it('con menos supervivientes, solo sus huecos; nunca más de seis', () => {
    expect(unovaHallSpots(1)).toHaveLength(1)
    expect(unovaHallSpots(0)).toHaveLength(0)
    expect(unovaHallSpots(9)).toHaveLength(6)
  })

  it('se pintan primero los de atrás (el del centro el primero): la fila de delante queda encima', () => {
    const order = unovaHallOrder(6)
    const spots = unovaHallSpots(6)
    expect(order[0]).toBe(2)
    const firstFront = order.findIndex((i) => spots[i].front)
    expect(order.slice(firstFront).every((i) => spots[i].front)).toBe(true)
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('Fondo del Salón', () => {
  it('banda blanca arriba, barra oscura con su raya abajo y la Poké Ball gris a la izquierda', () => {
    expect(hallColor(128, HALL_BAND.top + 1)).toBe(HALL_COLORS.band)
    expect(hallColor(128, HALL_BAR.top)).toBe(HALL_COLORS.barLine)
    expect(hallColor(128, HALL_BAR.top + 10)).toBe(HALL_COLORS.bar)
    expect(hallColor(50, 84)).toBe(HALL_COLORS.bg) // botón: anillo oscuro…
    expect(hallColor(50, 114)).toBe(HALL_COLORS.rim) // …con el centro claro
    expect(hallColor(100, 60)).toBe(HALL_COLORS.inner)
    expect(hallColor(120, 114)).toBe(HALL_COLORS.bg) // la raya de en medio
    expect(hallColor(240, 60)).toBe(HALL_COLORS.bg) // a la derecha, fuera de la Poké Ball
  })
})
