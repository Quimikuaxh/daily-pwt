import { NEUTRAL_NATURE } from './constants'
import { LAUNCH_DATE, LAUNCH_OPENING } from './launch'
import { rivalForDay } from './bag'
import { challengeNumber, dayIndex } from './date'
import { DataError } from './errors'
import { Prng, deriveSeed } from './prng'
import { buildPlayerTeam, poolWithoutRival } from './team'
import type { Challenge, GameData, PokemonSet, ResolvedSet, TeamVariant, Trainer } from './types'

const SEED_PREFIX = 'daily-pwt:v1:'

function uniqueVariants(variants: readonly TeamVariant[]): TeamVariant[] {
  const seenTeams = new Set<string>()
  return variants.filter((variant) => {
    const key = JSON.stringify(variant.team)
    if (seenTeams.has(key)) return false
    seenTeams.add(key)
    return true
  })
}

function spanishName(data: GameData, speciesId: string): string {
  const name = data.names.species[speciesId]
  if (!name) throw new DataError(`Falta el nombre en español del Pokémon «${speciesId}».`)
  return name
}

function resolveRivalSet(set: PokemonSet, trainer: Trainer, abilityRng: Prng, data: GameData): ResolvedSet {
  const ivs = { hp: trainer.ivs, atk: trainer.ivs, def: trainer.ivs, spa: trainer.ivs, spd: trainer.ivs, spe: trainer.ivs }
  const resolved: ResolvedSet = {
    species: set.species,
    nameEs: spanishName(data, set.species),
    level: 50,
    item: set.item,
    ability: abilityRng.pick(set.abilities),
    moves: [...set.moves] as ResolvedSet['moves'],
    nature: set.nature ?? NEUTRAL_NATURE,
    ivs,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...set.evs },
  }
  if (set.gender) resolved.gender = set.gender
  return resolved
}

function putLeadFirst(team: ResolvedSet[], trainer: Trainer, leadRng: Prng): ResolvedSet[] {
  let leadIndex: number
  if (trainer.alwaysLeadsWith) {
    leadIndex = team.findIndex((member) => member.species === trainer.alwaysLeadsWith)
    if (leadIndex < 0) {
      throw new DataError(`El entrenador «${trainer.nameEs}» siempre saca primero a «${trainer.alwaysLeadsWith}», que no está en su equipo.`)
    }
  } else {
    leadIndex = leadRng.nextInt(team.length)
  }
  return [team[leadIndex], ...team.filter((_, index) => index !== leadIndex)]
}

/** Qué reto construir: entrenador y variante opcional se eligen por id; la fecha aporta número y semillas (DEC-17). */
export type ChallengeSelection = { date: string; trainerId: string; variantId?: string }

/** Reto del día: función pura de (fecha, datos). El entrenador sale de la bolsa (DEC-03). */
export function getDailyChallenge(date: string, data: GameData): Challenge {
  const dayNumber = Math.max(0, dayIndex(date, LAUNCH_DATE))
  return challengeFor({ date, trainerId: rivalForDay(dayNumber, data.rosterSchedule, LAUNCH_OPENING) }, data)
}

/**
 * Reto con entrenador (y variante) elegidos por id, sin pasar por la bolsa ni depender de LAUNCH_DATE salvo para `number`.
 * Es lo que usan los ganchos de prueba y los tests que necesitan un rival concreto. Sin `variantId`, la variante sale del PRNG de la fecha.
 */
export function challengeFor({ date, trainerId, variantId }: ChallengeSelection, data: GameData): Challenge {
  const daySeed = SEED_PREFIX + date

  const trainer = data.trainers.find((candidate) => candidate.id === trainerId)
  if (!trainer) throw new DataError(`El entrenador «${trainerId}» no existe en los datos.`)

  const variants = uniqueVariants(trainer.variants)
  if (variants.length === 0) throw new DataError(`El entrenador «${trainer.nameEs}» no tiene equipos.`)
  const variant = variantId === undefined
    ? variants[new Prng(deriveSeed(daySeed, 'variant')).nextInt(variants.length)]
    : variants.find((candidate) => candidate.id === variantId)
  if (!variant) throw new DataError(`El entrenador «${trainer.nameEs}» no tiene la variante «${variantId}».`)

  const abilityRng = new Prng(deriveSeed(daySeed, 'abilities'))
  const resolvedTeam = variant.team.map((set) => resolveRivalSet(set, trainer, abilityRng, data))
  const rivalTeam = putLeadFirst(resolvedTeam, trainer, new Prng(deriveSeed(daySeed, 'lead')))

  const pool = poolWithoutRival(data.playerSets, trainer.id)
  const player = buildPlayerTeam(pool, rivalTeam, new Prng(deriveSeed(daySeed, 'player')), data.dex)
  const playerTeam = player.team.map((member) => ({ ...member, nameEs: spanishName(data, member.species) }))

  const challengeTrainer: Challenge['trainer'] = {
    id: trainer.id,
    nameEs: trainer.nameEs,
    gender: trainer.gender ?? 'M',
    category: trainer.category,
    region: trainer.region,
    sprite: trainer.sprite,
  }
  if (trainer.specialtyType) challengeTrainer.specialtyType = trainer.specialtyType

  return {
    number: challengeNumber(date, LAUNCH_DATE),
    date,
    dataVersion: data.dataVersion,
    trainer: challengeTrainer,
    variant: { id: variant.id, sourceTournament: variant.sourceTournament, sourceUrl: variant.sourceUrl },
    rivalTeam,
    playerTeam,
    meta: { teamAttempts: player.attempts, relaxedRules: player.relaxed },
  }
}
