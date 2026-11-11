import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { isMain } from './lib/cli.mjs'
import { EMERALD_REVISION as REVISION, gen3, readEmeraldSource } from './lib/emerald-source.mjs'
import { toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'

const HEADERS = {
  learnsets: ['src/data/pokemon/level_up_learnsets.h', 'a7569a51e3bb0ca4f094830c76c6db45a692c7ed64db21e59bc76a90237599e0'],
  pointers: ['src/data/pokemon/level_up_learnset_pointers.h', '7a85513797da2a2ebdf7893ce58d94f99aee07deb1aec4f0d7a31422dc8040de'],
  evolutions: ['src/data/pokemon/evolution.h', 'a7d05352fb5b7039b8851049bc9575dc8eaa4450bf9964d03b7857db98c32d3c'],
  compatibility: ['src/data/pokemon/tmhm_learnsets.h', '3ff6e2976f66b8ab3884d879fe5e46d266cfb88b35156ab958011d3d14ae4da3'],
  machines: ['include/constants/tms_hms.h', '649802a5a5fa8ce042d748e14770007a29f6a4fadc626f2bf8f2101436b0cb4a'],
}
export const EMERALD_PROGRESSION = fromRoot('data', 'nuzlocke', 'hoenn-emerald-progression.json')

const nationalSpecies = [...gen3.species].filter(species => species.num >= 1 && species.num <= 386 && !species.forme)
  .sort((a, b) => a.num - b.num)
const nationalIds = new Set(nationalSpecies.map(species => species.id))
const itemMethods = new Set(['ITEM', 'TRADE_ITEM'])
const zeroMethods = new Set(['FRIENDSHIP', 'FRIENDSHIP_DAY', 'FRIENDSHIP_NIGHT', 'TRADE'])
const levelMethods = new Set(['LEVEL', 'LEVEL_ATK_EQ_DEF', 'LEVEL_ATK_GT_DEF', 'LEVEL_ATK_LT_DEF', 'LEVEL_CASCOON', 'LEVEL_NINJASK', 'LEVEL_SHEDINJA', 'LEVEL_SILCOON'])
const machineId = (kind, index) => `${kind}${String(index + 1).padStart(2, '0')}`
const canonical = (table, token) => table.get(toId(token))?.id
// El nombre inglés cambió a plural en los identificadores del simulador.
const moveId = token => canonical(gen3.moves, token === 'SMELLING_SALT' ? 'SMELLING_SALTS' : token)
const simulatorSpecies = id => id === 'deoxys' ? 'deoxysspeed' : id
const baseStatTotal = id => Object.values(gen3.species.get(simulatorSpecies(id)).baseStats)
  .reduce((total, stat) => total + stat, 0)
const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const isCanonical = (table, id) => typeof id === 'string' && table.get(id)?.id === id

function speciesEntries(source, pattern, parse) {
  const entries = new Map()
  for (const [, token, value] of source.matchAll(pattern)) {
    if (token === 'NONE' || /^OLD_UNOWN_[B-Z]$/.test(token)) continue
    const id = canonical(gen3.species, token)
    if (!nationalIds.has(id) || entries.has(id)) throw new Error(`Especie desconocida o repetida: ${token}`)
    entries.set(id, parse(value))
  }
  return entries
}

function parseMachines(source) {
  const machines = {}
  for (const [kind, count] of [['tm', 50], ['hm', 8]]) {
    const header = source.match(new RegExp(`#define FOREACH_${kind.toUpperCase()}\\(F\\) ([\\s\\S]*?)(?=\\n\\s*#)`))?.[1] ?? ''
    const moves = [...header.matchAll(/F\(([A-Z0-9_]+)\)/g)]
    if (moves.length !== count) throw new Error(`Número de ${kind.toUpperCase()} inválido: ${moves.length}`)
    moves.forEach(([, token], index) => {
      machines[machineId(kind, index)] = moveId(token)
    })
  }
  return machines
}

export function buildEmeraldProgression(sources) {
  const machines = parseMachines(sources.machines)
  const learnsets = new Map([...sources.learnsets.matchAll(/static const u16 (\w+)\[\] = \{([\s\S]*?)LEVEL_UP_END\s*\};/g)]
    .map(([, name, body]) => [name, [...body.matchAll(/LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*MOVE_([A-Z0-9_]+)\)/g)]
      .map(([, level, token]) => ({ level: Number(level), move: moveId(token) }))]))
  const levelUp = speciesEntries(sources.pointers, /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*(\w+)\s*,/g, name => learnsets.get(name))
  const compatibility = speciesEntries(sources.compatibility, /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*\{\s*\.learnset\s*=\s*\{([^{}]*)\}\s*\}/g,
    body => [...body.matchAll(/\.([A-Z0-9_]+)\s*=\s*TRUE\s*,?/g)].map(([, token]) => moveId(token)))
  const evolutions = speciesEntries(sources.evolutions, /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*\{((?:\s*\{[^{}]*\}\s*,?)+)\s*\}/g,
    body => [...body.matchAll(/\{EVO_([A-Z_]+),\s*(\d+|ITEM_[A-Z0-9_]+),\s*SPECIES_([A-Z0-9_]+)\}/g)]
      .map(([, method, raw, target]) => ({
        method,
        parameter: itemMethods.has(method) ? canonical(gen3.items, raw.replace(/^ITEM_/, '')) : Number(raw),
        target: canonical(gen3.species, target),
      })))

  const species = Object.fromEntries(nationalSpecies.map(({ id }) => [id, {
    baseStatTotal: baseStatTotal(id),
    types: [...gen3.species.get(simulatorSpecies(id)).types],
    levelUp: levelUp.get(id),
    machines: compatibility.get(id),
    evolutions: evolutions.get(id) ?? [],
    // Esmeralda utiliza la forma Velocidad para la única entrada de Deoxys de la Pokédex.
    ...(id === 'deoxys' ? { simulatorSpecies: simulatorSpecies(id) } : {}),
  }]))
  const catalog = { schemaVersion: 1, source: { revision: REVISION }, machines, species }
  validateEmeraldProgression(catalog)
  return catalog
}

