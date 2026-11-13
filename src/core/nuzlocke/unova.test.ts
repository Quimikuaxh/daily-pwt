import { describe, expect, it } from 'vitest'
import { readJson } from '../../test-utils/paths'
import { chooseRecruit, createCampaign, finishEncounter, leagueEvolutionTargets, openDraft, recruitGender, specialEvolutionOptions, startEncounter,
  type CampaignState } from './campaign'
import { campaignEvolutionItems, campaignMachineMoves, isEmeraldCampaign } from './calendar'
import { beginCampaignBattle, type CampaignBattleDefinition } from './battle'
import { heldItemStock } from './heldItems'
import { campaignRules, rulesOf } from './rules'
import { advanceLevel } from './progression'

// UT-216 · Núcleo de la locke de N2/B2 (DEC-101, PRD §0, 13/11/2026): reglas por campaña, sexo, evoluciones de Gen 5 y combate de Gen 5.
const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'unova-n2b2.json')
const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'unova-n2b2-progression.json')
const definition = { campaign: 'unova-n2b2' as const, encounters, species }
const hoenn = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
const UNOVA = campaignRules('unova-n2b2')
const member = (id: string, speciesId: string, level: number, extra: object = {}) => ({ id, species: speciesId, level, history: [], victories: 0, fainted: false, ...extra })
const prepared = (encounterIndex: number, ...members: ReturnType<typeof member>[]): CampaignState =>
  ({ ...createCampaign('teselia', undefined, 'unova-n2b2'), encounterIndex, phase: 'prepare', members })

describe('reglas por campaña', () => {
  it('cada definición encuentra las suyas: Teselia por su campaña, Hoenn por la campaña o por sus encuentros; otra, ninguna', () => {
    expect(rulesOf(definition)?.id).toBe('unova-n2b2')
    expect(rulesOf({ encounters: hoenn.encounters })?.id).toBe('hoenn-emerald')
    expect(rulesOf({ encounters: [{ id: 'otro' }] })).toBeNull()
    expect(isEmeraldCampaign(definition)).toBe(false)
    expect(UNOVA.generation).toBe(5)
    expect(UNOVA.battlePoints).toEqual({ perGym: 8, flawlessBonus: 3 })
  })

  it('la partida de Teselia lo recuerda; la de Hoenn sigue sin campo (las partidas de antes no cambian)', () => {
    expect(createCampaign('x', undefined, 'unova-n2b2').campaign).toBe('unova-n2b2')
    expect(createCampaign('x', undefined, 'hoenn-emerald')).not.toHaveProperty('campaign')
  })

  it('MT, objetos y equipables salen del calendario aprobado de Teselia', () => {
    expect(campaignMachineMoves(definition, { encounterIndex: 0 }).has('workup')).toBe(false)
    expect(campaignMachineMoves(definition, { encounterIndex: 1 }).has('workup')).toBe(true)
    expect(campaignEvolutionItems(definition, prepared(3)).has('thunderstone')).toBe(true)
    expect(campaignEvolutionItems(definition, prepared(2)).has('thunderstone')).toBe(false)
    expect(heldItemStock(UNOVA, { encounterIndex: 2 }).leftovers).toBe(1)
    expect(heldItemStock(UNOVA, { encounterIndex: 4 }).fullincense).toBe(Infinity)
  })
})

