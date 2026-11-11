import { describe, expect, it } from 'vitest'
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import { createCampaign, type CampaignDefinition, type CampaignState } from '../../core/nuzlocke/campaign'
import { availableCampaignMoves } from '../../core/nuzlocke/progression'
import { loadGameData } from '../../data/gameData'
import { equippedMoves, learnMove, legalMoves } from './movesModel'

// UT-176 · Modelo de la pantalla Movimientos (D7).
const definition = { encounters: catalog.encounters, species: progression.species } as unknown as CampaignDefinition
const data = loadGameData()
const totodile = { id: 'totodile-1', species: 'totodile', level: 15, history: [], fainted: false, victories: 0 }
const state = { ...createCampaign('ut176'), phase: 'prepare', encounterIndex: 1, members: [totodile] } as unknown as CampaignState

describe('lista del Recordador', () => {
  it('son todos los legales: primero por nivel de aprendizaje, después las MT/MO por número', () => {
    const list = legalMoves(definition, state, state.members[0], data)
    expect(list.map((move) => move.id).sort()).toEqual(availableCampaignMoves(definition, state, state.members[0]).sort())
    const levels = list.flatMap((move) => ('level' in move.source ? [move.source.level] : []))
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    const firstMachine = list.findIndex((move) => 'machine' in move.source)
    if (firstMachine >= 0) expect(list.slice(firstMachine).every((move) => 'machine' in move.source && /^(MT|MO)\d\d$/.test(move.source.machine))).toBe(true)
  })

  it('cada movimiento lleva nombre, tipo, datos de Gen 3 y su descripción en dos líneas', () => {
    const watergun = legalMoves(definition, state, state.members[0], data).find((move) => move.id === 'watergun')!
    expect(watergun).toMatchObject({ name: 'PISTOLA AGUA', type: 'water', typeName: 'AGUA', category: 'Special', power: 40, accuracy: 100, pp: 25 })
    expect(watergun.text.split('\n')).toHaveLength(2)
  })

  it('entra con los elegidos o, sin ellos, con los de por defecto', () => {
    expect(equippedMoves(definition, state, state.members[0])).toHaveLength(4)
    const chosen = { ...state, members: [{ ...totodile, moves: ['watergun'] }] } as unknown as CampaignState
    expect(equippedMoves(definition, chosen, chosen.members[0])).toEqual(['watergun'])
  })
})

describe('aprender y olvidar', () => {
  it('con hueco lo añade; con cuatro hace falta elegir cuál olvidar; nunca repite', () => {
    expect(learnMove(['a'], 'b')).toEqual(['a', 'b'])
    expect(learnMove(['a', 'b', 'c', 'd'], 'e')).toBeNull()
    expect(learnMove(['a', 'b', 'c', 'd'], 'e', 2)).toEqual(['a', 'b', 'e', 'd'])
    expect(learnMove(['a', 'b', 'c', 'd'], 'e', 4)).toBeNull()
    expect(learnMove(['a', 'b'], 'a')).toBeNull()
  })
})
