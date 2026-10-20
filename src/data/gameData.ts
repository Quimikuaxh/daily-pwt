import trainersFile from '../../data/trainers.json'
import playerSets from '../../data/player-sets.json'
import dex from '../generated/dex-gen5.json'
import names from '../generated/names-es.json'
import { DataError } from '../core/errors'
import type { DexData, GameData, NamesEs, PokemonSet, RosterScheduleEntry, Trainer } from '../core/types'

export type RawGameData = {
  trainers: { dataVersion: string; rosterSchedule: RosterScheduleEntry[]; trainers: Trainer[] }
  playerSets: PokemonSet[]
  dex: DexData
  names: NamesEs
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function corrupted(part: string): DataError {
  return new DataError(`Los datos del juego están dañados o incompletos (${part}).`)
}

/** Valida la forma de los JSON en la frontera del sistema y los ensambla. */
export function assembleGameData(raw: RawGameData): GameData {
  const trainersFile: unknown = raw?.trainers
  if (!isRecord(trainersFile)) throw corrupted('entrenadores')
  if (!Array.isArray(trainersFile.trainers)) throw corrupted('lista de entrenadores')
  if (!Array.isArray(trainersFile.rosterSchedule)) throw corrupted('calendario de entrenadores')
  if (typeof trainersFile.dataVersion !== 'string' || trainersFile.dataVersion === '') throw corrupted('versión de los datos')
  if (!Array.isArray(raw.playerSets)) throw corrupted('pool del jugador')

  const dexData: unknown = raw.dex
  if (!isRecord(dexData) || !isRecord(dexData.species) || !isRecord(dexData.moves) || !isRecord(dexData.typeChart)) throw corrupted('dex')
  const namesData: unknown = raw.names
  if (!isRecord(namesData) || !['species', 'moves', 'abilities', 'items', 'types'].every((key) => isRecord(namesData[key]))) {
    throw corrupted('nombres')
  }

  return {
    dataVersion: trainersFile.dataVersion,
    trainers: trainersFile.trainers as Trainer[],
    rosterSchedule: trainersFile.rosterSchedule as RosterScheduleEntry[],
    playerSets: raw.playerSets,
    dex: raw.dex,
    names: raw.names,
  }
}

export function loadGameData(): GameData {
  return assembleGameData({ trainers: trainersFile, playerSets, dex, names } as unknown as RawGameData)
}