describe('draft y sexo', () => {
  it('abre el draft con las reglas de Teselia y el recluta recibe sexo', () => {
    const state = openDraft(definition, createCampaign('teselia-draft', undefined, 'unova-n2b2'))
    expect(state.offer).toHaveLength(4)
    const recruited = chooseRecruit(definition, state, state.offer[0])
    const recruit = recruited.members[0]
    expect(recruit.gender === null || recruit.gender === 'M' || recruit.gender === 'F').toBe(true)
    expect(recruit.gender).toBe(recruitGender(definition, 'teselia-draft', recruit))
  })

  it('el sexo lo fija la forma si llegó por una evolución de un solo sexo, la especie si solo tiene uno, y si no la semilla', () => {
    expect(recruitGender(definition, 's', { id: 'a', species: 'gallade', history: [{ species: 'ralts', evolvedAt: 20 }, { species: 'kirlia', evolvedAt: 30 }] })).toBe('M')
    expect(recruitGender(definition, 's', { id: 'a', species: 'vespiquen', history: [{ species: 'combee', evolvedAt: 21 }] })).toBe('F')
    expect(recruitGender(definition, 's', { id: 'a', species: 'tauros', history: [] })).toBe('M')
    expect(recruitGender(definition, 's', { id: 'a', species: 'magnemite', history: [] })).toBeNull()
    const drawn = recruitGender(definition, 'semilla', { id: 'b', species: 'kirlia', history: [] })
    expect(recruitGender(definition, 'semilla', { id: 'b', species: 'kirlia', history: [] })).toBe(drawn)
  })

  it('las evoluciones por nivel de un solo sexo respetan el del miembro', () => {
    expect(advanceLevel(species, { ...member('b', 'burmy', 19), gender: 'F' }, 20).species).toBe('wormadam')
    expect(advanceLevel(species, { ...member('b', 'burmy', 19), gender: 'M' }, 20).species).toBe('mothim')
    expect(advanceLevel(species, { ...member('c', 'combee', 20), gender: 'M' }, 25).species).toBe('combee')
  })
})

describe('evoluciones de Gen 5 en la preparación', () => {
  it('por lugar: Magnezone desde el tramo de Gerania (Cueva Electrorroca), no antes', () => {
    expect(specialEvolutionOptions(definition, prepared(5, member('m', 'magneton', 39)), 'm')).toContain('magnezone')
    expect(specialEvolutionOptions(definition, prepared(4, member('m', 'magneton', 33)), 'm')).not.toContain('magnezone')
  })

  it('por ataque sabido: basta con poder aprenderlo a su nivel (Aipom, Doble Golpe al 32)', () => {
    expect(specialEvolutionOptions(definition, prepared(6, member('a', 'aipom', 32)), 'a')).toContain('ambipom')
    expect(specialEvolutionOptions(definition, prepared(5, member('a', 'aipom', 31)), 'a')).not.toContain('ambipom')
  })

  it('Mantyke, Karrablast y Shelmet en el Nv37; Gallade necesita la Piedra Alba, que en Teselia es de después de la Liga', () => {
    expect(specialEvolutionOptions(definition, prepared(6, member('m', 'mantyke', 37)), 'm')).toContain('mantine')
    expect(specialEvolutionOptions(definition, prepared(6, member('m', 'mantyke', 36)), 'm')).not.toContain('mantine')
    expect(specialEvolutionOptions(definition, prepared(6, member('k', 'karrablast', 37)), 'k')).toContain('escavalier')
    expect(specialEvolutionOptions(definition, prepared(8, member('k', 'kirlia', 50, { gender: 'M' })), 'k')).not.toContain('gallade')
  })

  it('en la Liga valen las de lugar (también Leafeon y Glaceon) y las de un solo sexo según el del miembro', () => {
    expect(leagueEvolutionTargets(definition, 'eevee')).toEqual(['espeon', 'glaceon', 'leafeon', 'umbreon'])
    expect(leagueEvolutionTargets(definition, 'burmy', 'F')).toEqual(['wormadam'])
    expect(leagueEvolutionTargets(definition, 'burmy', 'M')).toEqual(['mothim'])
    expect(leagueEvolutionTargets(definition, 'mantyke')).toEqual(['mantine'])
  })
})

describe('combate de Gen 5', () => {
  it('prepara el combate en la generación 5, con la habilidad de la tabla del rival y el sexo del recluta', () => {
    const state = { ...prepared(0, member('a', 'oshawott', 13, { gender: 'F' })) }
    const { init } = beginCampaignBattle(definition, state, { unlockedMoves: new Set(), movesByMember: { a: ['tackle'] }, leadId: 'a' }, ['a'])
    expect(init.generation).toBe(5)
    expect(init.rival.map((set) => set.ability)).toEqual(encounters[0].team.map((mon) => (mon as { ability?: string }).ability))
    expect(init.player[0]).toMatchObject({ species: 'oshawott', gender: 'F' })
  })

  it('un gimnasio ganado da los PB de Teselia: 8 y 3 más sin bajas', () => {
    const battle = startEncounter(definition, prepared(0, member('a', 'oshawott', 13)), ['a'])
    expect(finishEncounter(definition, battle, true, [false]).battlePoints).toBe(11)
    expect(finishEncounter(definition, battle, true, [true]).battlePoints).toBe(8)
  })
})
