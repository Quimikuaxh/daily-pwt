import { expect, it } from 'vitest'
import { loadGameData } from '../../data/gameData'
import { unovaDefinition } from './unovaDefinition'
import { unovaEvolutionDetails } from './unovaEvolutionDetails'

it('describe las siete evoluciones de Eevee con las reglas de Teselia', () => {
  const methods = unovaEvolutionDetails(unovaDefinition, loadGameData(), 'eevee')
  expect(methods).toHaveLength(7)
  expect(methods).toContainEqual({ species: 'espeon', name: 'Espeon', requirement: '3 victorias · de día' })
  expect(methods).toContainEqual({ species: 'leafeon', name: 'Leafeon', requirement: 'En la Liga' })
  expect(methods).toContainEqual({ species: 'vaporeon', name: 'Vaporeon', requirement: 'Piedra Agua' })
})

it('distingue el hito, el nivel por intercambio y el nivel de un movimiento', () => {
  const data = loadGameData()
  expect(unovaEvolutionDetails(unovaDefinition, data, 'magneton')[0].requirement).toBe('Tras vencer a Yakón')
  expect(unovaEvolutionDetails(unovaDefinition, data, 'kadabra')[0].requirement).toBe('Nv. 37')
  expect(unovaEvolutionDetails(unovaDefinition, data, 'aipom')[0].requirement).toMatch(/^Doble Golpe al Nv\./i)
})

it('reproduce la elección de Tyrogue de la campaña', () => {
  const methods = unovaEvolutionDetails(unovaDefinition, loadGameData(), 'tyrogue')
  expect(methods.map(({ requirement }) => requirement)).toEqual(Array(3).fill('Nv. 20 · a elegir'))
})
