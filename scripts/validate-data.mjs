/**
 * Validación de datos (PRD §8.3, DEC-38). Comprueba data/*.json, src/generated/ y public/sprites/ sin red ni scripts/.cache:
 * solo lee ficheros versionados y @pkmn/data (Gen 5). Sale con código 1 si hay algún problema.
 * Uso: npm run validate:data
 */
import { existsSync, readFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gen5, toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'
import { ROSTER } from './lib/pwt-roster.mjs'

const TEAM_SIZE = 6
const IVS_BY_CATEGORY = { leader: 20, champion: 25 }
const RED_IVS = 30
const MIN_VARIANTS = { leader: 2, champion: 1 }
/**
 * Iconos `-mini.png` de WikiDex que no se han podido descargar (su API devolvía 503 y las páginas en caché no los enlazan).
 * La aplicación no los usa (solo el GIF, PRD §10.7); son opcionales mientras estén en esta lista. `npm run gen:sprites` reintenta
 * la descarga; al conseguirlos hay que quitar el id de aquí.
 */
export const TRAINER_MINIS_MISSING_ALLOWED = ['millo', 'zeo', 'maiz', 'aloe', 'camus', 'yakon', 'gerania', 'junco', 'lirio', 'cintia', 'mirto']
const SAFE_ID = /^[a-z0-9-]+$/
const GIF_HEADERS = ['GIF87a', 'GIF89a']
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const SMOGON_TIERS = ['ubers', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu']

const readJson = (...parts) => JSON.parse(readFileSync(fromRoot(...parts), 'utf8'))
const isForbiddenSpecies = (rules, speciesId) => rules.forbiddenSpecies.some((forbidden) => speciesId === forbidden || (forbidden !== 'mew' && speciesId.startsWith(forbidden)))

function imageProblem(relativePath, kind) {
  const path = fromRoot(...relativePath.split('/'))
  if (!existsSync(path)) return `falta ${relativePath}`
  const bytes = readFileSync(path)
  const valid = kind === 'gif' ? GIF_HEADERS.includes(bytes.subarray(0, 6).toString('latin1')) : bytes.subarray(0, 8).equals(PNG_SIGNATURE)
  return valid ? null : `${relativePath} no tiene cabecera ${kind.toUpperCase()} válida`
}

/** Problemas de un set (rival o del pool) frente a @pkmn/data Gen 5, las reglas del PWT y los nombres en español. */
export async function setProblems(set, where, { names, rules }) {
  const problems = []
  const species = gen5.species.get(set.species)
  if (!species?.exists || species.gen > 5) return [`${where}: especie inexistente en Gen 5 «${set.species}»`]
  if (species.id !== set.species) problems.push(`${where}: el id de especie «${set.species}» no es canónico (${species.id})`)
  if (isForbiddenSpecies(rules, species.id)) problems.push(`${where}: especie prohibida en el PWT «${species.id}»`)
  if (!names.species[species.id]) problems.push(`${where}: falta el nombre en español de la especie «${species.id}»`)
  if (set.level !== 50) problems.push(`${where}: nivel ${set.level} (debe ser 50)`)

  const item = gen5.items.get(set.item)
  if (!item?.exists) problems.push(`${where}: objeto inexistente en Gen 5 «${set.item}»`)
  else if (item.id !== set.item) problems.push(`${where}: el id de objeto «${set.item}» no es canónico (${item.id})`)
  if (rules.forbiddenItems.includes(set.item)) problems.push(`${where}: objeto prohibido en el PWT «${set.item}»`)
  if (!names.items[set.item]) problems.push(`${where}: falta el nombre en español del objeto «${set.item}»`)

  if (set.abilities.length < 1 || set.abilities.length > 2) problems.push(`${where}: ${set.abilities.length} habilidades (se esperan 1 o 2)`)
  const speciesAbilityIds = Object.values(species.abilities).map(toId)
  for (const abilityId of set.abilities) {
    if (!speciesAbilityIds.includes(abilityId)) problems.push(`${where}: la habilidad «${abilityId}» no es de ${species.id}`)
    if (!names.abilities[abilityId]) problems.push(`${where}: falta el nombre en español de la habilidad «${abilityId}»`)
  }

  if (set.moves.length !== 4) problems.push(`${where}: ${set.moves.length} movimientos (se esperan 4)`)
  if (new Set(set.moves).size !== set.moves.length) problems.push(`${where}: movimientos repetidos`)
  // Smeargle copia cualquier movimiento con Sketch: su learnset solo lista Sketch.
  const copiesMoves = species.id === 'smeargle'
  for (const moveId of set.moves) {
    const move = gen5.moves.get(moveId)
    if (!move?.exists) {
      problems.push(`${where}: movimiento inexistente en Gen 5 «${moveId}»`)
      continue
    }
    if (rules.forbiddenMoves.includes(move.id)) problems.push(`${where}: movimiento prohibido en el PWT «${moveId}»`)
    if (!names.moves[moveId]) problems.push(`${where}: falta el nombre en español del movimiento «${moveId}»`)
    const learnsetId = moveId.startsWith('hiddenpower') ? 'hiddenpower' : moveId
    if (!copiesMoves && !(await gen5.learnsets.canLearn(species.id, learnsetId))) problems.push(`${where}: ${species.id} no aprende «${moveId}» en Gen 5`)
  }
  return problems
}

export function scheduleProblems(schedule, trainerIds) {
  const problems = []
  if (!Array.isArray(schedule) || schedule.length === 0) return ['rosterSchedule vacío o ausente']
  if (schedule[0].fromDayIndex !== 0) problems.push('rosterSchedule: la primera entrada debe empezar en el día 0')
  schedule.forEach((entry, index) => {
    if (!entry.trainerIds?.length) problems.push(`rosterSchedule[${index}]: sin entrenadores`)
    for (const id of entry.trainerIds ?? []) if (!trainerIds.has(id)) problems.push(`rosterSchedule[${index}]: entrenador desconocido «${id}»`)
    if (new Set(entry.trainerIds).size !== entry.trainerIds?.length) problems.push(`rosterSchedule[${index}]: entrenadores repetidos`)
    if (index === 0) return
    const previous = schedule[index - 1]
    const days = entry.fromDayIndex - previous.fromDayIndex
    if (days <= 0 || days % previous.trainerIds.length !== 0) problems.push(`rosterSchedule[${index}]: el día ${entry.fromDayIndex} no cae en una frontera de ciclo (el ciclo anterior dura ${previous.trainerIds.length} días)`)
  })
  const lastEntry = schedule[schedule.length - 1]
  const scheduled = new Set(lastEntry.trainerIds)
  for (const id of trainerIds) if (!scheduled.has(id)) problems.push(`rosterSchedule: «${id}» no está en la última entrada (nunca saldría en un ciclo nuevo)`)
  return problems
}

export function trainerProblems(trainer) {
  const problems = []
  const where = trainer.id
  if (!SAFE_ID.test(trainer.id ?? '')) problems.push(`${where}: id de entrenador no válido`)
  if (!trainer.nameEs) problems.push(`${where}: sin nameEs`)
  if (!['M', 'F'].includes(trainer.gender)) problems.push(`${where}: gender debe ser M o F`)
  if (!['leader', 'champion'].includes(trainer.category)) problems.push(`${where}: categoría no válida «${trainer.category}»`)
  if (!['kanto', 'johto', 'hoenn', 'sinnoh', 'unova'].includes(trainer.region)) problems.push(`${where}: región no válida «${trainer.region}»`)
  if (trainer.sprite !== trainer.id) problems.push(`${where}: sprite «${trainer.sprite}» distinto del id`)
  const expectedIvs = trainer.id === 'rojo' ? RED_IVS : IVS_BY_CATEGORY[trainer.category]
  if (trainer.ivs !== expectedIvs) problems.push(`${where}: ivs ${trainer.ivs} (se esperan ${expectedIvs})`)
  if (trainer.category === 'leader' && !trainer.specialtyType) problems.push(`${where}: el líder no tiene specialtyType`)

  const variantCount = trainer.variants?.length ?? 0
  const minimumVariants = MIN_VARIANTS[trainer.category] ?? 1
  if (variantCount < 1) problems.push(`${where}: sin variantes`)
  else if (variantCount < minimumVariants) problems.push(`${where}: ${variantCount} variantes (mínimo ${minimumVariants})`)
  if (trainer.category === 'leader') {
    const tournaments = new Set((trainer.variants ?? []).map((variant) => variant.sourceTournament))
    if (!tournaments.has('World Leaders')) problems.push(`${where}: sin variante del Mundial de Líderes`)
    if (![...tournaments].some((tournament) => /^(Kanto|Johto|Hoenn|Sinnoh|Unova) Leaders$/.test(tournament))) problems.push(`${where}: sin variante del torneo regional`)
  }
  for (const variant of trainer.variants ?? []) {
    if (!SAFE_ID.test(variant.id ?? '') || !variant.id.startsWith(`${trainer.id}-`)) problems.push(`${variant.id}: id de variante no válido (debe empezar por «${trainer.id}-»)`)
    if (!variant.sourceTournament) problems.push(`${variant.id}: sin sourceTournament`)
    if (!/^https:\/\//.test(variant.sourceUrl ?? '')) problems.push(`${variant.id}: sourceUrl no es https`)
    if (variant.team.length !== TEAM_SIZE) problems.push(`${variant.id}: tiene ${variant.team.length} Pokémon (se esperan ${TEAM_SIZE})`)
    if (trainer.alwaysLeadsWith && !variant.team.some((set) => set.species === trainer.alwaysLeadsWith)) problems.push(`${variant.id}: alwaysLeadsWith «${trainer.alwaysLeadsWith}» no está en el equipo`)
  }
  return problems
}

function poolStructureProblems(pool, trainerIds) {
  const problems = []
  const keys = new Set()
  pool.forEach((set, index) => {
    const where = `pool[${index}] ${set.species}`
    const key = JSON.stringify([set.species, set.item, set.abilities, [...set.moves].sort(), set.nature ?? null])
    if (keys.has(key)) problems.push(`${where}: set duplicado`)
    keys.add(key)
    if (gen5.species.get(set.species)?.nfe) problems.push(`${where}: no está totalmente evolucionado`)
    const validTag = (tag) => tag.startsWith('source:') && (trainerIds.has(tag.slice(7)) || (tag.startsWith('source:smogon-') && SMOGON_TIERS.includes(tag.slice(14))))
    if (!(set.tags ?? []).some(validTag)) problems.push(`${where}: sin tag de origen válido`)
  })
  return problems
}

function spriteProblems(trainers, speciesIds, dex) {
  const problems = []
  for (const trainer of trainers) {
    const miniOptional = TRAINER_MINIS_MISSING_ALLOWED.includes(trainer.sprite) && !existsSync(fromRoot('public', 'sprites', 'trainers', `${trainer.sprite}-mini.png`))
    const checks = [imageProblem(`public/sprites/trainers/${trainer.sprite}.gif`, 'gif')]
    if (!miniOptional) checks.push(imageProblem(`public/sprites/trainers/${trainer.sprite}-mini.png`, 'png'))
    for (const problem of checks) if (problem) problems.push(problem)
  }
  for (const speciesId of speciesIds) {
    const spriteId = dex.species[speciesId]?.spriteId
    if (!spriteId) {
      problems.push(`dex-gen5.json: «${speciesId}» sin spriteId`)
      continue
    }
    for (const side of ['front', 'back']) {
      const problem = imageProblem(`public/sprites/pokemon/${side}/${spriteId}.gif`, 'gif')
      if (problem) problems.push(problem)
    }
  }
  return problems
}

function generatedProblems(allSets, speciesIds) {
  const problems = []
  const dex = readJson('src', 'generated', 'dex-gen5.json')
  const iconIndex = readJson('src', 'generated', 'icon-index.json')
  const spriteBoxes = readJson('src', 'generated', 'sprite-boxes.json')
  const descriptions = readJson('src', 'generated', 'descriptions-es.json')
  for (const speciesId of speciesIds) {
    const spriteId = dex.species[speciesId]?.spriteId
    if (!(iconIndex[spriteId] > 0)) problems.push(`icon-index.json: falta el icono de «${spriteId}»`)
    for (const side of ['front', 'back']) if (!spriteBoxes[side]?.[spriteId]) problems.push(`sprite-boxes.json: falta la caja ${side} de «${spriteId}»`)
  }
  for (const set of allSets) {
    for (const moveId of set.moves) if (!descriptions.moves[moveId]) problems.push(`descriptions-es.json: falta el movimiento «${moveId}»`)
    for (const abilityId of set.abilities) if (!descriptions.abilities[abilityId]) problems.push(`descriptions-es.json: falta la habilidad «${abilityId}»`)
  }
  return [...new Set(problems)]
}

function coverageReport(trainers) {
  const variants = trainers.flatMap((trainer) => trainer.variants.map((variant) => ({ trainer, variant })))
  const variantsByTournament = {}
  for (const { variant } of variants) variantsByTournament[variant.sourceTournament] = (variantsByTournament[variant.sourceTournament] ?? 0) + 1
  const sets = variants.flatMap(({ variant }) => variant.team.map((set) => ({ variantId: variant.id, species: set.species, verified: set.verified })))
  return {
    trainers: trainers.length,
    variants: variants.length,
    variantsByTournament,
    sets: sets.length,
    trainerMinisMissing: trainers.filter((trainer) => !existsSync(fromRoot('public', 'sprites', 'trainers', `${trainer.sprite}-mini.png`))).map((trainer) => trainer.id),
    unverifiedSets: sets.filter((set) => set.verified !== true).map((set) => `${set.variantId}: ${set.species}`),
    trainersWithoutVariants: trainers.filter((trainer) => trainer.variants.length === 0).map((trainer) => trainer.id),
    leadersWithSingleVariant: trainers.filter((trainer) => trainer.category === 'leader' && trainer.variants.length === 1).map((trainer) => trainer.id),
  }
}

export async function validateData() {
  const trainersFile = readJson('data', 'trainers.json')
  const pool = readJson('data', 'player-sets.json')
  const names = readJson('src', 'generated', 'names-es.json')
  const dex = readJson('src', 'generated', 'dex-gen5.json')
  const rules = readJson('src', 'core', 'pwt-rules.json')
  const { trainers } = trainersFile
  const problems = []

  if (typeof trainersFile.dataVersion !== 'string' || !trainersFile.dataVersion) problems.push('trainers.json: sin dataVersion')

  const trainerIds = new Set()
  for (const trainer of trainers) {
    if (trainerIds.has(trainer.id)) problems.push(`entrenador duplicado «${trainer.id}»`)
    trainerIds.add(trainer.id)
  }
  const rosterIds = ROSTER.map((entry) => entry.id)
  for (const id of rosterIds) if (!trainerIds.has(id)) problems.push(`falta el entrenador del roster «${id}» (PRD §7.3)`)
  for (const id of trainerIds) if (!rosterIds.includes(id)) problems.push(`entrenador fuera del roster «${id}»`)

  const variantIds = new Set()
  for (const variant of trainers.flatMap((trainer) => trainer.variants ?? [])) {
    if (variantIds.has(variant.id)) problems.push(`variante duplicada «${variant.id}»`)
    variantIds.add(variant.id)
  }

  problems.push(...scheduleProblems(trainersFile.rosterSchedule, trainerIds))
  for (const trainer of trainers) problems.push(...trainerProblems(trainer))

  const context = { names, rules }
  for (const trainer of trainers) {
    for (const variant of trainer.variants ?? []) {
      for (const [index, set] of variant.team.entries()) problems.push(...(await setProblems(set, `${variant.id}[${index}]`, context)))
    }
  }
  for (const [index, set] of pool.entries()) problems.push(...(await setProblems(set, `pool[${index}] ${set.species}`, context)))
  problems.push(...poolStructureProblems(pool, trainerIds))

  const rivalSets = trainers.flatMap((trainer) => trainer.variants.flatMap((variant) => variant.team))
  const speciesIds = [...new Set([...rivalSets, ...pool].map((set) => set.species))].sort()
  problems.push(...spriteProblems(trainers, speciesIds, dex))
  problems.push(...generatedProblems([...rivalSets, ...pool], speciesIds))

  return { problems, coverage: coverageReport(trainers), poolSize: pool.length, poolSpecies: new Set(pool.map((set) => set.species)).size, speciesWithSprites: speciesIds.length }
}

if (isMain(import.meta.url)) {
  const { problems, coverage, poolSize, poolSpecies, speciesWithSprites } = await validateData()
  console.log(`Cobertura: ${coverage.trainers} entrenadores, ${coverage.variants} variantes, ${coverage.sets} sets`)
  console.log(`Variantes por torneo: ${Object.entries(coverage.variantsByTournament).map(([tournament, count]) => `${tournament} ${count}`).join(', ')}`)
  console.log(`Entrenadores sin variantes: ${coverage.trainersWithoutVariants.join(', ') || 'ninguno'}`)
  console.log(`Líderes con una sola variante: ${coverage.leadersWithSingleVariant.join(', ') || 'ninguno'}`)
  console.log(`Sets con verified: false: ${coverage.unverifiedSets.length}${coverage.unverifiedSets.length ? ` (${coverage.unverifiedSets.join('; ')})` : ''}`)
  console.log(`Iconos -mini.png de entrenador ausentes (permitidos, la app no los usa): ${coverage.trainerMinisMissing.length}${coverage.trainerMinisMissing.length ? ` (${coverage.trainerMinisMissing.join(', ')})` : ''}`)
  console.log(`Pool del jugador: ${poolSize} sets de ${poolSpecies} especies; especies con sprites comprobados: ${speciesWithSprites}`)
  if (problems.length) {
    console.error(`\n${problems.length} problemas:`)
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exitCode = 1
  } else {
    console.log('Datos válidos.')
  }
}
