import { TEAM_SIZE } from '../core/constants'
import type { GameData, PokemonSet } from '../core/types'


function setProblems(set: PokemonSet, where: string, data: GameData): string[] {
  const problems: string[] = []
  if (!data.dex.species[set.species]) problems.push(`${where}: especie desconocida «${set.species}»`)
  else if (!data.names.species[set.species]) problems.push(`${where}: falta el nombre en español de «${set.species}»`)
  if (set.level !== 50) problems.push(`${where}: nivel distinto de 50`)
  if (set.moves.length !== 4) problems.push(`${where}: no tiene 4 movimientos`)
  for (const moveId of set.moves) if (!data.names.moves[moveId]) problems.push(`${where}: falta el nombre del movimiento «${moveId}»`)
  for (const abilityId of set.abilities) if (!data.names.abilities[abilityId]) problems.push(`${where}: falta el nombre de la habilidad «${abilityId}»`)
  if (!data.names.items[set.item]) problems.push(`${where}: falta el nombre del objeto «${set.item}»`)
  return problems
}

/**
 * Comprobaciones de forma de los datos (PRD §8.3, parte de F1). La legalidad frente a Gen 5 se valida en
 * los tests con @pkmn/data; aquí solo lo que se puede comprobar sin cargar el dex completo. Devuelve los problemas.
 */
export function validateGameData(data: GameData): string[] {
  const problems: string[] = []
  const trainerIds = new Set<string>()
  const variantIds = new Set<string>()

  for (const trainer of data.trainers) {
    if (trainerIds.has(trainer.id)) problems.push(`entrenador duplicado «${trainer.id}»`)
    trainerIds.add(trainer.id)
    if (trainer.variants.length === 0) problems.push(`${trainer.id}: sin variantes`)
    for (const variant of trainer.variants) {
      if (variantIds.has(variant.id)) problems.push(`variante duplicada «${variant.id}»`)
      variantIds.add(variant.id)
      if (variant.team.length !== TEAM_SIZE) problems.push(`${variant.id}: no tiene ${TEAM_SIZE} Pokémon`)
      if (trainer.alwaysLeadsWith && !variant.team.some((set) => set.species === trainer.alwaysLeadsWith)) {
        problems.push(`${variant.id}: alwaysLeadsWith «${trainer.alwaysLeadsWith}» no está en el equipo`)
      }
      variant.team.forEach((set, index) => problems.push(...setProblems(set, `${variant.id}[${index}]`, data)))
    }
  }

  data.playerSets.forEach((set, index) => problems.push(...setProblems(set, `pool[${index}]`, data)))
  for (const entry of data.rosterSchedule) {
    for (const id of entry.trainerIds) if (!trainerIds.has(id)) problems.push(`calendario: entrenador desconocido «${id}»`)
  }
  return problems
}
