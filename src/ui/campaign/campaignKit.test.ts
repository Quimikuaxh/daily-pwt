import { describe, expect, it } from 'vitest'
import { rulesOf } from '../../core/nuzlocke/rules'
import { hoennKit } from './campaignKit'
import { battleMusic, townMusic, resultMusic, EVOLUTION_MUSIC, EVOLVED_MUSIC, CREDITS_MUSIC, BATTLE_SFX_IDS } from './campaignMusic'
import manifest from '../../../data/audio.json'
import baseIndex from '../../generated/audio-index.json'
import { unovaKit } from '../campaign-unova/unovaKit'

// DEC-106: cada campaña aporta su kit; el recorrido de la pantalla es el mismo.
describe('kits de campaña', () => {
  it('Hoenn y Teselia traen sus encuentros, sus reglas y su definición', () => {
    expect(hoennKit.encounters).toHaveLength(13)
    expect(unovaKit.encounters.map((encounter) => encounter.id).slice(0, 2)).toEqual(['cheren', 'hiedra'])
    expect(rulesOf(hoennKit.definition)?.id).toBe('hoenn-emerald')
    expect(rulesOf(unovaKit.definition)?.id).toBe('unova-n2b2')
    expect(Object.keys(unovaKit.definition.species)).toHaveLength(649)
  })

  it('los rivales hablan con su género y los movimientos tienen descripción en su campaña', () => {
    const iris = unovaKit.encounters.at(-1)!
    expect(unovaKit.trainerOf(iris)).toEqual({ nameEs: 'Iris', category: 'champion', gender: 'F' })
    expect(hoennKit.trainerOf(hoennKit.encounters[0]).gender).toBe('F')
    expect(unovaKit.moveDescription('scald')).not.toBe('')
    expect(hoennKit.moveDescription('tackle')).not.toBe('')
  })

  it('Hoenn conserva todos sus temas, sus efectos y las fanfarrias', () => {
    for (const encounter of hoennKit.encounters) {
      expect(hoennKit.music.town(encounter.id)).toBe(townMusic(encounter.id))
      expect(hoennKit.music.battle(encounter.kind)).toBe(battleMusic(encounter.kind))
    }
    for (const mode of ['medal', 'beaten', 'hallOfFame', 'whiteout'] as const) expect(hoennKit.music.result(mode)).toBe(resultMusic(mode))
    expect([hoennKit.music.evolution, hoennKit.music.evolved, hoennKit.music.credits]).toEqual([EVOLUTION_MUSIC, EVOLVED_MUSIC, CREDITS_MUSIC])
    expect(hoennKit.sounds.battleIds).toEqual(BATTLE_SFX_IDS)
  })

  it('Teselia reparte sus nueve ciudades, los tres combates y los resultados sin temas de Esmeralda', () => {
    expect(unovaKit.encounters.map((encounter) => unovaKit.music.town(encounter.id))).toEqual([
      ...['aspertia', 'virbank', 'castelia', 'nimbasa', 'driftveil', 'mistralton', 'opelucid', 'humilau'].map((city) => `unova-town-${city}`),
      ...Array(5).fill('unova-town-league'),
    ])
    expect(['gym', 'elite', 'champion'].map((kind) => unovaKit.music.battle(kind as 'gym' | 'elite' | 'champion'))).toEqual(['gym-unova', 'unova-elite', 'champion-unova'])
    expect(['medal', 'beaten', 'hallOfFame', 'whiteout'].map((mode) => unovaKit.music.result(mode as 'medal' | 'beaten' | 'hallOfFame' | 'whiteout'))).toEqual(['unova-gym-victory', 'unova-gym-victory', 'unova-hall-of-fame', null])
    expect([unovaKit.music.evolution, unovaKit.music.evolved, unovaKit.music.credits]).toEqual(['unova-evolution', 'unova-evolved', 'unova-credits'])
    const tracks = manifest.music.filter((track) => track.id.startsWith('unova-'))
    expect(tracks).toHaveLength(15)
    expect(tracks.every((track) => ['ost-bw', 'ost-b2w2'].includes(track.source))).toBe(true)
    expect(tracks.find((track) => track.id === 'unova-evolved')?.file).toBe('Disc 1/39 - Congratulations! Your Pokémon Evolved!.flac')
    expect(Object.keys(baseIndex.music).some((id) => id.startsWith('unova-'))).toBe(false)
    expect(unovaKit.sounds.battleIds.some((id) => id.startsWith('emerald-'))).toBe(false)
    expect(unovaKit.sounds.sfxFor('hit-super')).toBe('hit-super')
    expect(unovaKit.sounds.sfxFor('ball-open')).toBeNull()
    expect(unovaKit.sounds.lowHealth).toBeNull()
    expect(unovaKit.sounds.moveSoundIds(['tackle'])).toEqual([])
  })
})
