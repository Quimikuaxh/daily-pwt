import { readFileSync, writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'
import { buildConsensus, loadRawSources } from './lib/pwt-consensus.mjs'
import { spanishName } from './lib/pwt-normalize.mjs'
import { ROSTER } from './lib/pwt-roster.mjs'
import { TOURNAMENT_ORDER, tournamentLabel, tournamentSlug } from './lib/pwt-sources.mjs'

const TEAM_SIZE = 6
const OUTPUT_PATH = fromRoot('data', 'pwt-raw', 'trainers.generated.json')
const NOTES_PATH = fromRoot('data', 'pwt-raw', 'merge-notes.json')
const CURRENT_TRAINERS_PATH = fromRoot('data', 'trainers.json')
const DATA_VERSION = 'f2-1'
const BULBAPEDIA_ORDER = ['bulbapedia', 'wikidex', 'serebii']

const capitalize = (text) => text[0].toUpperCase() + text.slice(1)
const sortedJoin = (items) => [...items].sort().join(',')

/** Motivos por los que un equipo consensuado no puede entrar en los datos del juego (vacío = válido). */
function teamProblems(team) {
  const problems = []
  if (team.members.length !== TEAM_SIZE) problems.push(`tiene ${team.members.length} Pokémon`)
  for (const member of team.members) {
    const tokens = [member.species, member.item, ...member.abilities, ...member.moves]
    if (tokens.some((token) => !token || String(token).startsWith('?'))) problems.push(`${member.species}: nombre sin resolver`)
    if (member.moves.length !== 4) problems.push(`${member.species}: ${member.moves.length} movimientos`)
    if (member.abilities.length === 0) problems.push(`${member.species}: sin habilidad`)
    if (member.level !== 50) problems.push(`${member.species}: nivel ${member.level}`)
  }
  return problems
}

function toPokemonSet(member) {
  return {
    species: member.species,
    level: 50,
    item: member.item,
    abilities: member.abilities,
    moves: member.moves,
    natureAssumed: true,
    evsAssumed: true,
    verified: member.verified,
  }
}

const teamSignature = (team) =>
  team.members
    .map((member) => [member.species, member.item, sortedJoin(member.abilities), sortedJoin(member.moves)].join('|'))
    .sort()
    .join('#')

function sourceUrlOf(team) {
  const source = BULBAPEDIA_ORDER.find((name) => team.urls[name])
  return team.urls[source]
}

/** Tipos de los Supertorneos Tipo en los que aparece el entrenador (en las fuentes que los cubren). */
function specialtyTypesOf(teams) {
  return [...new Set(teams.filter((team) => team.tournament.startsWith('type-expert:')).map((team) => capitalize(team.tournament.slice('type-expert:'.length))))]
}

function buildTrainerNode(trainer, teams, notes) {
  const orderedTeams = [...teams].sort((a, b) => TOURNAMENT_ORDER.indexOf(a.tournament) - TOURNAMENT_ORDER.indexOf(b.tournament))
  const variants = []
  const variantTeams = []
  const seenSignatures = new Map()
  for (const team of orderedTeams) {
    const problems = teamProblems(team)
    if (problems.length) {
      notes.skippedVariants.push({ trainerId: trainer.id, tournament: team.tournament, problems })
      continue
    }
    const signature = teamSignature(team)
    if (seenSignatures.has(signature)) {
      notes.deduplicated.push({ trainerId: trainer.id, tournament: team.tournament, sameAs: seenSignatures.get(signature) })
      continue
    }
    seenSignatures.set(signature, team.tournament)
    variantTeams.push(team)
    variants.push({ id: `${trainer.id}-${tournamentSlug(team.tournament)}`, sourceTournament: tournamentLabel(team.tournament), sourceUrl: sourceUrlOf(team), team: team.members.map(toPokemonSet) })
  }

  const specialtyTypes = trainer.category === 'leader' ? specialtyTypesOf(teams) : []
  if (trainer.category === 'leader' && specialtyTypes.length !== 1) notes.specialtyTypeProblems.push({ trainerId: trainer.id, typesFound: specialtyTypes })

  const leadSpecies = [...new Set(teams.map((team) => team.alwaysLeadsWith).filter(Boolean))]
  let alwaysLeadsWith
  if (leadSpecies.length === 1) {
    if (variantTeams.every((team) => team.members.some((member) => member.species === leadSpecies[0]))) alwaysLeadsWith = leadSpecies[0]
    else notes.alwaysLeadsWithProblems.push({ trainerId: trainer.id, species: leadSpecies[0], problem: 'no está en todas las variantes' })
  } else if (leadSpecies.length > 1) {
    notes.alwaysLeadsWithProblems.push({ trainerId: trainer.id, species: leadSpecies, problem: 'las fuentes difieren entre torneos' })
  }

  return {
    id: trainer.id,
    nameEs: trainer.nameEs,
    nameEn: trainer.nameEn,
    gender: trainer.gender,
    category: trainer.category,
    region: trainer.region,
    ...(specialtyTypes.length === 1 ? { specialtyType: specialtyTypes[0] } : {}),
    sprite: trainer.id,
    ivs: trainer.ivs,
    ...(alwaysLeadsWith ? { alwaysLeadsWith } : {}),
    variants,
  }
}

function missingSpanishNames(trainers) {
  const missing = new Set()
  for (const trainer of trainers) {
    for (const variant of trainer.variants) {
      for (const set of variant.team) {
        if (!spanishName('species', set.species)) missing.add(`species:${set.species}`)
        if (!spanishName('items', set.item)) missing.add(`items:${set.item}`)
        for (const ability of set.abilities) if (!spanishName('abilities', ability)) missing.add(`abilities:${ability}`)
        for (const move of set.moves) if (!spanishName('moves', move)) missing.add(`moves:${move}`)
      }
    }
  }
  return [...missing].sort()
}

const describeSet = (set) => `${set.species} [${set.item}] {${sortedJoin(set.abilities)}} (${sortedJoin(set.moves)})`

/** Compara los entrenadores ya cargados en data/trainers.json (verificados a mano) con lo generado. */
function regressionAgainstCurrent(generated) {
  const current = JSON.parse(readFileSync(CURRENT_TRAINERS_PATH, 'utf8')).trainers
  const differences = []
  const generatedById = new Map(generated.map((trainer) => [trainer.id, trainer]))
  for (const currentTrainer of current) {
    const generatedTrainer = generatedById.get(currentTrainer.id)
    if (!generatedTrainer) {
      differences.push({ trainerId: currentTrainer.id, problem: 'no está en lo generado' })
      continue
    }
    for (const field of ['nameEs', 'nameEn', 'gender', 'category', 'region', 'specialtyType', 'ivs', 'alwaysLeadsWith']) {
      if (currentTrainer[field] !== generatedTrainer[field]) differences.push({ trainerId: currentTrainer.id, field, current: currentTrainer[field] ?? null, generated: generatedTrainer[field] ?? null })
    }
    const generatedVariants = new Map(generatedTrainer.variants.map((variant) => [variant.id, variant]))
    for (const currentVariant of currentTrainer.variants) {
      const generatedVariant = generatedVariants.get(currentVariant.id)
      if (!generatedVariant) {
        differences.push({ trainerId: currentTrainer.id, variant: currentVariant.id, problem: 'variante actual ausente en lo generado (o deduplicada/no extraída)' })
        continue
      }
      if (currentVariant.sourceUrl !== generatedVariant.sourceUrl) differences.push({ trainerId: currentTrainer.id, variant: currentVariant.id, field: 'sourceUrl', current: currentVariant.sourceUrl, generated: generatedVariant.sourceUrl })
      const generatedSets = new Map(generatedVariant.team.map((set) => [set.species, set]))
      for (const currentSet of currentVariant.team) {
        const generatedSet = generatedSets.get(currentSet.species)
        if (!generatedSet) differences.push({ trainerId: currentTrainer.id, variant: currentVariant.id, problem: `${currentSet.species} ausente en lo generado` })
        else if (describeSet(currentSet) !== describeSet(generatedSet)) differences.push({ trainerId: currentTrainer.id, variant: currentVariant.id, species: currentSet.species, current: describeSet(currentSet), generated: describeSet(generatedSet) })
        else if (currentSet.verified !== generatedSet.verified) differences.push({ trainerId: currentTrainer.id, variant: currentVariant.id, species: currentSet.species, field: 'verified', current: currentSet.verified, generated: generatedSet.verified })
      }
      for (const generatedSet of generatedVariant.team) {
        if (!currentVariant.team.some((set) => set.species === generatedSet.species)) differences.push({ trainerId: currentTrainer.id, variant: currentVariant.id, problem: `${generatedSet.species} extra en lo generado` })
      }
    }
    const currentVariantIds = new Set(currentTrainer.variants.map((variant) => variant.id))
    for (const generatedVariant of generatedTrainer.variants) {
      if (!currentVariantIds.has(generatedVariant.id)) differences.push({ trainerId: currentTrainer.id, variant: generatedVariant.id, problem: 'variante extra en lo generado (no está en data/trainers.json)' })
    }
  }
  return { trainersCompared: current.map((trainer) => trainer.id), differences }
}

export function mergePwt() {
  const { teams } = buildConsensus(loadRawSources())
  const notes = { skippedVariants: [], deduplicated: [], specialtyTypeProblems: [], alwaysLeadsWithProblems: [], trainersWithoutVariants: [], missingSpanishNames: [], regression: null }
  const trainers = ROSTER.map((trainer) => buildTrainerNode(trainer, teams.filter((team) => team.trainerId === trainer.id), notes))
  notes.trainersWithoutVariants = trainers.filter((trainer) => trainer.variants.length === 0).map((trainer) => trainer.id)
  notes.missingSpanishNames = missingSpanishNames(trainers)
  notes.regression = regressionAgainstCurrent(trainers)
  return { trainers, notes }
}

const compactArrays = (json) => json.replace(/\[\s*((?:"[^"\]]*"(?:,\s*)?\s*)+)\]/g, (match, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ').trim() + ']')

/**
 * Documento de data/trainers.json (DEC-37): los 53 entrenadores en una sola entrada de calendario desde el día 0
 * (la bolsa se rebaraja desde el inicio; el orden de `trainerIds` no importa porque la bolsa lo ordena antes de barajar).
 */
export function buildTrainersDocument(trainers) {
  return { dataVersion: DATA_VERSION, rosterSchedule: [{ fromDayIndex: 0, trainerIds: trainers.map((trainer) => trainer.id) }], trainers }
}

export const serializeTrainersDocument = (document) => compactArrays(JSON.stringify(document, null, 2)) + '\n'

if (isMain(import.meta.url)) {
  // La regresión se calcula contra el data/trainers.json de antes de esta ejecución.
  const { trainers, notes } = mergePwt()
  writeFileSync(OUTPUT_PATH, JSON.stringify({ trainers }, null, 2) + '\n')
  writeFileSync(NOTES_PATH, JSON.stringify(notes, null, 2) + '\n')
  if (process.argv.includes('--write')) {
    writeFileSync(CURRENT_TRAINERS_PATH, serializeTrainersDocument(buildTrainersDocument(trainers)))
    console.log(`data/trainers.json escrito: ${trainers.length} entrenadores, dataVersion ${DATA_VERSION}`)
  }
  const variants = trainers.flatMap((trainer) => trainer.variants)
  const sets = variants.flatMap((variant) => variant.team)
  console.log(`Entrenadores: ${trainers.length}; variantes: ${variants.length}; sets: ${sets.length} (verified ${sets.filter((set) => set.verified).length}, no ${sets.filter((set) => !set.verified).length})`)
  console.log(`Sin variantes: ${notes.trainersWithoutVariants.join(', ') || 'ninguno'}; deduplicadas: ${notes.deduplicated.length}; descartadas: ${notes.skippedVariants.length}; nombres es sin resolver: ${notes.missingSpanishNames.length}`)
  console.log(`Regresión (${notes.regression.trainersCompared.join(', ')}): ${notes.regression.differences.length} diferencias`)
}
