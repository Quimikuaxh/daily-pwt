import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import type { CampaignState } from '../../core/nuzlocke/campaign'
import type { CampaignEncounter } from './hoennRoute'
import { hallOfFameSpots, minutesSince, playerNameOf, protagonistOf, recruitedSpecies, resultOf, trainerId } from './resultModel'
import { ResultScreen } from './ResultScreen'

// UT-183 · Resultado de la campaña (D7): qué se enseña al cerrar cada combate, nombre, ficha y pantalla.
const encounters = catalog.encounters as unknown as CampaignEncounter[]
const at = (encounterIndex: number, phase: CampaignState['phase'] = 'prepare') => ({ encounterIndex, phase, seed: 'ut180', members: [] }) as unknown as CampaignState

describe('qué resultado', () => {
  it('medalla tras un gimnasio, «Has vencido» tras el Alto Mando, Salón de la Fama tras el campeón y derrota si se pierde', () => {
    expect(resultOf(at(0, 'battle'), at(1, 'draft'), encounters)).toMatchObject({ mode: 'medal', encounter: { id: 'petra' } })
    expect(resultOf(at(8, 'battle'), at(9, 'prepare'), encounters)).toMatchObject({ mode: 'beaten', encounter: { id: 'sixto' } })
    expect(resultOf(at(12, 'battle'), at(12, 'won'), encounters)).toMatchObject({ mode: 'hallOfFame' })
    expect(resultOf(at(3, 'battle'), at(3, 'lost'), encounters)).toMatchObject({ mode: 'whiteout', encounter: { id: 'candela' } })
  })

  it('nombre: el nickname o el protagonista fijo de la semilla; ID de cinco cifras fijo', () => {
    expect(playerNameOf('s', 'Jose_11')).toBe('Jose_11')
    expect(['BRUNO', 'AURA']).toContain(playerNameOf('s'))
    expect(playerNameOf('s')).toBe(protagonistOf('s') === 'brendan' ? 'BRUNO' : 'AURA')
    expect(trainerId('s')).toMatch(/^\d{5}$/)
    expect(trainerId('s')).toBe(trainerId('s'))
  })

  it('tiempo desde el inicio, especies reclutadas (por su primera forma) y posiciones del Salón de la Fama', () => {
    expect(minutesSince(undefined, 1e9)).toBe(0)
    expect(minutesSince(0, 125 * 60000 + 30000)).toBe(125)
    const members = [{ species: 'grovyle', history: [{ species: 'treecko', evolvedAt: 16 }] }, { species: 'treecko', history: [] }, { species: 'wingull', history: [] }]
    expect(recruitedSpecies({ members } as unknown as CampaignState)).toBe(2)
    expect(hallOfFameSpots(2)).toHaveLength(3)
    expect(hallOfFameSpots(6)).toHaveLength(6)
  })
})

describe('pantalla Resultado', () => {
  beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
  afterEach(() => { vi.restoreAllMocks() })
  const team = [{ species: 'grovyle', name: 'GROVYLE', level: 19, hp: 59, fainted: false }, { species: 'ralts', name: 'RALTS', level: 15, hp: 43, fainted: true }]
  const props = { player: 'BRUNO', protagonist: 'brendan' as const, badges: 1, badgeNames: ['PIEDRA'], card: { id: '41727', points: 20, pokedex: 4, minutes: 75 }, team }

  it('medalla: el mensaje, después la Ficha y después vuelve; las bajas, en el texto accesible', () => {
    const onDone = vi.fn()
    render(<ResultScreen {...props} mode="medal" message="¡BRUNO recibió la MEDALLA PIEDRA de PETRA!" onDone={onDone} scale={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('¡BRUNO recibió la MEDALLA PIEDRA de PETRA!')
    expect(screen.getByText('RALTS, nivel 15, baja permanente')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Continuar: / }))
    expect(screen.getByRole('status')).toHaveTextContent('Ficha de Entrenador. BRUNO. Nº de ID 41727. Puntos Batalla: 20. POKéDEX: 4 especies reclutadas. Tiempo desde el inicio: 1:15. Medallas: PIEDRA.')
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la ruta desde la Ficha de Entrenador' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('derrota y Salón de la Fama: tocar o CANCELAR vuelve a la Ruta', () => {
    const onDone = vi.fn()
    const { unmount } = render(<ResultScreen {...props} mode="whiteout" message="¡BRUNO se ha quedado sin POKéMON que puedan combatir!" onDone={onDone} scale={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('Fin de la campaña. Todas las bajas son permanentes.')
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la ruta' }))
    unmount()
    render(<ResultScreen {...props} mode="hallOfFame" message="¡Bienvenido al SALÓN DE LA FAMA!" onDone={onDone} scale={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('Campeones: GROVYLE.')
    fireEvent.click(screen.getByRole('button', { name: /^Continuar: / }))
    expect(onDone).toHaveBeenCalledTimes(2)
  })
})
