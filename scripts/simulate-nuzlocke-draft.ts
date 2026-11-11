import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { campaignDraftRequest, createCampaign, type CampaignDefinition, type CampaignState } from '../src/core/nuzlocke/campaign'
import { draftOffer, draftPool } from '../src/core/nuzlocke/draft'
import { EMERALD_GYM_TYPES, gymCounterSpecies } from '../src/core/nuzlocke/gymDraft'

import { availableDraftForms, type DraftCalendar as Calendar, type Scenario } from '../src/core/nuzlocke/draftAvailability'
export { availableDraftForms } from '../src/core/nuzlocke/draftAvailability'
export type { Scenario } from '../src/core/nuzlocke/draftAvailability'

const choose4 = (n: number) => n < 4 ? 0 : n * (n - 1) * (n - 2) * (n - 3) / 24
const mean = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
/** Mediana exacta de observaciones, sin modificar el orden original. */
export function draftMetricSummary(values: readonly number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return {
    min: values.reduce((a, b) => Math.min(a, b), Infinity), mean: mean(values),
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    max: values.reduce((a, b) => Math.max(a, b), -Infinity),
  }
}
const range = draftMetricSummary

/** Una familia reúne todas las ramas conectadas por evolución, también Shedinja. */
export function draftEvolutionFamilies(definition: CampaignDefinition): Map<string, string> {
  const neighbors = new Map(Object.keys(definition.species).map(id => [id, new Set<string>()]))
  for (const [id, mon] of Object.entries(definition.species)) for (const rule of mon.evolutions) {
    neighbors.get(id)!.add(rule.target)
    neighbors.get(rule.target)!.add(id)
  }
  const families = new Map<string, string>()
  for (const root of [...neighbors.keys()].sort()) {
    if (families.has(root)) continue
    const pending = [root]
    while (pending.length) {
      const id = pending.pop()!
      if (families.has(id)) continue
      families.set(id, root)
      pending.push(...neighbors.get(id)!)
    }
  }
  return families
}