function validEvolution(evolution) {
  if (!nationalIds.has(evolution?.target)) return false
  const { method, parameter } = evolution
  if (itemMethods.has(method)) return isCanonical(gen3.items, parameter)
  if (zeroMethods.has(method)) return parameter === 0
  if (levelMethods.has(method)) return inRange(parameter, 1, 100)
  return method === 'BEAUTY' && inRange(parameter, 1, 255)
}

export function validateEmeraldProgression(catalog) {
  if (catalog?.schemaVersion !== 1 || catalog.source?.revision !== REVISION ||
    !catalog.machines || !catalog.species || Object.keys(catalog.species).length !== nationalIds.size) {
    throw new Error('Cabecera o número de especies de progresión inválido')
  }
  const machineKeys = [['tm', 50], ['hm', 8]].flatMap(([kind, count]) =>
    Array.from({ length: count }, (_, index) => machineId(kind, index)))
  const machineMoves = new Set(machineKeys.map(key => catalog.machines[key]))
  if (Object.keys(catalog.machines).length !== machineKeys.length || machineMoves.size !== machineKeys.length ||
    [...machineMoves].some(move => !isCanonical(gen3.moves, move))) throw new Error('Catálogo de MT/MO inválido')

  for (const id of nationalIds) {
    const entry = catalog.species[id]
    if (!Array.isArray(entry?.levelUp) || entry.levelUp.length === 0 || entry.levelUp.some((move, index) =>
      !inRange(move?.level, 1, 100) || !isCanonical(gen3.moves, move.move) ||
      (index > 0 && move.level < entry.levelUp[index - 1].level))) throw new Error(`${id}: aprendizaje por nivel inválido`)
    if (entry.baseStatTotal !== baseStatTotal(id)) throw new Error(`${id}: suma de estadísticas base inválida`)
    if (JSON.stringify(entry.types) !== JSON.stringify(gen3.species.get(simulatorSpecies(id)).types)) {
      throw new Error(`${id}: tipos de tercera generación inválidos`)
    }
    if (!Array.isArray(entry.machines) || new Set(entry.machines).size !== entry.machines.length ||
      entry.machines.some(move => !machineMoves.has(move))) throw new Error(`${id}: compatibilidad con MT/MO inválida`)
    if (!Array.isArray(entry.evolutions) || entry.evolutions.some(evolution => !validEvolution(evolution) || evolution.target === id)) {
      throw new Error(`${id}: evoluciones inválidas`)
    }
    if (entry.simulatorSpecies !== (id === 'deoxys' ? 'deoxysspeed' : undefined)) {
      throw new Error(`${id}: forma de Esmeralda inválida`)
    }
  }
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { 'source-dir': { type: 'string' } } })
  const entries = await Promise.all(Object.entries(HEADERS).map(async ([name, [path, hash]]) =>
    [name, await readEmeraldSource(path, hash, values['source-dir'])]))
  const catalog = buildEmeraldProgression(Object.fromEntries(entries))
  await mkdir(dirname(EMERALD_PROGRESSION), { recursive: true })
  await writeFile(EMERALD_PROGRESSION, `${JSON.stringify(catalog, null, 2)}\n`)
  console.log(`Hoenn Esmeralda: progresión de ${Object.keys(catalog.species).length} especies`)
}
