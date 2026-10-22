import { readFileSync } from 'node:fs'
import { gen5, toId } from './dex.mjs'
import { fromRoot } from './paths.mjs'
import { TIPOS_ES } from './slug.mjs'

const NAMES_ES = JSON.parse(readFileSync(fromRoot('src', 'generated', 'names-es.json'), 'utf8'))
const ALIASES_PATH = fromRoot('data', 'pwt-raw', 'name-aliases.json')

/** Clave de comparación de un texto en español: sin tildes, minúsculas, sin espacios ni signos («Bolaluminosa» = «Bola Luminosa»). */
export const spanishKey = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, '')

export const CATEGORIES = ['species', 'moves', 'abilities', 'items']

function buildReverseIndex() {
  const index = Object.fromEntries(CATEGORIES.map((category) => [category, new Map()]))
  for (const category of CATEGORIES) {
    for (const [id, spanishName] of Object.entries(NAMES_ES[category])) {
      const key = spanishKey(spanishName)
      if (!index[category].has(key)) index[category].set(key, [])
      index[category].get(key).push(id)
    }
  }
  return index
}
const REVERSE_INDEX = buildReverseIndex()

const emptyAliases = () => Object.fromEntries(CATEGORIES.map((category) => [category, new Map()]))

/**
 * Grafías de las fuentes que no coinciden con los nombres canónicos: PokeAPI usa nombres españoles más recientes que
 * WikiDex («Pañuelo elegido» frente a «Pañuelo Elección») y alguna fuente trunca u escribe distinto un nombre inglés
 * («Hi Jump Kick», «Thunderpunc»). Formato de data/pwt-raw/name-aliases.json:
 * { "es": { "items": { "<texto de WikiDex>": "<id @pkmn>" }, "moves": {...}, "abilities": {...} }, "en": { "moves": { "<texto>": "<id>" } } }
 */
export function loadNameAliases() {
  const aliases = { en: emptyAliases(), es: emptyAliases() }
  let raw
  try {
    raw = JSON.parse(readFileSync(ALIASES_PATH, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return aliases
    throw error
  }
  for (const language of ['en', 'es']) {
    const keyOf = language === 'en' ? toId : spanishKey
    for (const category of CATEGORIES) {
      for (const [text, id] of Object.entries(raw[language]?.[category] ?? {})) aliases[language][category].set(keyOf(text), id)
    }
  }
  return aliases
}

/** Ids @pkmn candidatos para un nombre en español (varios si hay colisión: las formas comparten nombre con su especie base). */
export function spanishToIds(category, text, aliases) {
  const key = spanishKey(text)
  const aliased = aliases.es[category].get(key)
  if (aliased) return [aliased]
  return REVERSE_INDEX[category].get(key) ?? []
}

export function speciesIdFromEnglish(name) {
  const species = gen5.species.get(toId(name.replace('♀', 'f').replace('♂', 'm')))
  return species?.exists ? species.id : null
}

const knownIds = {
  items: new Set(Object.keys(NAMES_ES.items)),
  abilities: new Set(Object.keys(NAMES_ES.abilities)),
  moves: new Set(Object.keys(NAMES_ES.moves)),
}

/** id de objeto, habilidad o movimiento a partir del nombre inglés, o null si no existe en Gen 5 (names-es.json). */
export function idFromEnglish(category, name, aliases) {
  const id = aliases?.en[category].get(toId(name)) ?? toId(name)
  return knownIds[category].has(id) ? id : null
}

export const spanishName = (category, id) => NAMES_ES[category][id] ?? null

/** Tipo en inglés (minúsculas) a partir del nombre español de un tipo de WikiDex («acero» -> steel). */
export function typeFromSpanish(text) {
  const key = spanishKey(text)
  return Object.entries(TIPOS_ES).find(([, spanish]) => spanishKey(spanish) === key)?.[0] ?? null
}

const baseSpeciesIdOf = (speciesId) => toId(gen5.species.get(speciesId).baseSpecies)

/** Especies base de una lista de ids; dos listas son la misma especie si comparten alguna (Rotom-Heat y Rotom son la misma para Serebii). */
export const baseSpeciesIds = (speciesIds) => [...new Set(speciesIds.map(baseSpeciesIdOf))]

const typeKey = (types) => types.map((type) => type.toLowerCase()).sort().join('/')

/**
 * Forma concreta de una especie según los tipos (y, si hacen falta, las habilidades) que muestra la fuente: Rotom-Heat y
 * Rotom-Wash salen como «Rotom». Las formas solo de combate (Castform-Sunny, Darmanitan-Zen) no cuentan.
 * `certain` es false si ninguna forma o varias encajan; entonces se devuelve la especie base.
 */
export function refineSpeciesForm(speciesId, typeNames, abilityIds) {
  const species = gen5.species.get(speciesId)
  const forms = [species, ...(species.otherFormes ?? []).map((name) => gen5.species.get(name))].filter((form) => form.exists && !form.battleOnly)
  if (forms.length === 1) return { id: speciesId, certain: true }
  let matching = forms.filter((form) => typeKey(form.types) === typeKey(typeNames))
  if (matching.length > 1) matching = matching.filter((form) => abilityIds.every((ability) => Object.values(form.abilities).map(toId).includes(ability)))
  return matching.length === 1 ? { id: matching[0].id, certain: true } : { id: speciesId, certain: false }
}
