import { describe, it, expect } from 'vitest'
import { assembleGameData, loadGameData } from './gameData'
import { DataError } from '../core/errors'
import { makeGameData } from '../test-utils/fixtures'

// TODO-CONTRATO: src/data/gameData.ts exporta
//   loadGameData(): GameData   -> ensambla data/*.json + src/generated/*.json (import estático), síncrono.
//   assembleGameData(raw: {trainers, playerSets, dex, names}): GameData -> valida la forma y lanza DataError (español).
// GameData = { dataVersion, trainers, rosterSchedule, playerSets, dex, names }; data/trainers.json = { dataVersion, rosterSchedule, trainers }.
describe('loadGameData (datos reales)', () => {
  const data = loadGameData()

  it('carga los 5 entrenadores de F1', () => {
    expect(data.trainers.map((t) => t.id).sort()).toEqual(['brock', 'camila', 'misty', 'plubio', 'rojo'])
  })

  it('tiene dataVersion no vacía', () => {
    expect(data.dataVersion.length).toBeGreaterThan(0)
  })

  it('tiene un rosterSchedule que arranca en el día 0 con los 5 ids', () => {
    expect(data.rosterSchedule[0]).toMatchObject({ fromDayIndex: 0 })
    expect([...data.rosterSchedule[0].trainerIds].sort()).toEqual(['brock', 'camila', 'misty', 'plubio', 'rojo'])
  })

  it('incluye pool del jugador, dex y nombres', () => {
    expect([data.playerSets.length > 0, Object.keys(data.dex.species).length > 0, Object.keys(data.names.species).length > 0]).toEqual([true, true, true])
  })
})

describe('assembleGameData', () => {
  const g = makeGameData()
  const raw = () => ({
    trainers: { dataVersion: g.dataVersion, rosterSchedule: g.rosterSchedule, trainers: g.trainers },
    playerSets: g.playerSets, dex: g.dex, names: g.names,
  })

  it('acepta datos válidos', () => {
    expect(assembleGameData(raw() as any).trainers).toHaveLength(3)
  })

  it('lanza DataError si falta la lista de entrenadores', () => {
    expect(() => assembleGameData({ ...raw(), trainers: undefined } as any)).toThrow(DataError)
  })

  it('lanza DataError con JSON de otra forma (array en lugar de objeto)', () => {
    expect(() => assembleGameData({ ...raw(), trainers: [] } as any)).toThrow(DataError)
  })

  it('lanza DataError si el pool no es una lista', () => {
    expect(() => assembleGameData({ ...raw(), playerSets: {} } as any)).toThrow(DataError)
  })

  it('el mensaje está en español y no filtra trazas', () => {
    let msg = ''
    try { assembleGameData({ ...raw(), dex: null } as any) } catch (e) { msg = (e as Error).message }
    expect(msg).toMatch(/datos/i)
    expect(msg).not.toMatch(/undefined|TypeError|at /)
  })
})