export function simulateDraft(definition: CampaignDefinition, calendar: Calendar, options: {
  seeds: number; margins: number[]; absoluteWindows?: { below: number; above: number }[]; prefix?: string; scenarios?: Scenario[]
}) {
  if (!Number.isSafeInteger(options.seeds) || options.seeds < 1 || options.seeds > 100_000) throw new Error('seeds debe estar entre 1 y 100000')
  if ((!options.margins.length && !options.absoluteWindows?.length) || options.margins.some(m => !Number.isFinite(m) || m < 0 || m > 100)) throw new Error('margins debe contener porcentajes entre 0 y 100 o una ventana absoluta')
  if (options.absoluteWindows?.some(w => [w.below, w.above].some(n => !Number.isFinite(n) || n < 0))) throw new Error('La ventana absoluta necesita límites finitos no negativos')
  const windows = [
    ...options.margins.map(margin => ({ margin: margin as number | null, absolute: undefined as { below: number; above: number } | undefined })),
    ...(options.absoluteWindows ?? []).map(absolute => ({ margin: null, absolute })),
  ]
  const scenarios = options.scenarios ?? ['A', 'B', 'C']
  if (!scenarios.length || scenarios.some(s => !['A', 'B', 'C'].includes(s))) throw new Error('Escenario desconocido')
  const milestones = definition.encounters.map((encounter, index) => ({ encounter, index }))
    .filter(({ encounter, index }) => encounter.kind === 'gym' || (index > 0 && definition.encounters[index - 1].kind === 'gym'))
  const rows = []
  const families = draftEvolutionFamilies(definition)
  for (const scenario of scenarios) {
    const forms = milestones.map(({ index }) => availableDraftForms(definition, calendar, index, scenario))
    for (const { margin, absolute } of windows) for (const guarantee of [false, true]) {
      const stats = milestones.map(({ encounter, index }, i) => {
        const ids = forms[i].map(form => form.species)
        const raw = campaignDraftRequest(definition, { ...createCampaign(''), encounterIndex: index }, ids, { below: 0, above: 0 })
        const window = absolute ?? { below: raw.rivalAverage * margin! / 100, above: raw.rivalAverage * margin! / 100 }
        const pool = draftPool({ ...raw, window })
        const counters = encounter.kind === 'gym' ? gymCounterSpecies(definition, encounter.id, ids) : []
        return { encounterId: encounter.id, index, ids, window, counters, rivalAverage: raw.rivalAverage,
          availability: ids.length, pool: pool.length, counterPool: pool.filter(id => counters.includes(id)).length,
          pools: [] as number[], effectivePools: [] as number[], possibleOffers: [] as number[],
          restrictedPossibleOffers: [] as number[], removedOfferFraction: [] as number[], forcedEffectivePools: [] as number[],
          alternativeOfferSets: 0, multipleFamilies: 0, fourFamilies: 0, repeatedSegmentSlots: 0,
          offers: 0, attempted: 0, forced: 0, failed: 0, reachedSeeds: 0, completedSegments: 0, coveredSegments: 0,
          repeatedSlots: 0, adjacentRepeats: 0, slots: 0, totals: [] as number[],
          frequencies: {} as Record<string, number>, types: {} as Record<string, number>,
          sets: new Set<string>(), failures: [] as { seed: string; pick: number; message: string }[] }
      })
      for (let s = 0; s < options.seeds; s++) {
        let state = createCampaign(`${options.prefix ?? 'calibracion-draft:v1'}:${s}`)
        const seen = new Set<string>()
        let failed = false
        for (const row of stats) {
          if (failed) break
          row.reachedSeeds++
          state = { ...state, encounterIndex: row.index, pick: 0, offer: [], draftTypeCovered: false }
          let covered = false
          const seenInSegment = new Set<string>()
          const picks = row.index === 0 ? 4 : 2
          for (let pick = 0; pick < picks; pick++) {
            state = { ...state, pick }
            const request = campaignDraftRequest(definition, state, row.ids, row.window)
            const pool = draftPool(request)
            const effective = pool.filter(id => row.counters.includes(id)).length
            const force: boolean = guarantee && !!EMERALD_GYM_TYPES[row.encounterId] && !covered && pick === picks - 1
            const possible = choose4(pool.length)
            const restricted = force ? possible - choose4(pool.length - effective) : possible
            row.attempted++
            row.pools.push(pool.length)
            row.effectivePools.push(effective)
            row.possibleOffers.push(possible)
            row.restrictedPossibleOffers.push(restricted)
            if (force) {
              row.forced++
              row.forcedEffectivePools.push(effective)
              if (possible) row.removedOfferFraction.push(1 - restricted / possible)
            }
            try {
              const opened: CampaignState = { ...state, offer: draftOffer({ ...request, ...(force ? { requiredSpecies: row.counters } : {}) }) }
              const offer = opened.offer
              if (offer.length !== 4 || new Set(offer).size !== 4) throw new Error('Oferta inválida')
              row.offers++
              if (restricted > 1) row.alternativeOfferSets++
              const familyCount = new Set(offer.map(id => families.get(id))).size
              if (familyCount >= 2) row.multipleFamilies++
              if (familyCount === 4) row.fourFamilies++
              row.slots += offer.length
              row.sets.add([...offer].sort().join(','))
              row.totals.push(offer.reduce((sum, id) => sum + definition.species[id].baseStatTotal, 0) / offer.length)
              covered ||= offer.some(id => row.counters.includes(id))
              for (const id of offer) {
                if (seen.has(id)) row.repeatedSlots++
                if (seenInSegment.has(id)) row.repeatedSegmentSlots++
                if (state.previousOffer.includes(id)) row.adjacentRepeats++
                row.frequencies[id] = (row.frequencies[id] ?? 0) + 1
                for (const type of definition.species[id].types ?? []) row.types[type] = (row.types[type] ?? 0) + 1
              }
              offer.forEach(id => seen.add(id))
              offer.forEach(id => seenInSegment.add(id))
              state = { ...opened, offer: [], previousOffer: offer }
            } catch (error) {
              row.failed++
              if (row.failures.length < 5) row.failures.push({ seed: state.seed, pick, message: String(error) })
              failed = true
              break
            }
          }
          if (!failed) {
            row.completedSegments++
            if (covered) row.coveredSegments++
          }
        }
      }
      for (const row of stats) {
        const average = mean(row.totals)
        rows.push({ scenario, marginPercent: margin, ...(absolute ? { absoluteWindow: absolute } : {}), guarantee, encounterId: row.encounterId,
          rivalAverage: row.rivalAverage, availableForms: row.availability,
          poolBeforeExclusions: row.pool, counterPoolBeforeExclusions: row.counterPool,
          poolAfterExclusions: range(row.pools), counterPoolAfterExclusions: range(row.effectivePools),
          possibleUnorderedOffers: range(row.possibleOffers), permittedUnorderedOffers: range(row.restrictedPossibleOffers),
          forcedOffers: row.forced, removedOfferFractionWhenForced: range(row.removedOfferFraction),
          counterPoolWhenForced: range(row.forcedEffectivePools),
          reachedSeeds: row.reachedSeeds, completedSegments: row.completedSegments, coveredSegments: row.coveredSegments,
          attemptedOffers: row.attempted, validFourDistinctOffers: row.offers, failedOffers: row.failed, failures: row.failures,
          offersWithAlternativeQuartets: row.alternativeOfferSets,
          offersWithMultipleFamilies: row.multipleFamilies, offersWithFourFamilies: row.fourFamilies,
          uniqueOfferedSpecies: Object.keys(row.frequencies).length, uniqueOfferSets: row.sets.size,
          duplicateOfferSets: row.offers - row.sets.size,
          repeatedSpeciesSlotsEarlierInCampaign: row.repeatedSlots, repeatedSlotsInPreviousOffer: row.adjacentRepeats,
          repeatedSpeciesSlotsEarlierInSegment: row.repeatedSegmentSlots,
          offeredSlots: row.slots, speciesCounts: row.frequencies, typeCounts: row.types,
          offerAverageBST: range(row.totals), averageBSTDelta: average === null ? null : average - row.rivalAverage,
          averageBSTRatio: average === null ? null : average / row.rivalAverage })
      }
    }
  }
  return { schemaVersion: 2, calendarRules: calendar.rulesVersion, options: { ...options, scenarios, prefix: options.prefix ?? 'calibracion-draft:v1' },
    notes: ['Ofertas, no combates ni tasas de victoria.', 'Cada semilla recorre los nueve drafts sin simular bajas ni decisiones de reclutamiento.',
      'Se detiene la trayectoria al fallar: los hitos posteriores pueden tener reachedSeeds menor que N.',
      'Los tipos dobles suman una presencia por tipo; el denominador es offeredSlots.',
      'Amistad en A: viabilidad potencial de un miembro desde Petra tras tres victorias, no evolución inmediata de cada recluta.',
      'A usa la unión de opciones del Escáner y recursos no gastados, sin conceder ambos ni consumir inventario.',
      'Los perfiles analíticos no cambian la regla de producto. Los posibles cuartetos no distinguen el orden de presentación.'], rows }
}

export function loadSimulationInputs(root: string) {
  const paths = ['data/nuzlocke/hoenn-emerald.json', 'data/nuzlocke/hoenn-emerald-progression.json', 'data/nuzlocke/hoenn-emerald-calendar.json']
  const bytes = paths.map(path => readFileSync(`${root}/${path}`))
  const [teams, progression, calendar] = bytes.map(buffer => JSON.parse(buffer.toString('utf8')))
  if (teams.source.revision !== progression.source.revision || teams.source.revision !== calendar.source.revision) throw new Error('Revisiones de fuente distintas')
  return { definition: { encounters: teams.encounters, species: progression.species } as CampaignDefinition, calendar: calendar as Calendar,
    evidence: paths.map((path, i) => ({ path, sha256: createHash('sha256').update(bytes[i]).digest('hex') })), revision: teams.source.revision }
}
