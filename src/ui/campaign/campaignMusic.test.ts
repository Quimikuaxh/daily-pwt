import { describe, expect, it } from 'vitest'
import audioIndex from '../../generated/audio-index.json'
import { battleMusic, EVOLUTION_MUSIC, resultMusic } from './campaignMusic'

// UT-190 · Música de la campaña de Hoenn: tema por rival, por resultado y de la evolución, todas en el índice de audio.
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
