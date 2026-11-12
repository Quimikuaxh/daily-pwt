import { describe, expect, it } from 'vitest'
import audioIndex from '../../generated/audio-index.json'
import { BATTLE_SFX_IDS, battleMusic, emeraldSfxFor, EVOLUTION_MUSIC, EVOLUTION_SFX_IDS, resultMusic } from './campaignMusic'
import { EVOLUTION_PHASES, evolutionSound } from './evolutionModel'

// UT-190 · Música y efectos de la campaña de Hoenn: tema por rival, por resultado y de la evolución, efectos de Esmeralda, todos en el índice de audio.
const music = audioIndex.music as Record<string, { loopStartSec?: number }>

describe('música de la campaña', () => {
  it('combate: líder, Alto Mando y campeón, con bucle', () => {
    expect([battleMusic('gym'), battleMusic('elite'), battleMusic('champion')]).toEqual(['emerald-gym', 'emerald-elite', 'emerald-champion'])
    for (const id of ['emerald-gym', 'emerald-elite', 'emerald-champion', EVOLUTION_MUSIC]) expect(music[id]?.loopStartSec).toBeGreaterThan(0)
  })

  it('resultado: victoria contra líder, victoria de la Liga, Salón de la Fama y nada al perder', () => {
    expect(resultMusic('medal')).toBe('emerald-gym-victory')
    expect(resultMusic('beaten')).toBe('emerald-league-victory')
    expect(resultMusic('hallOfFame')).toBe('emerald-hall-of-fame')
    expect(resultMusic('whiteout')).toBeNull()
    for (const id of ['emerald-gym-victory', 'emerald-league-victory', 'emerald-hall-of-fame']) expect(music[id]).toBeDefined()
  })
})

describe('efectos de la campaña', () => {
  const sfx = audioIndex.sfx as Record<string, unknown>
  it('los del combate son los de Esmeralda; los de estado y la baya no suenan', () => {
    expect(emeraldSfxFor('hit-super')).toBe('emerald-hit-super')
    expect(emeraldSfxFor('menu-cancel')).toBe('emerald-select')
    expect(emeraldSfxFor('status-slp')).toBeNull()
    expect(emeraldSfxFor('berry')).toBeNull()
    for (const id of [...BATTLE_SFX_IDS, ...EVOLUTION_SFX_IDS]) expect(sfx[id], id).toBeDefined()
  })

  it('la evolución suena al empezar cada fase de destellos y calla durante las siluetas', () => {
    expect(evolutionSound(0)).toBe('emerald-evo-spiral')
    expect(evolutionSound(EVOLUTION_PHASES.arc)).toBe('emerald-evo-arc')
    expect(evolutionSound(EVOLUTION_PHASES.cycle)).toBeNull()
    expect(evolutionSound(EVOLUTION_PHASES.circle)).toBe('emerald-evo-circle')
    expect(evolutionSound(EVOLUTION_PHASES.spray)).toBe('emerald-evo-spray')
  })
})
