import { DataError } from './errors'
import { Prng } from './prng'

export type RosterScheduleEntry = { fromDayIndex: number; trainerIds: string[] }

/** Lo que el reparto (`spreadCycle`) necesita de cada entrenador. Sin rasgos, la bolsa es la de siempre (DEC-03). */
export type TrainerTraits = Record<string, { champion: boolean; region: string | null }>

/**
 * Reparto de cada ciclo (decisión de Jose, 27/10/2026): campeones repartidos a partes iguales (nunca menos de `minChampionGap` días entre
 * dos, también entre ciclos), nunca dos de la misma región seguidos y los hermanos de un mismo gimnasio separados al menos `minSiblingGap`.
 */
export const SPREAD_RULES = { minChampionGap: 6, minSiblingGap: 7, siblings: [['millo', 'maiz', 'zeo']] as readonly (readonly string[])[] }

const BAG_SEED_PREFIX = 'daily-pwt:v1:bag:'

type CycleLocation = { entry: RosterScheduleEntry; cycleIndex: number; positionInCycle: number }

function validateSchedule(schedule: readonly RosterScheduleEntry[]): void {
  if (schedule.length === 0) throw new DataError('El calendario de entrenadores está vacío.')
  if (schedule[0].fromDayIndex !== 0) throw new DataError('El calendario de entrenadores debe empezar en el día 0.')
  schedule.forEach((entry, index) => {
    if (entry.trainerIds.length === 0) throw new DataError('Una entrada del calendario de entrenadores no tiene entrenadores.')
    if (index === 0) return
    const previous = schedule[index - 1]
    const days = entry.fromDayIndex - previous.fromDayIndex
    if (days <= 0 || days % previous.trainerIds.length !== 0) {
      throw new DataError(
        `La entrada del calendario que empieza en el día ${entry.fromDayIndex} no cae en una frontera de ciclo ` +
          `(el ciclo anterior dura ${previous.trainerIds.length} días).`,
      )
    }
  })
}

/** Ciclos globales completos que ocupa cada entrada antes de la siguiente. */
function firstGlobalCycle(schedule: readonly RosterScheduleEntry[], entryIndex: number): number {
  let cycles = 0
  for (let i = 1; i <= entryIndex; i++) {
    cycles += (schedule[i].fromDayIndex - schedule[i - 1].fromDayIndex) / schedule[i - 1].trainerIds.length
  }
  return cycles
}

function locate(dayIndex: number, schedule: readonly RosterScheduleEntry[]): CycleLocation & { globalCycle: number } {
  let entryIndex = 0
  while (entryIndex + 1 < schedule.length && schedule[entryIndex + 1].fromDayIndex <= dayIndex) entryIndex++
  const entry = schedule[entryIndex]
  const daysIntoEntry = dayIndex - entry.fromDayIndex
  const cycleIndex = Math.floor(daysIntoEntry / entry.trainerIds.length)
  return {
    entry,
    cycleIndex,
    positionInCycle: daysIntoEntry % entry.trainerIds.length,
    globalCycle: firstGlobalCycle(schedule, entryIndex) + cycleIndex,
  }
}

// Las órdenes dependen del ciclo anterior (regla 12 y reparto), así que se memorizan por calendario, apertura y rasgos.
const orderCache = new WeakMap<readonly RosterScheduleEntry[], Map<string, Map<number, string[]>>>()
const traitsIds = new WeakMap<TrainerTraits, number>()
let nextTraitsId = 1
const traitsKey = (traits: TrainerTraits | undefined): string => {
  if (!traits) return '-'
  if (!traitsIds.has(traits)) traitsIds.set(traits, nextTraitsId++)
  return String(traitsIds.get(traits))
}

/**
 * Recoloca un ciclo ya barajado (DEC-62). Los `fixedCount` primeros no se mueven (retos ya publicados). Los campeones van a huecos
 * repartidos a partes iguales, `offset + round(k·n/C)`, los mismos en todos los ciclos, así que el salto entre ciclos también es de unos
 * n/C días. `offset` es la posición del primer campeón fijado en la apertura (o medio hueco) y se retrasa si el ciclo anterior acabó tarde
 * (cambio de roster). Los líderes rellenan el resto con una búsqueda con vuelta atrás que los prueba en su orden barajado: distinto al
 * último del ciclo anterior, región distinta a sus vecinos y hermanos separados. Si se agota el presupuesto (no pasa con los datos reales),
 * los que quedan entran en orden barajado. Determinista.
 */
