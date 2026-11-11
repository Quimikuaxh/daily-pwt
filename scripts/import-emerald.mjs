import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { isMain } from './lib/cli.mjs'
import { EMERALD_REVISION as REVISION, gen3, readEmeraldSource } from './lib/emerald-source.mjs'
import { toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'

const SOURCE_HASHES = {
  'trainers.h': 'd5742b3218d74592404cbd5cfe51a35b7ad13b169e035f5cf779e24297dd8aa1',
  'trainer_parties.h': 'cedc9bd12f4a004a888e45bd62cef5d965c6ce382fea60f55aa6f05f091cb932',
}
export const EMERALD_CATALOG = fromRoot('data', 'nuzlocke', 'hoenn-emerald.json')

const ENCOUNTERS = [
  { id: 'petra', nameEs: 'Petra', kind: 'gym', sourceTrainer: 'TRAINER_ROXANNE_1' },
  { id: 'marcial', nameEs: 'Marcial', kind: 'gym', sourceTrainer: 'TRAINER_BRAWLY_1' },
  { id: 'erico', nameEs: 'Erico', kind: 'gym', sourceTrainer: 'TRAINER_WATTSON_1' },
  { id: 'candela', nameEs: 'Candela', kind: 'gym', sourceTrainer: 'TRAINER_FLANNERY_1' },
  { id: 'norman', nameEs: 'Norman', kind: 'gym', sourceTrainer: 'TRAINER_NORMAN_1' },
  { id: 'alana', nameEs: 'Alana', kind: 'gym', sourceTrainer: 'TRAINER_WINONA_1' },
  { id: 'vito-y-leti', nameEs: 'Vito y Leti', kind: 'gym', sourceTrainer: 'TRAINER_TATE_AND_LIZA_1' },
  { id: 'galano', nameEs: 'Galano', kind: 'gym', sourceTrainer: 'TRAINER_JUAN_1' },
  { id: 'sixto', nameEs: 'Sixto', kind: 'elite', sourceTrainer: 'TRAINER_SIDNEY' },
  { id: 'fatima', nameEs: 'Fátima', kind: 'elite', sourceTrainer: 'TRAINER_PHOEBE' },
  { id: 'nivea', nameEs: 'Nívea', kind: 'elite', sourceTrainer: 'TRAINER_GLACIA' },
  { id: 'dracon', nameEs: 'Dracón', kind: 'elite', sourceTrainer: 'TRAINER_DRAKE' },
  { id: 'plubio', nameEs: 'Plubio', kind: 'champion', sourceTrainer: 'TRAINER_WALLACE' },
]

const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const isCanonical = (table, id) => typeof id === 'string' && table.get(id)?.id === id

function validateTeam(team, label) {
  if (!Array.isArray(team) || !inRange(team.length, 1, 6)) {
    throw new Error(`${label}: se esperan de 1 a 6 Pokémon`)
  }

  for (const [index, member] of team.entries()) {
    const slot = `${label}, Pokémon ${index + 1}`
    if (!isCanonical(gen3.species, member?.species)) throw new Error(`${slot}: especie inválida`)
    if (!inRange(member.level, 1, 100)) throw new Error(`${slot}: nivel inválido`)
    if (!inRange(member.iv, 0, 31)) throw new Error(`${slot}: IV inválido`)
    if (member.item !== null && !isCanonical(gen3.items, member.item)) throw new Error(`${slot}: objeto inválido`)
    if (!Array.isArray(member.moves) || !inRange(member.moves.length, 1, 4) ||
      new Set(member.moves).size !== member.moves.length ||
      member.moves.some(move => !isCanonical(gen3.moves, move))) {
      throw new Error(`${slot}: movimientos inválidos`)
    }
  }
}

export function parseEmeraldTeam(sourceTrainer, trainersSource, partiesSource) {
  const entry = [...trainersSource.matchAll(/^\s*\[(TRAINER_[A-Z0-9_]+)\]\s*=\s*\{([\s\S]*?)^\s*\},/gm)]
    .find(([, trainer]) => trainer === sourceTrainer)
  const partyName = entry?.[2].match(/\.party\s*=\s*ITEM_CUSTOM_MOVES\((sParty_\w+)\)/)?.[1]
  if (!partyName) throw new Error(`${sourceTrainer}: falta el equipo o no declara movimientos y objetos`)

  const party = [...partiesSource.matchAll(/TrainerMonItemCustomMoves\s+(sParty_\w+)\[\]\s*=\s*\{([\s\S]*?)^\s*\};/gm)]
    .find(([, name]) => name === partyName)
  if (!party) throw new Error(`${sourceTrainer}: falta la definición de ${partyName}`)

  const memberPattern = /\{([^{}]*\{[^{}]*\}[^{}]*)\}/g
  const members = [...party[2].matchAll(memberPattern)]
  if (party[2].replace(memberPattern, '').replace(/[\s,]/g, '')) {
    throw new Error(`${sourceTrainer}: miembros con formato inesperado en ${partyName}`)
  }
  const team = members.map(([, member], index) => {
    const species = member.match(/\.species\s*=\s*SPECIES_([A-Z0-9_]+)\s*,/)?.[1]
    const level = Number(member.match(/\.lvl\s*=\s*(\d+)\s*,/)?.[1])
    const rawIv = Number(member.match(/\.iv\s*=\s*(\d+)\s*,/)?.[1])
    const item = member.match(/\.heldItem\s*=\s*ITEM_([A-Z0-9_]+)\s*,/)?.[1]
    const moves = member.match(/\.moves\s*=\s*\{([^{}]*)\}/)?.[1].split(',').map(move => move.trim()).filter(Boolean)
    if (!species || !item || !moves?.every(move => /^MOVE_[A-Z0-9_]+$/.test(move)) || !inRange(rawIv, 0, 255)) {
      throw new Error(`${sourceTrainer}, Pokémon ${index + 1}: campos inválidos`)
    }
    return {
      species: toId(species),
      level,
      item: item === 'NONE' ? null : toId(item),
      moves: moves.filter(move => move !== 'MOVE_NONE').map(move => gen3.moves.get(toId(move.slice('MOVE_'.length)))?.id),
      // CreateNPCTrainerParty escala el byte de origen por división entera.
      iv: Math.floor(rawIv * 31 / 255),
    }
  })
  validateTeam(team, sourceTrainer)
  return team
}

export function buildEmeraldCatalog(trainersSource, partiesSource) {
  return {
    schemaVersion: 1,
    region: 'hoenn',
    edition: 'emerald',
    source: { revision: REVISION },
    encounters: ENCOUNTERS.map(encounter => ({
      ...encounter,
      team: parseEmeraldTeam(encounter.sourceTrainer, trainersSource, partiesSource),
    })),
  }
}

export function validateEmeraldCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || catalog.region !== 'hoenn' ||
    catalog.edition !== 'emerald' || catalog.source?.revision !== REVISION ||
    !Array.isArray(catalog.encounters) || catalog.encounters.length !== ENCOUNTERS.length) {
    throw new Error('Cabecera o número de encuentros inválidos')
  }
  for (const [index, expected] of ENCOUNTERS.entries()) {
    const encounter = catalog.encounters[index]
    for (const [key, value] of Object.entries(expected)) {
      if (encounter?.[key] !== value) throw new Error(`Encuentro ${index + 1}: ${key} debe ser ${value}`)
    }
    validateTeam(encounter.team, encounter.sourceTrainer)
  }
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { 'source-dir': { type: 'string' } } })
  const sourceDir = values['source-dir']
  const [trainers, parties] = await Promise.all([
    readEmeraldSource('src/data/trainers.h', SOURCE_HASHES['trainers.h'], sourceDir),
    readEmeraldSource('src/data/trainer_parties.h', SOURCE_HASHES['trainer_parties.h'], sourceDir),
  ])
  const catalog = buildEmeraldCatalog(trainers, parties)
  validateEmeraldCatalog(catalog)
  await mkdir(dirname(EMERALD_CATALOG), { recursive: true })
  await writeFile(EMERALD_CATALOG, `${JSON.stringify(catalog, null, 2)}\n`)
  console.log(`Hoenn Esmeralda: ${catalog.encounters.length} encuentros`)
}
