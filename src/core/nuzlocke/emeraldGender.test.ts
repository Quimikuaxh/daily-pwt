import { describe, expect, it } from 'vitest'
import { readJson } from '../../test-utils/paths'
import { createCampaign } from './campaign'
import { beginCampaignBattle, type CampaignBattleDefinition } from './battle'
import { campaignRivalGender, emeraldTrainerGender } from './emeraldGender'

// UT-247 (Jose, 17/11/2026): los rivales de Hoenn llevan el sexo con el que salen en Esmeralda (CreateNPCTrainerParty).
describe('sexo de los rivales de Esmeralda (UT-247)', () => {
  it('compara la proporción de hembras (PERCENT_FEMALE) con el byte del entrenador', () => {
    // 50 % hembras = 127: hembra con entrenadora (0x78) y macho con entrenador (0x88) o en combate doble (0x80).
    expect([emeraldTrainerGender(0.5, 0x78), emeraldTrainerGender(0.5, 0x88), emeraldTrainerGender(0.5, 0x80)]).toEqual(['F', 'M', 'M'])
    // 75 % hembras = 191: hembra siempre; 25 % = 63 y 12,5 % = 31: macho siempre.
    expect([emeraldTrainerGender(0.75, 0x88), emeraldTrainerGender(0.25, 0x78), emeraldTrainerGender(0.125, 0x78)]).toEqual(['F', 'M', 'M'])
    expect([emeraldTrainerGender(0, 0x78), emeraldTrainerGender(1, 0x88), emeraldTrainerGender(null, 0x78)]).toEqual(['M', 'F', null])
  })

  it('el catálogo manda si trae sexo; fuera de Hoenn o sin entrenador conocido no se calcula', () => {
    const share = () => 0.5
    expect(campaignRivalGender('petra', 3, { species: 'geodude' }, share)).toBe('F')
    expect(campaignRivalGender('plubio', 3, { species: 'milotic' }, share)).toBe('M')
    expect(campaignRivalGender('petra', 3, { species: 'geodude', gender: 'M' }, share)).toBe('M')
    expect(campaignRivalGender('petra', 5, { species: 'geodude' }, share)).toBeUndefined()
    expect(campaignRivalGender('otro', 3, { species: 'geodude' }, share)).toBeUndefined()
  })

  it('el combate de Petra da a sus Pokémon de 50 % el sexo femenino del original', () => {
    const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
    const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'hoenn-emerald-progression.json')
    const state = { ...createCampaign('sexo-rivales'), phase: 'prepare' as const, encounterIndex: 0,
      members: [{ id: 'm', species: 'mew', level: 15, history: [], victories: 0, fainted: false }] }
    const { init } = beginCampaignBattle({ encounters, species }, state, { unlockedMoves: new Set(), movesByMember: { m: ['pound'] } }, ['m'])
    // Petra lleva Geodude, Geodude y Nosepass (50 % hembras): en Esmeralda, las tres hembras.
    expect(init.rival.map((set) => [set.species, set.gender])).toEqual(encounters[0].team.map((member) => [member.species, 'F']))
  })
})
