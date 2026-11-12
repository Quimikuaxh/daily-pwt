import { describe, expect, it } from 'vitest'
import { campaignInput } from '../../test-utils/campaign'
import calendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import { availableMoves } from './progression'
import { campaignDraftRequest, chooseRecruit, createCampaign, draftPicks, evolutionFamilies, openDraft } from './campaign'
import { availableDraftForms } from './draftAvailability'
import { draftOffer, draftPool, EMERALD_DRAFT_RATIO, relativeDraftWindow } from './draft'
import { gymCounterSpecies } from './gymDraft'
import { consumedEvolutionItems } from './calendar'

const { definition } = campaignInput()
const requestAt = (index: number) => {
  const raw = campaignDraftRequest(definition, { ...createCampaign(''), encounterIndex: index },
    availableDraftForms(definition, calendar, index, 'A').map(form => form.species), { below: 0, above: 0 })
  return { ...raw, window: { below: raw.rivalAverage * 0.06, above: raw.rivalAverage * 0.08 } }
}

describe('política de draft de Esmeralda aprobada por Jose el 11/11/2026', () => {
  it('UT-162: fija −6 %/+8 % y conserva decimales al convertir la ventana', () => {
    expect(EMERALD_DRAFT_RATIO).toEqual({ below: 0.06, above: 0.08 })
    expect(relativeDraftWindow(325, EMERALD_DRAFT_RATIO)).toEqual({ below: 19.5, above: 26 })
    expect(relativeDraftWindow(500.5, EMERALD_DRAFT_RATIO).below).toBeCloseTo(30.03, 10)
    expect(relativeDraftWindow(500.5, EMERALD_DRAFT_RATIO).above).toBeCloseTo(40.04, 10)
    expect(relativeDraftWindow(400, { below: 0.1, above: 0.2 })).toEqual({ below: 40, above: 80 })
    expect(relativeDraftWindow(0, EMERALD_DRAFT_RATIO)).toEqual({ below: 0, above: 0 })
  })

  it.each([0, 8])('UT-162: incluye ambos límites proporcionales y excluye sus vecinos en el hito %i', index => {
    const request = requestAt(index)
    const min = request.rivalAverage - request.window.below
    const max = request.rivalAverage + request.window.above
    const candidates = [min - 0.001, min, request.rivalAverage, max, max + 0.001]
      .map((baseStatTotal, i) => ({ species: String(i), baseStatTotal }))
    expect(draftPool({ ...request, candidates })).toEqual(['1', '2', '3'])
  })

  it.each([0, 8])('UT-163: openDraft aplica la media y ventana del hito %i', encounterIndex => {
    const state = { ...createCampaign('ventana-proporcional'), encounterIndex, draftTypeCovered: true }
    const request = { ...requestAt(encounterIndex), seed: state.seed }
    expect(openDraft(definition, state).offer).toEqual(draftOffer(request))
    const pool = new Set(draftPool(request))
    for (let seed = 0; seed < 25; seed++) {
      const offer = openDraft(definition, { ...state, seed: String(seed) }).offer
      expect(offer.every(id => pool.has(id))).toBe(true)
    }
  })

  it.each([0, 8])('UT-163: openDraft incluye los extremos y excluye los vecinos en el hito %i', encounterIndex => {
    const fixture = structuredClone(definition)
    const request = requestAt(encounterIndex)
    const rivals = new Set(definition.encounters.flatMap(encounter => encounter.team.map(mon => mon.species)))
    const candidates = request.candidates.map(mon => mon.species).filter(id => !rivals.has(id)).slice(0, 6)
    expect(candidates).toHaveLength(6)
    // Aísla el margen sin alterar la media rival ni la disponibilidad de formas.
    for (const id of Object.keys(fixture.species)) {
      if (!rivals.has(id)) fixture.species[id].baseStatTotal = 9999
    }
    const min = request.rivalAverage - request.window.below
    const max = request.rivalAverage + request.window.above
    const totals = [min, min + 0.5, max - 0.5, max, min - 0.001, max + 0.001]
    candidates.forEach((id, i) => { fixture.species[id].baseStatTotal = totals[i] })
    // Excluye rivales viables del pool sin cambiar sus estadísticas.
    const state = { ...createCampaign('limites'), encounterIndex, previousOffer: [...rivals], draftTypeCovered: true }
    expect([...openDraft(fixture, state).offer].sort()).toEqual(candidates.slice(0, 4).sort())
  })

  it('UT-164: exige cuatro elecciones iniciales, dos por gimnasio y tres en la Liga', () => {
    expect(Array.from({ length: 9 }, (_, i) => draftPicks(definition, i))).toEqual([4, 2, 2, 2, 2, 2, 2, 2, 3])
    let state = { ...createCampaign('tres-en-liga'), encounterIndex: 8 }
    for (let pick = 1; pick <= 3; pick++) {
      const opened = openDraft(definition, state)
      state = chooseRecruit(definition, opened, opened.offer[0])
      expect(state.pick).toBe(pick)
      expect(state.members).toHaveLength(pick)
      expect(state.phase).toBe(pick === 3 ? 'prepare' : 'draft')
      expect(state.offer).toEqual([])
    }
    expect(state.members.map(member => member.id)).toEqual(['sixto:0', 'sixto:1', 'sixto:2'])
    expect(() => openDraft(definition, state)).toThrow(/fase/)
  })

  it('no permite que un llamador sustituya A ni amplíe o estreche la ventana', () => {
    const state = createCampaign('regla-aprobada:0')
    const expected = draftOffer({ ...requestAt(0), seed: state.seed })
    expect(openDraft(definition, state).offer).toEqual(expected)
    expect(openDraft(definition, state, ['mewtwo'], { below: 9999, above: 9999 }).offer).toEqual(expected)
    expect(openDraft(definition, state, [], { below: 0, above: 0 }).offer).toEqual(expected)
  })

  it('mantiene cuatro distintos, exclusión, semilla estable y cobertura en 100 campañas de nueve tramos', () => {
    const families = evolutionFamilies(definition)
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
            expect(bst).toBeGreaterThanOrEqual(request.rivalAverage * 0.94)
            expect(bst).toBeLessThanOrEqual(request.rivalAverage * 1.08)
          }
          // Cambio de requisito (Jose, 12/11/2026): ni especies ni líneas evolutivas que ya se tienen.
          const owned = new Set(state.members.map(member => families.get(member.species)))
          expect(opened.offer.filter(id => owned.has(families.get(id)))).toEqual([])
          covered ||= gymCounterSpecies(definition, definition.encounters[encounterIndex].id, opened.offer).length > 0
          state = chooseRecruit(definition, opened, opened.offer[0])
        }
        if (encounterIndex < 8) expect(covered).toBe(true)
        previousOffer = state.previousOffer
      }
    }
    // Hasta el 12/11/2026 estas cuentas coincidían con la simulación guardada (`draft-results-relative-100.json`); el simulador no recluta
    // y no aplica la exclusión de líneas que ya se tienen, así que su informe queda como estudio de la ventana. Basta con que haya variedad.
    for (let index = 0; index < 9; index++) expect(Object.keys(counts[index]).length).toBeGreaterThan(8)
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

