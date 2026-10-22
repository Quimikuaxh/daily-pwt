import { readFileSync } from 'node:fs'
import { fromRoot } from './paths.mjs'
import { gen5 } from './dex.mjs'
import { baseSpeciesIds, idFromEnglish, loadNameAliases, refineSpeciesForm, spanishToIds, speciesIdFromEnglish } from './pwt-normalize.mjs'
import { loadRawSources } from './pwt-raw-format.mjs'
import { findRosterTrainer, ROSTER } from './pwt-roster.mjs'
import { TOURNAMENT_ORDER } from './pwt-sources.mjs'

export { loadRawSources }

const SOURCE_PRIORITY = ['bulbapedia', 'wikidex', 'serebii']
const LANGUAGES = { bulbapedia: 'en', serebii: 'en', wikidex: 'es' }
const RESOLUTIONS_PATH = fromRoot('data', 'pwt-raw', 'resolutions.json')
// Campos que se votan y fuentes que los publican: Serebii no da habilidades. El género no se vota: solo aparece en especies
// de género fijo (se comprueba en buildConsensus) y WikiDex no lo distingue.
const FIELD_PROVIDERS = { item: ['bulbapedia', 'serebii', 'wikidex'], abilities: ['bulbapedia', 'wikidex'], moves: ['bulbapedia', 'serebii', 'wikidex'], level: ['bulbapedia', 'serebii', 'wikidex'] }

