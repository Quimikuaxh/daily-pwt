/**
 * Progresión de la locke de N2/B2 (PRD §0, 13/11/2026): de las 649 especies de la 5.ª generación (formas base, como en Hoenn), sus
 * tipos y suma de estadísticas base, los ataques por nivel, los que aprende por MT/MO de N2/B2 y cómo evoluciona. Sin código fuente del
 * juego: de los datos de Gen 5 de `@pkmn/dex` (Showdown), con las MT de `unova-n2b2-calendar.json`.
 *
 * Los métodos de evolución usan los nombres de la de Hoenn (`hoenn-emerald-progression.json`) y añaden los de Gen 5:
 *  - LEVEL_MALE / LEVEL_FEMALE, ITEM_MALE / ITEM_FEMALE: solo de ese sexo (Vespiquen, Mothim, Wormadam, Gallade, Froslass).
 *  - LEVEL_MOVE (parámetro: el ataque que debe saber), LEVEL_PARTY (la especie que debe ir en el equipo, Mantine).
 *  - LEVEL_ITEM_DAY / LEVEL_ITEM_NIGHT (el objeto equipado al subir de nivel de día o de noche: Chansey, Weavile, Gliscor).
 *  - LOCATION (parámetro: `magnetic`, `moss` o `ice`: subir de nivel en ese lugar de Teselia).
 *  - TRADE_SPECIES (intercambio por esa especie: Karrablast y Shelmet).
 * Showdown mezcla métodos de juegos posteriores (Leafeon con Piedra Hoja, Glaceon con Piedra Hielo, Magnezone con Piedra Trueno): en Gen
 * 5 son por lugar y se ignora el objeto. Wurmple y Nincada conservan los nombres especiales de Hoenn (LEVEL_SILCOON…, LEVEL_NINJASK…).
 *
 * Uso: npm run gen:n2b2-progression
 */
import { readFile, writeFile } from 'node:fs/promises'
import { Dex } from '@pkmn/dex'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'
import { N2B2_CALENDAR } from './build-n2b2-calendar.mjs'

export const N2B2_PROGRESSION = fromRoot('data', 'nuzlocke', 'unova-n2b2-progression.json')
const dex = Dex.forGen(5)

const LOCATIONS = { 'in a special magnetic field': 'magnetic', 'near a special magnetic field': 'magnetic', 'near a Moss Rock': 'moss', 'near an Ice Rock': 'ice' }
const STAT_COMPARE = { 'with an Atk stat < its Def stat': 'LEVEL_ATK_LT_DEF', 'with an Atk stat > its Def stat': 'LEVEL_ATK_GT_DEF', 'with an Atk stat equal to its Def stat': 'LEVEL_ATK_EQ_DEF' }
const SPECIAL = { silcoon: 'LEVEL_SILCOON', cascoon: 'LEVEL_CASCOON', ninjask: 'LEVEL_NINJASK', shedinja: 'LEVEL_SHEDINJA' }

const inGen5 = (species) => species.exists && species.num >= 1 && species.num <= 649 && !species.forme
/** Solo de un sexo si la evolución lo es y la especie previa tiene los dos (Nidoking no: Nidorino ya es macho). */
function genderOnly(target, prevo) {
  const only = target.gender === 'M' || target.gender === 'F' ? target.gender : null
  return only && !(prevo.gender === only) ? only : null
}

