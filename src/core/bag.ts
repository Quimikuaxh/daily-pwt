import { DataError } from './errors'
import { Prng } from './prng'

export type RosterScheduleEntry = { fromDayIndex: number; trainerIds: string[] }

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

// Las órdenes dependen del ciclo anterior (regla 12), así que se memorizan por calendario y apertura.
const orderCache = new WeakMap<readonly RosterScheduleEntry[], Map<string, Map<number, string[]>>>()

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

function cycleOrder(schedule: readonly RosterScheduleEntry[], globalCycle: number, opening: readonly string[]): string[] {
  let byOpening = orderCache.get(schedule)
  if (!byOpening) {
    byOpening = new Map()
    orderCache.set(schedule, byOpening)
  }
  const openingKey = opening.join(',')
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
    cache.set(cycle, order)
  }
  return cache.get(globalCycle)!
}

/**
 * Id del entrenador del día `dayIndex` (bolsa barajada, DEC-03), con la apertura del lanzamiento en el primer ciclo. Los días negativos
 * cuentan como el día 0.
 */
export function rivalForDay(dayIndex: number, schedule: readonly RosterScheduleEntry[], opening: readonly string[] = []): string {
  validateSchedule(schedule)
  const { positionInCycle, globalCycle } = locate(Math.max(0, dayIndex), schedule)
  return cycleOrder(schedule, globalCycle, opening)[positionInCycle]
}
