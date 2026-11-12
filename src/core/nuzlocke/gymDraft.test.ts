import { describe, expect, it } from 'vitest'
import { Dex } from '@pkmn/sim'
import { campaignInput } from '../../test-utils/campaign'
import { campaignDraftRequest, chooseRecruit, createCampaign, finishEncounter, openDraft, startEncounter } from './campaign'
import { EMERALD_GYM_TYPES, gymCounterSpecies } from './gymDraft'
import { draftOffer } from './draft'
import { availableDraftForms } from './draftAvailability'
import calendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'

const { definition } = campaignInput()
const ids = Object.keys(definition.species)
const window = { below: 9999, above: 9999 }
const requestAt = (state: ReturnType<typeof createCampaign>) => {
  const raw = campaignDraftRequest(definition, state,
    availableDraftForms(definition, calendar, state.encounterIndex, 'A').map(form => form.species), window)
  return { ...raw, window: { below: raw.rivalAverage * 0.10, above: raw.rivalAverage * 0.08 } }
}

describe('tipo propio supereficaz por tramo de gimnasio (Jose, 11/11/2026)', () => {
  it('coincide con la tabla de tipos Gen 3 para los ocho gimnasios y ambos tipos propios', () => {
    const dex = Dex.forGen(3)
    for (const [id, type] of Object.entries(EMERALD_GYM_TYPES)) {
      const expected = ids.filter(species => definition.species[species].types!.some(own => dex.getEffectiveness(own, type) > 0))
      expect(gymCounterSpecies(definition, id, ids)).toEqual(expected)
    }
    expect(gymCounterSpecies(definition, 'erico', ['wooper'])).toEqual(['wooper'])
    expect(gymCounterSpecies(definition, 'sixto', ids)).toEqual([])
  })

  it('garantiza cada tramo completo para 25 semillas y conserva ofertas al reanudar', () => {
    for (let seed = 0; seed < 25; seed++) {
      let previousOffer: readonly string[] = []
      for (let encounterIndex = 0; encounterIndex < 8; encounterIndex++) {
        let state = { ...createCampaign(String(seed)), encounterIndex, previousOffer }
        const counters = gymCounterSpecies(definition, definition.encounters[encounterIndex].id, ids)
        let covered = false
        while (state.phase === 'draft') {
          const opened = openDraft(definition, state, ids, window)
          expect(openDraft(definition, opened, ids, window)).toBe(opened)
          expect(openDraft(definition, state, [...ids].reverse(), window).offer).toEqual(opened.offer)
          expect(new Set(opened.offer).size).toBe(4)
          expect(opened.offer.some(id => state.previousOffer.includes(id))).toBe(false)
          covered ||= opened.offer.some(id => counters.includes(id))
          state = chooseRecruit(definition, JSON.parse(JSON.stringify(opened)), opened.offer[0])
        }
        expect(covered).toBe(true)
        previousOffer = state.previousOffer
      }
    }
  })

  it('condiciona solo la última oferta pendiente con las reglas aprobadas', () => {
    const base = { ...createCampaign('ultimo'), pick: 3 }
    const opened = openDraft(definition, base)
    const counters = gymCounterSpecies(definition, 'petra', opened.offer)
    expect(counters.length).toBeGreaterThan(0)
    expect(opened.draftTypeCovered).toBe(true)
    const first = createCampaign('ultimo')
    expect(openDraft(definition, first).offer).toEqual(draftOffer(requestAt(first)))
  })

  it('conserva la cobertura de una oferta descartada y la reinicia al ganar el gimnasio', () => {
    const state = { ...createCampaign('cubierto'), pick: 3, draftTypeCovered: true }
    const candidates = ['abra', 'rattata', 'pidgey', 'spearow', 'zubat', 'sentret', 'hoothoot', 'natu']
    const opened = openDraft(definition, state, candidates, window)
    const expected = draftOffer(requestAt(state))
    expect(opened.offer).toEqual(expected)
    const ready = chooseRecruit(definition, opened, opened.offer[0])
    const playing = startEncounter(definition, ready, [ready.members[0].id])
    expect(finishEncounter(definition, playing, true, [false]).draftTypeCovered).toBe(false)
  })

  it.each([0, 1, 2])('UT-164: no fuerza cobertura de tipo en la oferta %i de Liga', pick => {
    const state = { ...createCampaign('liga-sin-garantia'), encounterIndex: 8, pick, draftTypeCovered: false }
    const opened = openDraft(definition, state)
    expect(opened.offer).toEqual(draftOffer(requestAt(state)))
    expect(opened.draftTypeCovered).toBe(false)
  })

  it('no exige un tipo en la Liga ni vuelve a sortear una oferta guardada anterior a la regla', () => {
    const state = { ...createCampaign('liga'), encounterIndex: 8, pick: 1 }
    expect(openDraft(definition, state, ids, window).offer).toHaveLength(4)
    const saved = { ...createCampaign('viejo'), pick: 3, offer: ['pidgey', 'spearow', 'zubat', 'natu'] }
    expect(openDraft(definition, saved, ids, window)).toBe(saved)
  })
})