function spreadCycle(
  order: readonly string[],
  fixedCount: number,
  previous: readonly string[] | undefined,
  traits: TrainerTraits,
  pinnedChampion: number,
): string[] {
  const n = order.length
  const isChampion = (id: string) => traits[id]?.champion === true
  const regionOf = (id: string | undefined) => (id === undefined ? undefined : (traits[id]?.region ?? undefined))
  const result: (string | undefined)[] = order.map((id, index) => (index < fixedCount ? id : undefined))
  const rest = order.slice(fixedCount)
  const champions = rest.filter(isChampion)
  const leaders = rest.filter((id) => !isChampion(id))

  if (champions.length > 0) {
    const championCount = order.filter(isChampion).length
    const spacing = n / championCount
    const previousLast = previous ? previous.map(isChampion).lastIndexOf(true) : -1
    let offset = pinnedChampion >= 0 ? pinnedChampion : Math.floor(spacing / 2)
    if (previousLast >= 0) offset = Math.max(offset, previousLast - previous!.length + SPREAD_RULES.minChampionGap)
    const slots = Array.from({ length: championCount }, (_, k) => offset + Math.round(k * spacing)).filter((slot) => slot >= fixedCount && slot < n)
    // Los campeones fijados ocupan los primeros huecos; si aun así no caben (offset tardío), los que sobran van a los últimos libres.
    const free = slots.slice(-champions.length)
    for (let index = n - 1; free.length < champions.length; index -= 1) if (index >= fixedCount && !free.includes(index)) free.push(index)
    free.sort((a, b) => a - b).forEach((slot, k) => (result[slot] = champions[k]))
  }

  // Posición global: los del ciclo anterior cuentan con índices negativos.
  const placedAt = (index: number): string | undefined => (index >= 0 ? result[index] : previous?.[previous.length + index])
  const siblingGroup = (id: string) => SPREAD_RULES.siblings.find((group) => group.includes(id))
  const fits = (id: string, index: number) => {
    const before = placedAt(index - 1)
    if (before === id) return false
    const region = regionOf(id)
    if (region !== undefined && (regionOf(before) === region || regionOf(index + 1 < n ? result[index + 1] : undefined) === region)) return false
    const group = siblingGroup(id)
    if (!group) return true
    for (let distance = 1; distance < SPREAD_RULES.minSiblingGap; distance += 1) {
      const near = [placedAt(index - distance), index + distance < n ? result[index + distance] : undefined]
      if (near.some((other) => other !== undefined && other !== id && group.includes(other))) return false
    }
    return true
  }
  const open = result.flatMap((id, index) => (id === undefined ? [index] : []))
  let budget = 200_000
  const fill = (k: number): boolean => {
    if (k === open.length) return true
    for (let candidate = 0; candidate < leaders.length; candidate += 1) {
      if (budget-- <= 0) return false
      const id = leaders[candidate]
      if (!fits(id, open[k])) continue
      result[open[k]] = id
      leaders.splice(candidate, 1)
      if (fill(k + 1)) return true
      leaders.splice(candidate, 0, id)
      result[open[k]] = undefined
    }
    return false
  }
  if (!fill(0)) open.filter((index) => result[index] === undefined).forEach((index, k) => (result[index] = leaders[k]))
  return result as string[]
}

/**
 * Apertura del lanzamiento: en el primer ciclo, el entrenador `opening[k]` pasa al día `k` y quien estaba ahí ocupa su hueco. Cada
 * entrenador sigue saliendo una vez por ciclo y los demás ciclos no cambian (salvo que la regla 12 los toque). Un id que no esté en el
 * ciclo se ignora (datos de prueba con otro roster); `challenge.test.ts` comprueba que los de `LAUNCH_OPENING` existen en los datos reales.
 */
function applyOpening(order: string[], opening: readonly string[]): void {
  opening.forEach((id, position) => {
    const from = order.indexOf(id)
    if (from < 0 || position >= order.length) return
    ;[order[position], order[from]] = [order[from], order[position]]
  })
}

function rosterOfGlobalCycle(schedule: readonly RosterScheduleEntry[], globalCycle: number): string[] {
  let entryIndex = 0
  while (entryIndex + 1 < schedule.length && firstGlobalCycle(schedule, entryIndex + 1) <= globalCycle) entryIndex++
  return schedule[entryIndex].trainerIds
}

function cycleOrder(schedule: readonly RosterScheduleEntry[], globalCycle: number, opening: readonly string[], traits?: TrainerTraits): string[] {
  let byOpening = orderCache.get(schedule)
  if (!byOpening) {
    byOpening = new Map()
    orderCache.set(schedule, byOpening)
  }
  const openingKey = `${opening.join(',')}|${traitsKey(traits)}`
  let cache = byOpening.get(openingKey)
  if (!cache) {
    cache = new Map()
    byOpening.set(openingKey, cache)
  }
  for (let cycle = 0; cycle <= globalCycle; cycle++) {
    if (cache.has(cycle)) continue
    const order = new Prng(BAG_SEED_PREFIX + cycle).shuffle([...rosterOfGlobalCycle(schedule, cycle)].sort())
    if (cycle === 0) applyOpening(order, opening)
    const previous = cycle > 0 ? cache.get(cycle - 1)! : undefined
    if (previous && order.length > 1 && order[0] === previous[previous.length - 1]) {
      ;[order[0], order[1]] = [order[1], order[0]]
    }
    const fixedCount = cycle === 0 ? opening.filter((id) => order.includes(id)).length : 0
    const pinnedChampion = traits ? opening.findIndex((id) => traits[id]?.champion === true) : -1
    cache.set(cycle, traits ? spreadCycle(order, fixedCount, previous, traits, pinnedChampion) : order)
  }
  return cache.get(globalCycle)!
}

/**
 * Id del entrenador del día `dayIndex` (bolsa barajada, DEC-03), con la apertura del lanzamiento en el primer ciclo y, con `traits`, el
 * reparto de campeones, regiones y hermanos (DEC-62). Los días negativos
 * cuentan como el día 0.
 */
export function rivalForDay(dayIndex: number, schedule: readonly RosterScheduleEntry[], opening: readonly string[] = [], traits?: TrainerTraits): string {
  validateSchedule(schedule)
  const { positionInCycle, globalCycle } = locate(Math.max(0, dayIndex), schedule)
  return cycleOrder(schedule, globalCycle, opening, traits)[positionInCycle]
}