/** Una evolución de `target` desde su especie previa, con el método y el parámetro. */
export function evolutionOf(target) {
  const prevo = dex.species.get(target.prevo)
  const gender = genderOnly(target, prevo)
  const suffix = gender === 'M' ? '_MALE' : gender === 'F' ? '_FEMALE' : ''
  const entry = (method, parameter) => ({ method, parameter, target: target.id })
  if (SPECIAL[target.id]) return entry(SPECIAL[target.id], target.evoLevel)
  if (target.id === 'milotic') return entry('TRADE_ITEM', 'prismscale')
  switch (target.evoType) {
    case undefined:
      if (STAT_COMPARE[target.evoCondition]) return entry(STAT_COMPARE[target.evoCondition], target.evoLevel)
      if (target.evoCondition) throw new Error(`${target.id}: condición de nivel desconocida «${target.evoCondition}»`)
      return entry(`LEVEL${suffix}`, target.evoLevel)
    case 'useItem': return entry(`ITEM${suffix}`, dex.items.get(target.evoItem).id)
    case 'trade':
      if (target.evoCondition?.startsWith('with a ')) return entry('TRADE_SPECIES', dex.species.get(target.evoCondition.slice('with a '.length)).id)
      return target.evoItem ? entry('TRADE_ITEM', dex.items.get(target.evoItem).id) : entry('TRADE', 0)
    case 'levelFriendship':
      return entry(target.evoCondition === 'during the day' ? 'FRIENDSHIP_DAY' : target.evoCondition === 'at night' ? 'FRIENDSHIP_NIGHT' : 'FRIENDSHIP', 0)
    case 'levelHold': return entry(target.evoCondition === 'at night' ? 'LEVEL_ITEM_NIGHT' : 'LEVEL_ITEM_DAY', dex.items.get(target.evoItem).id)
    case 'levelMove': return entry('LEVEL_MOVE', dex.moves.get(target.evoMove).id)
    case 'levelExtra':
      if (LOCATIONS[target.evoCondition]) return entry('LOCATION', LOCATIONS[target.evoCondition])
      if (target.evoCondition === 'with a Remoraid in party') return entry('LEVEL_PARTY', 'remoraid')
      break
  }
  throw new Error(`${target.id}: método de evolución sin traducir (${target.evoType}, «${target.evoCondition}»)`)
}

export async function buildN2b2Progression() {
  const calendar = JSON.parse(await readFile(N2B2_CALENDAR, 'utf8'))
  const machines = Object.fromEntries([...Object.entries(calendar.machines), ...Object.entries(calendar.excluded)]
    .map(([id, entry]) => [id, entry.move]).sort(([a], [b]) => a.localeCompare(b)))
  const machineMoves = new Set(Object.values(machines))
  const all = dex.species.all().filter(inGen5)
  const species = {}
  for (const entry of all.sort((a, b) => a.num - b.num)) {
    const learnset = (await dex.learnsets.get(entry.id))?.learnset ?? {}
    const levelUp = Object.entries(learnset).flatMap(([move, sources]) => sources
      .filter((source) => /^5L\d+$/.test(source)).map((source) => ({ level: Number(source.slice(2)), move })))
      .sort((a, b) => a.level - b.level || a.move.localeCompare(b.move))
    const learnsByMachine = Object.entries(learnset).filter(([move, sources]) => machineMoves.has(move) && sources.includes('5M')).map(([move]) => move).sort()
    species[entry.id] = {
      baseStatTotal: Object.values(entry.baseStats).reduce((sum, value) => sum + value, 0),
      types: [...entry.types],
      levelUp,
      machines: learnsByMachine,
      evolutions: (entry.evos ?? []).map((id) => dex.species.get(id)).filter(inGen5).map(evolutionOf),
    }
  }
  return { schemaVersion: 1, source: { data: '@pkmn/dex, generación 5', machines: 'unova-n2b2-calendar.json' }, machines, species }
}

export function validateN2b2Progression(progression) {
  const ids = Object.keys(progression?.species ?? {})
  if (progression?.schemaVersion !== 1 || ids.length !== 649) throw new Error('unova-n2b2-progression.json: se esperan las 649 especies')
  if (Object.keys(progression.machines).length !== 101) throw new Error('unova-n2b2-progression.json: se esperan 101 MT/MO')
  for (const [id, entry] of Object.entries(progression.species)) {
    if (!entry.levelUp.length && id !== 'smeargle' && !['ditto', 'unown', 'wobbuffet', 'beldum', 'kricketot', 'burmy', 'combee', 'tynamo', 'magikarp', 'caterpie', 'weedle', 'metapod', 'kakuna', 'wurmple', 'silcoon', 'cascoon'].includes(id)) {
      throw new Error(`${id}: sin ataques por nivel`)
    }
    for (const evolution of entry.evolutions) if (!progression.species[evolution.target]) throw new Error(`${id}: evoluciona a una especie que falta (${evolution.target})`)
  }
}

if (isMain(import.meta.url)) {
  const progression = await buildN2b2Progression()
  validateN2b2Progression(progression)
  await writeFile(N2B2_PROGRESSION, `${JSON.stringify(progression, null, 2)}\n`)
  console.log(`unova-n2b2-progression.json: ${Object.keys(progression.species).length} especies, ${Object.keys(progression.machines).length} MT/MO`)
}
