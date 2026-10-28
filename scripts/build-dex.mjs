import { writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gen5, toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'

const byKey = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

function spriteIdOf(species) {
  return toId(species.baseSpecies) + (species.forme ? `-${toId(species.forme)}` : '')
}

/** Datos de Gen 5 que necesita el cliente, sin cargar @pkmn/dex en ejecución (DEC-07). */
export function buildDex() {
  const species = {}
  for (const entry of gen5.species) {
    species[entry.id] = {
      id: entry.id,
      name: entry.name,
      types: [...entry.types],
      baseStats: { hp: entry.baseStats.hp, atk: entry.baseStats.atk, def: entry.baseStats.def, spa: entry.baseStats.spa, spd: entry.baseStats.spd, spe: entry.baseStats.spe },
      abilities: Object.values(entry.abilities).map(toId),
      nfe: Boolean(entry.nfe),
      spriteId: spriteIdOf(entry),
      // Solo en las formas (thundurustherian → thundurus): dos formas de una especie no van en el mismo equipo (RF-12b).
      ...(toId(entry.baseSpecies) !== entry.id ? { baseSpecies: toId(entry.baseSpecies) } : {}),
    }
  }

  const moves = {}
  for (const entry of gen5.moves) {
    // Los 16 Hidden Power comparten id en @pkmn ('hiddenpower'); el nombre los distingue.
    const moveId = toId(entry.name)
    moves[moveId] = {
      id: moveId,
      name: entry.name,
      type: entry.type,
      category: entry.category,
      basePower: entry.basePower,
      accuracy: entry.accuracy,
      pp: entry.pp,
    }
  }

  const typeNames = [...gen5.types].map((type) => type.name).sort()
  const typeChart = {}
  for (const attacker of typeNames) {
    typeChart[attacker] = {}
    for (const defender of typeNames) typeChart[attacker][defender] = gen5.types.get(attacker).effectiveness[defender]
  }

  return { species: byKey(species), moves: byKey(moves), typeChart }
}

if (isMain(import.meta.url)) {
  const dex = buildDex()
  writeFileSync(fromRoot('src', 'generated', 'dex-gen5.json'), JSON.stringify(dex) + '\n')
  console.log(`dex-gen5.json: ${Object.keys(dex.species).length} especies, ${Object.keys(dex.moves).length} movimientos`)
}
