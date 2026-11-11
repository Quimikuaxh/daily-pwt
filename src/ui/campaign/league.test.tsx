import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import { createCampaign, type CampaignDefinition, type CampaignState } from '../../core/nuzlocke/campaign'
import type { CampaignEncounter } from './hoennRoute'
import { leagueBeaten, participantText, toggleParticipant } from './leagueModel'
import { leagueEvolutions, nextStep, optionsWidth } from './evolutionModel'
import { LeagueScreen } from './LeagueScreen'
import { EvolutionScene } from './EvolutionScene'

// UT-184 · Liga de la campaña (D7): participantes del Frente Batalla, evoluciones de la Liga y sus pantallas.
const encounters = catalog.encounters as unknown as CampaignEncounter[]
const definition = { encounters, species: progression.species } as unknown as CampaignDefinition
const member = (id: string, species: string, extra: object = {}) => ({ id, species, level: 45, history: [], fainted: false, victories: 3, ...extra })

describe('modelo de la Liga', () => {
  it('cuenta los rivales de la Liga superados desde el primero del Alto Mando', () => {
    expect(leagueBeaten(8, encounters)).toBe(0)
    expect(leagueBeaten(12, encounters)).toBe(4)
    expect(leagueBeaten(3, encounters)).toBe(0)
  })

  it('tocar añade al final o quita y renumera; nunca más de seis; los huecos dicen APTO, NO APTO o el orden', () => {
    expect(toggleParticipant(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
    expect(toggleParticipant(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
    expect(toggleParticipant(['a', 'b', 'c', 'd', 'e', 'f'], 'g')).toHaveLength(6)
    expect(participantText('c', false, ['a', 'c'])).toBe('2.º')
    expect(participantText('x', false, ['a'])).toBe('APTO')
    expect(participantText('x', true, [])).toBe('NO APTO')
  })

  it('evolucionan los vivos con forma final distinta (sin objetos); los caídos y los finales, no', () => {
    const state = { ...createCampaign('ut184'), phase: 'prepare', encounterIndex: 8,
      members: [member('a', 'kirlia'), member('b', 'grovyle'), member('c', 'gloom'), member('d', 'sceptile'), member('e', 'ralts', { fainted: true })] } as unknown as CampaignState
    expect(leagueEvolutions(definition, state).map((evolution) => [evolution.id, evolution.targets])).toEqual([['a', ['gardevoir']], ['b', ['sceptile']]])
    expect(nextStep('evolving', 1)).toBe('evolved')
    expect(nextStep('evolving', 2)).toBe('choose')
    expect(nextStep('evolved', 2)).toBeNull()
    expect(optionsWidth(['VILEPLUME', 'BELLOSSOM'])).toBe(11)
  })
})

describe('pantallas de la Liga', () => {
  beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
  afterEach(() => { vi.restoreAllMocks() })
  const members = [{ id: 'a', species: 'sceptile', name: 'SCEPTILE', level: 45, hp: 130, fainted: false }, { id: 'b', species: 'ralts', name: 'RALTS', level: 30, hp: 60, fainted: true }]

  it('elegir participantes: el caído no es apto, sin ninguno no se acepta y ACEPTAR devuelve el orden', () => {
    const onAccept = vi.fn()
    render(<LeagueScreen rival={encounters[8]} beaten={0} members={members} roster={null} speciesName={(id) => id.toUpperCase()} onAccept={onAccept} onCancel={vi.fn()} scale={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar participantes de la Liga' }))
    expect(screen.getByRole('status')).toHaveTextContent('Elige al menos un POKéMON.')
    fireEvent.click(screen.getByRole('button', { name: 'RALTS, nivel 30, NO APTO' }))
    expect(screen.getByRole('status')).toHaveTextContent('Este POKéMON no es apto.')
    fireEvent.click(screen.getByRole('button', { name: 'SCEPTILE, nivel 45, APTO' }))
    expect(screen.getByRole('button', { name: 'SCEPTILE, nivel 45, 1.º' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar participantes de la Liga' }))
    expect(onAccept).toHaveBeenCalledWith(['a'])
  })

  it('con la plantilla fijada no se cambia y ACEPTAR lleva al combate', () => {
    const onAccept = vi.fn()
    render(<LeagueScreen rival={encounters[9]} beaten={1} members={members} roster={['a']} speciesName={(id) => id.toUpperCase()} onAccept={onAccept} onCancel={vi.fn()} scale={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'SCEPTILE, nivel 45, 1.º' }))
    expect(screen.getByRole('status')).toHaveTextContent('Participantes fijados')
    fireEvent.click(screen.getByRole('button', { name: 'Combatir contra el siguiente rival de la Liga' }))
    expect(onAccept).toHaveBeenCalledWith(['a'])
  })

  it('escena de evolución: anuncia, pregunta si hay varias formas, felicita y devuelve las elegidas', () => {
    const onDone = vi.fn()
    render(<EvolutionScene evolutions={[{ id: 'a', species: 'gloom', level: 45, targets: ['bellossom', 'vileplume'] }, { id: 'b', species: 'kirlia', level: 45, targets: ['gardevoir'] }]}
      nameOf={(id) => id.toUpperCase()} hpOf={() => 100} onDone={onDone} scale={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('¿Qué? ¡GLOOM está evolucionando!')
    fireEvent.click(screen.getByRole('button', { name: /^Continuar: / }))
    expect(screen.getByRole('status')).toHaveTextContent('¿En qué debería evolucionar GLOOM?')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Evolucionar en VILEPLUME' }))
    expect(screen.getByRole('status')).toHaveTextContent('¡Enhorabuena! ¡Tu GLOOM ha evolucionado en VILEPLUME!')
    fireEvent.click(screen.getByRole('button', { name: /^Continuar: / }))
    expect(screen.getByRole('status')).toHaveTextContent('¿Qué? ¡KIRLIA está evolucionando!')
    fireEvent.click(screen.getByRole('button', { name: /^Continuar: / }))
    expect(screen.getByRole('status')).toHaveTextContent('¡Enhorabuena! ¡Tu KIRLIA ha evolucionado en GARDEVOIR!')
    fireEvent.click(screen.getByRole('button', { name: /^Continuar: / }))
    expect(onDone).toHaveBeenCalledWith({ a: 'vileplume', b: 'gardevoir' })
  })
})