function loadResolutions() {
  try {
    return JSON.parse(readFileSync(RESOLUTIONS_PATH, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

/** Cada campo normalizado es una lista de ids candidatos (uno solo en las fuentes en inglés; varios si un nombre español es ambiguo). */
function normalizeMember(source, member, aliases, unresolved, ambiguousForms) {
  const note = (category, text) => unresolved[category].set(`${source}: ${text}`, (unresolved[category].get(`${source}: ${text}`) ?? 0) + 1)
  const english = LANGUAGES[source] === 'en'
  const resolve = (category, text) => {
    const ids = english ? [category === 'species' ? speciesIdFromEnglish(text) : idFromEnglish(category, text, aliases)].filter(Boolean) : spanishToIds(category, text, aliases)
    if (ids.length === 0) note(category, text)
    return ids
  }
  const abilities = member.abilities.map((text) => resolve('abilities', text))
  let species = resolve('species', member.species)
  if (source === 'bulbapedia' && species.length === 1) {
    const refined = refineSpeciesForm(species[0], member.types, abilities.flat())
    if (!refined.certain) ambiguousForms.push({ source, species: species[0], types: member.types })
    species = [refined.id]
  }
  return {
    species,
    item: member.item ? resolve('items', member.item) : [],
    abilities,
    moves: member.moves.map((text) => resolve('moves', text)),
    level: member.level,
    raw: member,
  }
}

const intersects = (candidates, ids) => candidates.some((id) => ids.includes(id))
const sameSpecies = (a, b) => intersects(baseSpeciesIds(a), baseSpeciesIds(b))

/** Texto canónico de un campo, usando los ids de la referencia cuando un candidato coincide (para comparar entre idiomas). */
function canonicalize(field, normalized, reference) {
  const pick = (candidates, referenceCandidates, rawText) => (referenceCandidates?.find((id) => candidates.includes(id)) ?? candidates[0] ?? `?${rawText}`)
  if (field === 'item') return pick(normalized.item, reference?.item, normalized.raw.item)
  if (field === 'abilities' || field === 'moves') {
    const referenceLists = reference?.[field] ?? []
    return normalized[field].map((candidates, index) => pick(candidates, referenceLists.find((list) => intersects(candidates, list)), normalized.raw[field][index])).sort().join(',')
  }
  return String(normalized.level)
}

function voteField(valuesBySource) {
  const groups = new Map()
  for (const [source, value] of Object.entries(valuesBySource)) groups.set(value, [...(groups.get(value) ?? []), source])
  const ranked = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || SOURCE_PRIORITY.indexOf(a[1][0]) - SOURCE_PRIORITY.indexOf(b[1][0]))
  const [winnerValue, winnerSources] = ranked[0]
  const tied = ranked.length > 1 && ranked[1][1].length === winnerSources.length
  const verified = winnerSources.length >= 2 && !tied
  const conflict = groups.size > 1 ? { resolution: verified ? 'majority' : 'unresolved', values: valuesBySource } : null
  return { value: winnerValue, verified, agreeing: winnerSources, conflict }
}

/** Valor listado para el informe: arrays de ids o texto según el campo. */
const splitList = (field, value) => (field === 'abilities' || field === 'moves' ? value.split(',').filter(Boolean) : value)

/** Los valores votados van ordenados; si coinciden con los de la referencia se devuelven en el orden de la fuente (orden de las casillas del juego). */
function inReferenceOrder(referenceLists, votedValue) {
  const referenceIds = referenceLists.map((candidates) => candidates[0])
  return [...referenceIds].sort().join(',') === votedValue ? referenceIds : splitList('moves', votedValue)
}

function buildMemberConsensus(referenceMember, membersBySource, trainerId, tournament, resolutions) {
  const species = referenceMember.species[0] ?? `?${referenceMember.raw.species}`
  const present = Object.keys(membersBySource)
  const fields = {}
  const conflicts = []
  for (const field of Object.keys(FIELD_PROVIDERS)) {
    const providers = FIELD_PROVIDERS[field].filter((source) => membersBySource[source])
    const valuesBySource = Object.fromEntries(providers.map((source) => [source, canonicalize(field, membersBySource[source], referenceMember)]))
    let outcome = voteField(valuesBySource)
    const manual = resolutions.find((resolution) => resolution.trainerId === trainerId && resolution.tournament === tournament && resolution.species === species && resolution.field === field)
    if (manual) {
      const value = Array.isArray(manual.value) ? [...manual.value].sort().join(',') : String(manual.value)
      outcome = { value, verified: true, agreeing: ['manual'], conflict: { resolution: 'manual', values: valuesBySource, reason: manual.reason, evidence: manual.evidence } }
    }
    fields[field] = outcome
    if (outcome.conflict) conflicts.push({ field, ...outcome.conflict, values: Object.fromEntries(Object.entries(outcome.conflict.values).map(([source, value]) => [source, splitList(field, value)])) })
  }
  const verified = present.length >= 2 && Object.values(fields).every((outcome) => outcome.verified)
  return {
    species,
    item: fields.item.value,
    abilities: inReferenceOrder(referenceMember.abilities, fields.abilities.value),
    moves: inReferenceOrder(referenceMember.moves, fields.moves.value),
    level: Number(fields.level.value),
    verified,
    sources: present,
    conflicts,
  }
}

/**
 * Cruza las tres fuentes por (entrenador, torneo) y por especie. Devuelve los equipos consensuados y todo lo que no se pudo
 * resolver: nombres sin id, entrenadores fuera del roster, equipos con tamaño distinto de 6 o presentes en una sola fuente.
 */
export function buildConsensus(sources) {
  const aliases = loadNameAliases()
  const resolutions = loadResolutions()
  const unresolved = { species: new Map(), items: new Map(), abilities: new Map(), moves: new Map() }
  const ignoredTrainers = {}
  const duplicates = []
  const unexpectedGender = []
  const ambiguousForms = []
  const entriesByKey = new Map()

  for (const source of SOURCE_PRIORITY) {
    for (const entry of sources[source].teams) {
      const trainer = findRosterTrainer(entry.trainer, LANGUAGES[source])
      if (!trainer) {
        ignoredTrainers[`${source}: ${entry.trainer}`] = (ignoredTrainers[`${source}: ${entry.trainer}`] ?? 0) + 1
        continue
      }
      const key = `${trainer.id}|${entry.tournament}`
      const slot = entriesByKey.get(key) ?? { trainer, tournament: entry.tournament, bySource: {} }
      if (slot.bySource[source]) {
        duplicates.push({ source, trainerId: trainer.id, tournament: entry.tournament })
        continue
      }
      for (const member of entry.team) {
        const species = gen5.species.get(LANGUAGES[source] === 'en' ? speciesIdFromEnglish(member.species) ?? '' : spanishToIds('species', member.species, aliases)[0] ?? '')
        const genderIsFixed = species?.exists && (species.gender || species.genderRatio?.M === 0 || species.genderRatio?.F === 0)
        if (member.gender && species?.exists && !genderIsFixed) unexpectedGender.push({ source, trainerId: trainer.id, tournament: entry.tournament, species: species.id, gender: member.gender })
      }
      slot.bySource[source] = { ...entry, members: entry.team.map((member) => normalizeMember(source, member, aliases, unresolved, ambiguousForms)) }
      entriesByKey.set(key, slot)
    }
  }

  const teams = []
  for (const slot of entriesByKey.values()) {
    const sourcesPresent = SOURCE_PRIORITY.filter((source) => slot.bySource[source])
    const referenceSource = sourcesPresent[0]
    const referenceMembers = slot.bySource[referenceSource].members
    const members = referenceMembers.map((referenceMember) => {
      const membersBySource = { [referenceSource]: referenceMember }
      for (const source of sourcesPresent.slice(1)) {
        const match = slot.bySource[source].members.find((candidate) => sameSpecies(candidate.species, referenceMember.species))
        if (match) membersBySource[source] = match
      }
      return buildMemberConsensus(referenceMember, membersBySource, slot.trainer.id, slot.tournament, resolutions)
    })
    // Especies que otra fuente tiene y la de referencia no.
    const teamDifferences = []
    for (const source of sourcesPresent.slice(1)) {
      for (const candidate of slot.bySource[source].members) {
        if (!referenceMembers.some((referenceMember) => sameSpecies(candidate.species, referenceMember.species))) teamDifferences.push({ source, species: candidate.species[0] ?? `?${candidate.raw.species}`, note: `no está en ${referenceSource}` })
      }
    }
    const leadSource = sourcesPresent.find((source) => slot.bySource[source].alwaysLeadsWith)
    const alwaysLeadsWith = leadSource ? speciesIdFromEnglish(slot.bySource[leadSource].alwaysLeadsWith) : null
    teams.push({
      trainerId: slot.trainer.id,
      tournament: slot.tournament,
      sources: sourcesPresent,
      urls: Object.fromEntries(sourcesPresent.map((source) => [source, slot.bySource[source].url])),
      alwaysLeadsWith,
      teamSizes: Object.fromEntries(sourcesPresent.map((source) => [source, slot.bySource[source].members.length])),
      teamDifferences,
      members,
    })
  }
  teams.sort((a, b) => ROSTER.findIndex((t) => t.id === a.trainerId) - ROSTER.findIndex((t) => t.id === b.trainerId) || TOURNAMENT_ORDER.indexOf(a.tournament) - TOURNAMENT_ORDER.indexOf(b.tournament))

  const unresolvedNames = Object.fromEntries(Object.entries(unresolved).map(([category, map]) => [category, Object.fromEntries([...map.entries()].sort())]))
  return { teams, unresolvedNames, ignoredTrainers, duplicates, unexpectedGender, ambiguousForms }
}

const countBy = (items, keyOf) => items.reduce((counts, item) => ({ ...counts, [keyOf(item)]: (counts[keyOf(item)] ?? 0) + 1 }), {})
const tournamentGroup = (tournament) => (tournament.startsWith('type-expert') ? 'type-expert' : tournament)

/** Informe de cobertura y discrepancias (data/pwt-raw/merged-report.json). */
export function buildReport(sources) {
  const consensus = buildConsensus(sources)
  const sets = consensus.teams.flatMap((team) => team.members.map((member) => ({ team, member })))
  const missingByTrainer = {}
  for (const trainer of ROSTER) {
    const have = new Set(consensus.teams.filter((team) => team.trainerId === trainer.id).map((team) => team.tournament))
    const expected = trainer.category === 'champion' ? ['champions'] : [`${trainer.region}-leaders`, 'world-leaders']
    const missing = expected.filter((tournament) => !have.has(tournament))
    if (missing.length) missingByTrainer[trainer.id] = missing
  }
  const incompleteTeams = consensus.teams.filter((team) => Object.values(team.teamSizes).some((size) => size !== 6) || team.teamDifferences.length)
  const withConflicts = sets.filter(({ member }) => member.conflicts.length)

  const trainers = {}
  for (const team of consensus.teams) {
    trainers[team.trainerId] ??= {}
    trainers[team.trainerId][team.tournament] = {
      sources: team.sources,
      urls: team.urls,
      ...(team.alwaysLeadsWith ? { alwaysLeadsWith: team.alwaysLeadsWith } : {}),
      sets: team.members.map((member) => ({
        species: member.species,
        status: member.verified ? 'verified' : member.conflicts.some((conflict) => conflict.resolution === 'unresolved') ? 'discrepancy' : 'single-source',
        sources: member.sources,
        ...(member.conflicts.length ? { conflicts: member.conflicts } : {}),
      })),
      ...(team.teamDifferences.length ? { teamDifferences: team.teamDifferences } : {}),
    }
  }

  return {
    summary: {
      trainersWithTeams: new Set(consensus.teams.map((team) => team.trainerId)).size,
      rosterSize: ROSTER.length,
      teamsByTournament: countBy(consensus.teams, (team) => tournamentGroup(team.tournament)),
      teamsBySourceCount: countBy(consensus.teams, (team) => String(team.sources.length)),
      sets: sets.length,
      setsVerified: sets.filter(({ member }) => member.verified).length,
      setsNotVerified: sets.filter(({ member }) => !member.verified).length,
      setsWithConflicts: withConflicts.length,
      conflictsByResolution: countBy(withConflicts.flatMap(({ member }) => member.conflicts), (conflict) => conflict.resolution),
      teamsWithSizeOrCompositionProblems: incompleteTeams.length,
    },
    missingTournamentsByTrainer: missingByTrainer,
    teamProblems: incompleteTeams.map((team) => ({ trainerId: team.trainerId, tournament: team.tournament, teamSizes: team.teamSizes, teamDifferences: team.teamDifferences })),
    unresolvedNames: consensus.unresolvedNames,
    ignoredTrainers: consensus.ignoredTrainers,
    duplicateEntries: consensus.duplicates,
    genderOnNonFixedSpecies: consensus.unexpectedGender,
    ambiguousSpeciesForms: consensus.ambiguousForms,
    trainers,
  }
}
