import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { TeamValidator } from '@pkmn/sim'
import { isMain } from './lib/cli.mjs'
import { gen5, toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'
import { SMOGON_TIERS } from './fetch-smogon-sets.mjs'

const pwtRules = JSON.parse(readFileSync(fromRoot('src', 'core', 'pwt-rules.json'), 'utf8'))
const NEUTRAL_NATURE = 'Serious'

const setKey = (set) => JSON.stringify([set.species, set.item, set.abilities, [...set.moves].sort(), set.nature ?? null])
const isForbiddenSpecies = (speciesId) => pwtRules.forbiddenSpecies.some((forbidden) => speciesId === forbidden || (forbidden !== 'mew' && speciesId.startsWith(forbidden)))

/** Alternativas de un campo de Smogon: valor suelto o lista; la primera es la opción principal. */
const optionsOf = (field) => (Array.isArray(field) ? field : [field]).filter((option) => option !== undefined && option !== null)

/**
 * Regla de alternativas (slash) de los sets de Smogon: cada hueco de movimiento, el objeto y la habilidad toman su PRIMERA opción
 * (la principal del set); si un movimiento queda repetido en otro hueco, ese hueco pasa a su siguiente alternativa. Un set de Smogon
 * da un set del pool: no hay producto cartesiano (los sets con alternativas darían decenas de variantes casi iguales).
 */
function resolveSmogonSet(speciesName, setName, raw) {
  const species = gen5.species.get(speciesName)
  const chosenMoves = []
  for (const slot of raw.moves ?? []) {
    const option = optionsOf(slot).map((name) => gen5.moves.get(name)).find((move) => move?.exists && !chosenMoves.includes(move.id))
    if (!option) return { problem: `movimiento sin alternativa válida: ${JSON.stringify(slot)}` }
    chosenMoves.push(option.id)
  }
  const item = gen5.items.get(optionsOf(raw.item)[0] ?? '')
  // Sin habilidad en el set (el volcado la omite en muchos): se admiten las habilidades normales de la especie (no la oculta) y el PRNG del día elige.
  const abilities = raw.ability !== undefined ? [toId(optionsOf(raw.ability)[0])] : [species.abilities[0], species.abilities[1]].filter(Boolean).map(toId)
  return {
    id: `${species.name} «${setName}»`,
    species: species.id,
    item: item?.exists ? item.id : null,
    itemName: optionsOf(raw.item)[0],
    abilities,
    moves: chosenMoves,
    ivs: raw.ivs,
  }
}

const validator = new TeamValidator('gen5customgame')

/** Motivo por el que el sim rechaza el set (especie, habilidad, movimientos aprendibles, objeto) o las reglas del PWT; null si es legal. */
function problemWith(candidate) {
  const species = gen5.species.get(candidate.species)
  if (!species.exists || species.gen > 5) return 'especie inexistente en Gen 5'
  if (isForbiddenSpecies(species.id)) return 'legendario prohibido en el PWT'
  if (species.nfe) return 'no está totalmente evolucionado'
  if (!candidate.item) return `objeto inexistente en Gen 5: ${candidate.itemName}`
  if (pwtRules.forbiddenItems.includes(candidate.item)) return `objeto prohibido en el PWT: ${candidate.item}`
  if (candidate.moves.length !== 4) return `${candidate.moves.length} movimientos en vez de 4`
  const bannedMove = candidate.moves.find((move) => pwtRules.forbiddenMoves.includes(move))
  if (bannedMove) return `movimiento prohibido en el PWT: ${bannedMove}`
  const ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...candidate.ivs }
  for (const ability of candidate.abilities) {
    const problems = validator.validateTeam([{ name: species.name, species: species.name, item: candidate.item, ability, moves: candidate.moves, nature: NEUTRAL_NATURE, level: 50, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs }])
    if (problems) return problems.join('; ')
  }
  return null
}

/**
 * Pool del jugador (PRD §0 y §6): sets de Smogon de Gen 5 en individuales (data/smogon/, solo objeto, habilidad y movimientos) más los
 * sets totalmente evolucionados de los rivales del PWT, deduplicados, con un tag `source:smogon-<tier>` o `source:<idEntrenador>` por origen.
 * Devuelve también los sets de Smogon descartados con su motivo.
 */
export function buildPlayerPool(trainers, smogonByTier) {
  const pool = new Map()
  const discarded = []
  const addTag = (set, tag) => {
    if (!set.tags.includes(tag)) set.tags.push(tag)
  }

  for (const [tier, sets] of Object.entries(smogonByTier)) {
    for (const [speciesName, namedSets] of Object.entries(sets)) {
      for (const [setName, raw] of Object.entries(namedSets)) {
        const candidate = resolveSmogonSet(speciesName, setName, raw)
        const label = `${tier}: ${speciesName} «${setName}»`
        const reason = candidate.problem ?? problemWith(candidate)
        if (reason) {
          if (!/^(legendario prohibido|no está totalmente evolucionado)/.test(reason)) discarded.push({ set: label, reason })
          continue
        }
        const playerSet = { species: candidate.species, level: 50, item: candidate.item, abilities: candidate.abilities, moves: candidate.moves, verified: true, tags: [] }
        const key = setKey(playerSet)
        if (!pool.has(key)) pool.set(key, playerSet)
        addTag(pool.get(key), `source:smogon-${tier}`)
      }
    }
  }

  for (const trainer of trainers) {
    for (const variant of trainer.variants) {
      for (const rivalSet of variant.team) {
        if (gen5.species.get(rivalSet.species).nfe) continue
        const key = setKey(rivalSet)
        if (!pool.has(key)) {
          const playerSet = { species: rivalSet.species, level: 50, item: rivalSet.item, abilities: [...rivalSet.abilities], moves: [...rivalSet.moves], verified: rivalSet.verified, tags: [] }
          if (rivalSet.nature) playerSet.nature = rivalSet.nature
          pool.set(key, playerSet)
        }
        addTag(pool.get(key), `source:${trainer.id}`)
      }
    }
  }
  return { sets: [...pool.values()], discarded }
}

export function loadSmogonSets() {
  return Object.fromEntries(
    SMOGON_TIERS.filter((tier) => existsSync(fromRoot('data', 'smogon', `gen5${tier}.json`))).map((tier) => [tier, JSON.parse(readFileSync(fromRoot('data', 'smogon', `gen5${tier}.json`), 'utf8'))]),
  )
}

export const buildPlayerSets = (trainers, smogonByTier = loadSmogonSets()) => buildPlayerPool(trainers, smogonByTier).sets

const compactArrays = (json) => json.replace(/\[\s*((?:"[^"\]]*"(?:,\s*)?\s*)+)\]/g, (match, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ').trim() + ']')

if (isMain(import.meta.url)) {
  const { trainers } = JSON.parse(readFileSync(fromRoot('data', 'trainers.json'), 'utf8'))
  const { sets, discarded } = buildPlayerPool(trainers, loadSmogonSets())
  writeFileSync(fromRoot('data', 'player-sets.json'), compactArrays(JSON.stringify(sets, null, 2)) + '\n')
  writeFileSync(fromRoot('data', 'smogon', 'discarded.json'), compactArrays(JSON.stringify(discarded, null, 2)) + '\n')
  const species = new Set(sets.map((set) => set.species))
  console.log(`player-sets.json: ${sets.length} sets, ${species.size} especies; descartados por inválidos: ${discarded.length} (data/smogon/discarded.json)`)
}
