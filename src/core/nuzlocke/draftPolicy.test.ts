import { describe, expect, it } from 'vitest'
import { campaignInput } from '../../test-utils/campaign'
import { readJson } from '../../test-utils/paths'
import calendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import { BST_WINDOW_1 } from '../team'
import { availableMoves } from './progression'
import { campaignDraftRequest, chooseRecruit, createCampaign, openDraft } from './campaign'
import { availableDraftForms } from './draftAvailability'
import { draftPool, EMERALD_DRAFT_WINDOW } from './draft'
import { gymCounterSpecies } from './gymDraft'
import { consumedEvolutionItems } from './calendar'

const { definition } = campaignInput()
const requestAt = (index: number) => campaignDraftRequest(definition, { ...createCampaign(''), encounterIndex: index },
  availableDraftForms(definition, calendar, index, 'A').map(form => form.species), EMERALD_DRAFT_WINDOW)

describe('política de draft de Esmeralda aprobada por Jose el 11/11/2026', () => {
  it('fija −30/+40 por Pokémon, como RF-13d anterior dividido entre seis', () => {
    expect(EMERALD_DRAFT_WINDOW).toEqual({ below: 30, above: 40 })
    expect(EMERALD_DRAFT_WINDOW).toEqual({ below: BST_WINDOW_1.below / 6, above: BST_WINDOW_1.above / 6 })
    const request = requestAt(0)
    const candidates = [294, 295, 325, 365, 366].map(baseStatTotal => ({ species: String(baseStatTotal), baseStatTotal }))
    expect(draftPool({ ...request, candidates })).toEqual(['295', '325', '365'])
  })

  it('no permite que un llamador sustituya A ni amplíe o estreche la ventana', () => {
    const state = createCampaign('regla-aprobada:0')
    const expected = ['shellder', 'natu', 'smoochum', 'teddiursa']
    expect(openDraft(definition, state).offer).toEqual(expected)
    expect(openDraft(definition, state, ['mewtwo'], { below: 9999, above: 9999 }).offer).toEqual(expected)
    expect(openDraft(definition, state, [], { below: 0, above: 0 }).offer).toEqual(expected)
  })

  it('mantiene cuatro distintos, exclusión, semilla estable y cobertura en 100 campañas de nueve tramos', () => {
    const counts = Array.from({ length: 9 }, () => ({} as Record<string, number>))
    for (let seed = 0; seed < 100; seed++) {
      let previousOffer: readonly string[] = []
      for (let encounterIndex = 0; encounterIndex < 9; encounterIndex++) {
        let state = { ...createCampaign(`calibracion-draft:v1:${seed}`), encounterIndex, previousOffer }
        const request = requestAt(encounterIndex)
        const viable = new Set(request.candidates.map(mon => mon.species))
        let covered = false
        while (state.phase === 'draft') {
          const opened = openDraft(definition, state)
          expect(new Set(opened.offer).size).toBe(4)
          expect(opened.offer.some(id => state.previousOffer.includes(id))).toBe(false)
          expect(openDraft(definition, structuredClone(state), ['mewtwo'], { below: 0, above: 0 }).offer).toEqual(opened.offer)
          expect(openDraft(definition, opened)).toBe(opened)
          for (const id of opened.offer) {
            counts[encounterIndex][id] = (counts[encounterIndex][id] ?? 0) + 1
            expect(viable.has(id)).toBe(true)
            const bst = definition.species[id].baseStatTotal
            expect(bst).toBeGreaterThanOrEqual(request.rivalAverage - 30)
            expect(bst).toBeLessThanOrEqual(request.rivalAverage + 40)
          }
          covered ||= gymCounterSpecies(definition, definition.encounters[encounterIndex].id, opened.offer).length > 0
          state = chooseRecruit(definition, opened, opened.offer[0])
        }
        if (encounterIndex < 8) expect(covered).toBe(true)
        previousOffer = state.previousOffer
      }
    }
    const saved = readJson('docs/nuzlocke/draft-results-absolute-100.json')
    for (let index = 0; index < 9; index++) {
      const reference = saved.rows.find((row: { guarantee: boolean; encounterId: string }) => row.guarantee && row.encounterId === definition.encounters[index].id)
      expect(counts[index]).toEqual(reference.speciesCounts)
    }
  })

  it('usa la media por equipo en gimnasios y las cinco medias de equipo en Liga', () => {
    const average = (index: number) => {
      const team = definition.encounters[index].team
      return team.reduce((total, mon) => total + definition.species[mon.species].baseStatTotal, 0) / team.length
    }
    expect(requestAt(0).rivalAverage).toBe(325)
    expect(requestAt(8).rivalAverage).toBe(definition.encounters.slice(8).reduce((sum, _, i) => sum + average(i + 8), 0) / 5)
    expect(requestAt(8).rivalAverage).not.toBe(average(8))
  })

  it('recluta la forma ofrecida con su trayectoria legal sin gastar objetos ni perder movimientos previos', () => {
    const form = availableDraftForms(definition, calendar, 2, 'A').find(form => form.species === 'grovyle')!
    const state = { ...createCampaign('trayectoria'), encounterIndex: 2, offer: ['grovyle', 'rhyhorn', 'onix', 'gligar'] }
    const picked = chooseRecruit(definition, state, 'grovyle')
    expect(picked.members[0]).toMatchObject({ species: 'grovyle', history: form.history, level: 24 })
    const inherited = definition.species.treecko.levelUp.filter(move => move.level <= 16).map(move => move.move)
    expect(availableMoves(definition.species, picked.members[0], new Set())).toEqual(expect.arrayContaining(inherited))
    expect(state.members).toEqual([])
    const evolved = chooseRecruit(definition, { ...createCampaign('piedra'), encounterIndex: 5,
      offer: ['vileplume', 'victreebel', 'jolteon', 'vaporeon'] }, 'vileplume')
    expect(evolved.members[0].history.length).toBeGreaterThan(0)
    expect(consumedEvolutionItems(definition, evolved).size).toBe(0)
  })
})
