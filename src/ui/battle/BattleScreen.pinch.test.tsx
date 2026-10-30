import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { getAudio } from '../../audio/audio'
import { MUSIC_CHANGE_FADE_MS } from '../../audio/audioEngine'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { settle } from '../../test-utils/ui'
import { BattleScreen } from './BattleScreen'

// UT-121 · Música de vida baja (decisión de Jose, 30/10/2026): con el Pokémon del jugador en rojo suena ella en vez de la del rival.
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-17', data)
const SIX = ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic']
const RSIX = ['snorlax', 'tyranitar', 'heatran', 'lapras', 'starmie', 'gyarados']
const viewWith = (hp: number) => mkView({ player: SIX.map((s, i) => pMon(s, i === 0 ? hp : 150, 150)), rival: RSIX.map((s) => rMon(s)) })
/** El rival con los `standing` primeros debilitados (por defecto, todos menos el último) y en el campo `active`. */
const rivalDown = (active: number, standing = 5) => mkView({ player: SIX.map((s) => pMon(s, 150, 150)), rival: RSIX.map((s, i) => (i < standing ? rMon(s, 0) : rMon(s))), rActive: active })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('música de vida baja en combate (UT-121)', () => {
  it('en rojo la pide (tras bajar la barra); al curarse o al salir, la quita; otra vez en rojo, la vuelve a pedir', async () => {
    const pinch = vi.spyOn(getAudio(), 'setPinchMusic')
    const client = mockClient()
    const { unmount } = render(<BattleScreen client={client as never} data={data} challenge={challenge} playerLead={0} battleSeed="s" onFinish={vi.fn()} onExit={vi.fn()} />)
    client.emit(mkUpdate({ view: viewWith(150) }))
    await settle(8000)
    expect(pinch).not.toHaveBeenCalled()
    // A 20/150 (13 %): en rojo.
    client.emit(mkUpdate({ lines: ['|-damage|p1a: Garchomp|20/150'], view: viewWith(20) }))
    await settle(8000)
    expect(pinch).toHaveBeenLastCalledWith('critical-health')
    client.emit(mkUpdate({ lines: ['|-heal|p1a: Garchomp|150/150'], view: viewWith(150) }))
    await settle(8000)
    expect(pinch).toHaveBeenLastCalledWith(null)
    // Otra vez en rojo: se vuelve a pedir (el motor la empieza desde el principio).
    client.emit(mkUpdate({ lines: ['|-damage|p1a: Garchomp|10/150'], view: viewWith(10) }))
    await settle(8000)
    expect(pinch).toHaveBeenLastCalledWith('critical-health')
    expect(pinch.mock.calls.filter(([id]) => id === 'critical-health')).toHaveLength(2)
    unmount()
    expect(pinch).toHaveBeenLastCalledWith(null)
    pinch.mockRestore()
  })
})

// UT-122 · Tema del último Pokémon del rival (decisión de Jose, 30/10/2026).
describe('tema del último Pokémon del rival (UT-122)', () => {
  it('al salir su último Pokémon pide su tema con transición, sin parar la música; antes, el del rival', async () => {
    const audio = getAudio()
    const play = vi.spyOn(audio, 'playMusic')
    const stop = vi.spyOn(audio, 'stopMusic')
    const client = mockClient()
    const { unmount } = render(<BattleScreen client={client as never} data={data} challenge={challenge} playerLead={0} battleSeed="s" onFinish={vi.fn()} onExit={vi.fn()} />)
    client.emit(mkUpdate({ view: viewWith(150) }))
    await settle(8000)
    expect(play.mock.calls.at(-1)).toEqual([expect.stringMatching(/^(gym|champion|rival)-/), undefined])
    // Cae el penúltimo: aún no ha salido el último.
    client.emit(mkUpdate({ lines: ['|faint|p2a: Starmie'], view: rivalDown(4) }))
    await settle(8000)
    expect(play).not.toHaveBeenCalledWith('last-pokemon', expect.anything())
    // Sale el último.
    client.emit(mkUpdate({ lines: ['|switch|p2a: Gyarados|Gyarados, L50|100/100'], view: rivalDown(5) }))
    await settle(8000)
    expect(play).toHaveBeenLastCalledWith('last-pokemon', { crossfadeMs: MUSIC_CHANGE_FADE_MS })
    expect(stop).not.toHaveBeenCalled()
    unmount()
    expect(stop).toHaveBeenCalled()
    play.mockRestore()
    stop.mockRestore()
  })
})
