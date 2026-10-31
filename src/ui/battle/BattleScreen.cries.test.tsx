import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { getAudio } from '../../audio/audio'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { settle } from '../../test-utils/ui'
import { BattleScreen } from './BattleScreen'

// UT-131 · Gritos (Jose, 31/10/2026): al salir cada Pokémon (intro y cambios) y, más graves, al debilitarse; precargados con el combate.
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-17', data)
const SIX = ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic']
const RSIX = ['snorlax', 'tyranitar', 'heatran', 'lapras', 'starmie', 'gyarados']
const view = (over: Parameters<typeof mkView>[0] = {}) => mkView({ player: SIX.map((s) => pMon(s, 150, 150)), rival: RSIX.map((s) => rMon(s)), ...over })
const spriteOf = (species: string) => data.dex.species[species]?.spriteId ?? species

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('gritos en combate (UT-131)', () => {
  it('se precargan los del combate; suenan los iniciales en la intro, el que entra en un cambio y, más grave, el que cae', async () => {
    const audio = getAudio()
    const cry = vi.spyOn(audio, 'playCry')
    const preload = vi.spyOn(audio, 'preload')
    const client = mockClient()
    const { unmount } = render(<BattleScreen client={client as never} data={data} challenge={challenge} playerLead={0} battleSeed="s" onFinish={vi.fn()} onExit={vi.fn()} />)
    expect(preload.mock.calls.at(-1)?.[2]).toEqual([...challenge.playerTeam, ...challenge.rivalTeam].map((set) => spriteOf(set.species)))
    client.emit(mkUpdate({ view: view() }))
    await settle(10_000)
    expect(cry.mock.calls).toEqual(expect.arrayContaining([[spriteOf('snorlax'), { faint: false }], [spriteOf('garchomp'), { faint: false }]]))

    cry.mockClear()
    client.emit(mkUpdate({ lines: ['|faint|p2a: Snorlax'], view: view({ rival: RSIX.map((s, i) => rMon(s, i === 0 ? 0 : 100)) }) }))
    await settle(8000)
    expect(cry).toHaveBeenCalledWith(spriteOf('snorlax'), { faint: true })

    cry.mockClear()
    client.emit(mkUpdate({ lines: ['|switch|p2a: Gyarados|Gyarados, L50, M|100/100'], view: view({ rival: RSIX.map((s, i) => rMon(s, i === 0 ? 0 : 100)), rActive: 5 }) }))
    await settle(8000)
    expect(cry).toHaveBeenCalledWith(spriteOf('gyarados'), { faint: false })
    unmount()
    cry.mockRestore()
    preload.mockRestore()
  })
})