// Jose, 12/11/2026: cláusula de repetidos y garantía que se salta si es inviable.
describe('draft de Esmeralda: líneas que ya se tienen y garantía inviable', () => {
  const recruit = (species: string, i: number) => ({ id: `r${i}`, species, level: 20, history: [], fainted: i === 0, victories: 0 })

  it('las líneas evolutivas son componentes conexos de las evoluciones, ramas incluidas', () => {
    const families = evolutionFamilies(definition)
    expect(families.get('kirlia')).toBe(families.get('ralts'))
    expect(families.get('gardevoir')).toBe(families.get('ralts'))
    expect(families.get('silcoon')).toBe(families.get('cascoon'))
    expect(families.get('ralts')).not.toBe(families.get('abra'))
  })

  it('no ofrece especies ni líneas evolutivas que ya se tienen, tampoco las de los caídos', () => {
    const families = evolutionFamilies(definition)
    const base = { ...createCampaign('repetidos'), encounterIndex: 2 }
    const first = openDraft(definition, base)
    const members = first.offer.map(recruit)
    const opened = openDraft(definition, { ...base, members, seed: 'repetidos-2' })
    const owned = new Set(members.map(member => families.get(member.species)))
    expect(opened.offer.filter(id => owned.has(families.get(id)))).toEqual([])
    expect(new Set(opened.offer).size).toBe(4)
  })

  it('si no queda ningún candidato supereficaz en el último intento, la garantía se salta en vez de fallar', () => {
    const index = definition.encounters.findIndex(encounter => encounter.id === 'erico')
    const forms = availableDraftForms(definition, calendar, index, 'A').map(form => form.species)
    const counters = gymCounterSpecies(definition, 'erico', forms)
    const state = { ...createCampaign('erico'), encounterIndex: index, pick: draftPicks(definition, index) - 1, members: counters.map(recruit) }
    const opened = openDraft(definition, state)
    expect(new Set(opened.offer).size).toBe(4)
    expect(opened.offer.some(id => counters.includes(id))).toBe(false)
  })
})
