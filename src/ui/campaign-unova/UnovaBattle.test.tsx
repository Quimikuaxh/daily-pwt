import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { loadGameData } from '../../data/gameData'
import { UnovaBattle } from './UnovaBattle'
import { unovaKit } from './unovaKit'
import { hoennKit } from '../campaign/campaignKit'
import { EmeraldBattle, type CampaignBattleProps } from '../campaign/EmeraldBattle'
import type { CampaignPresentation } from '../battle/BattleScreen'

const captured = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }))
vi.mock('../battle/BattleScreen', () => ({ BattleScreen: (props: Record<string, unknown>) => { captured.current = props; return null } }))

// UT-235 · Kit y adaptador de combate de Teselia: sesión, presentación y audio independientes de Hoenn.
describe('combate de Teselia', () => {
  it('cada kit selecciona su pantalla', () => {
    expect(hoennKit.screens.Battle).toBe(EmeraldBattle)
    expect(unovaKit.screens.Battle).toBe(UnovaBattle)
  })

  it.each(['gym', 'elite', 'champion'] as const)('conecta sesión y audio de Teselia (%s), con niveles reales y reanudación', (kind) => {
    const data = loadGameData()
    const sounds = { ...unovaKit.sounds, playSfx: vi.fn(), preloadSfx: vi.fn(), playCry: vi.fn(), preloadCries: vi.fn() }
    const session = { choose: vi.fn(), forfeit: vi.fn(), subscribe: vi.fn(() => () => {}) }
    const set = { nameEs: 'Lillipup', species: 'lillipup', level: 13, moves: ['tackle'], item: '', ability: 'vitalspirit', nature: 'Serious',
      ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 }, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } }
    const start = vi.fn(), onEnded = vi.fn(), onRetry = vi.fn(), registerMusic = vi.fn()
    render(<UnovaBattle session={session as unknown as CampaignBattleProps['session']} start={start} onEnded={onEnded} onRetry={onRetry}
      data={data} trainer={unovaKit.trainerOf(unovaKit.encounters[0])} trainerId="cheren" protagonist="may" playerName="Rosa" resumed
      intro={{ rivalLead: 'Lillipup', playerLead: 'Lillipup' }} music={unovaKit.music.battle(kind)} registerMusic={registerMusic} sounds={sounds}
      sides={{ sets: () => ({ player: [set], rival: [set] }), typesOf: () => ['Normal'], trainer: 'cheren' }} rivalLevels={[13]} playerLevels={{ lillipup: 13 }} />)
    const props = captured.current!
    const presentation = props.campaign as CampaignPresentation
    expect(presentation.resumed).toBe(true)
    expect(presentation.avatar?.id).toBe('rosa')
    expect(props.trainerName).toBe('Rosa')
    expect(presentation.onRetry).toBe(onRetry)
    expect(presentation.music).toBe(kind === 'gym' ? 'gym-unova' : kind === 'elite' ? 'unova-elite' : 'champion-unova')
    presentation.registerMusic?.()
    expect(registerMusic).toHaveBeenCalledOnce()
    presentation.preload(['lillipup'])
    presentation.playSfx('hit-super')
    presentation.playSfx('ball-open')
    presentation.playCry('lillipup', true)
    expect(sounds.preloadSfx).toHaveBeenCalledWith(unovaKit.sounds.battleIds)
    expect(sounds.preloadCries).toHaveBeenCalledWith(['lillipup'])
    expect(sounds.playSfx.mock.calls.flat().some((id) => String(id).startsWith('emerald-'))).toBe(false)
    expect(sounds.playSfx).toHaveBeenCalledWith('ball-open')
    expect(sounds.playCry).toHaveBeenCalledWith('lillipup', true)
    presentation.playCry('landorustherian', false)
    expect(sounds.playCry).toHaveBeenCalledWith('landorus-therian', false)
    const client = props.client as ReturnType<typeof import('../campaign/campaignBattle').sessionBattleClient>
    client.init(null as never)
    expect(start).toHaveBeenCalledOnce()
    client.choose({ type: 'move', slot: 1 })
    expect(session.choose).toHaveBeenCalledWith({ type: 'move', slot: 1 })
    // Cambio de requisito (15/11/2026, como en Hoenn): salir no rinde la campaña; el botón de abajo es HUIR y solo avisa.
    const exit = props.onExit as () => void
    exit()
    expect(session.forfeit).not.toHaveBeenCalled()
    expect(presentation).toMatchObject({ runLabel: 'HUIR', noRun: '¡No puedes huir de un combate contra un entrenador!' })
    expect(props.onFinish).toBe(onEnded)
    expect(props.challenge).toMatchObject({ trainer: { sprite: 'cheren' }, playerTeam: [{ level: 13, moves: ['tackle'] }] })
  })
})
