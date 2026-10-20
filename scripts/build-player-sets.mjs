import { readFileSync, writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gen5 } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'

const setKey = (set) => JSON.stringify([set.species, set.item, set.abilities, [...set.moves].sort(), set.nature ?? null])

/**
 * Pool provisional del jugador (DEC-06): sets totalmente evolucionados de todas las variantes de los rivales,
 * deduplicados, con un tag `source:<idEntrenador>` por cada entrenador de origen. El pool definitivo
 * sustituye solo data/player-sets.json.
 */
export function buildPlayerSets(trainers) {
  const pool = new Map()
  for (const trainer of trainers) {
    for (const variant of trainer.variants) {
      for (const rivalSet of variant.team) {
        if (gen5.species.get(rivalSet.species).nfe) continue
        const key = setKey(rivalSet)
        const tag = `source:${trainer.id}`
        if (pool.has(key)) {
          const existing = pool.get(key)
          if (!existing.tags.includes(tag)) existing.tags.push(tag)
          continue
        }
        const playerSet = {
          species: rivalSet.species,
          level: 50,
          item: rivalSet.item,
          abilities: [...rivalSet.abilities],
          moves: [...rivalSet.moves],
          verified: rivalSet.verified,
          tags: [tag],
        }
        if (rivalSet.nature) playerSet.nature = rivalSet.nature
        pool.set(key, playerSet)
      }
    }
  }
  return [...pool.values()]
}

if (isMain(import.meta.url)) {
  const { trainers } = JSON.parse(readFileSync(fromRoot('data', 'trainers.json'), 'utf8'))
  const sets = buildPlayerSets(trainers)
  writeFileSync(fromRoot('data', 'player-sets.json'), JSON.stringify(sets, null, 2).replace(/\[\s*((?:"[^"\]]*"(?:,\s*)?\s*)+)\]/g, (match, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ').trim() + ']') + '\n')
  console.log(`player-sets.json: ${sets.length} sets, ${new Set(sets.map((set) => set.species)).size} especies`)
}
