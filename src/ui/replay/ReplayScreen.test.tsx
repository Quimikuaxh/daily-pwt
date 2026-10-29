import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getDailyChallenge } from '../../core/challenge'
import { encodeReplay } from '../../replay/replayCodec'
import type { ReplayData, ReplayStep } from '../../replay/replayData'
import { DEFAULT_SETTINGS } from '../../storage/settings'
import { fakeApi, serverError } from '../../test-utils/cloud'
import { makeGameData } from '../../test-utils/fixtures'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { ReplayScreen } from './ReplayScreen'

// UT-119 · Repetición de un amigo desde su historial (decisión de Jose, 29/10/2026).
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-29', data)
const view = mkView({ turn: 1, player: ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic'].map((s) => pMon(s, 150, 150)), rival: ['snorlax', 'tyranitar', 'heatran', 'lapras', 'starmie', 'gyarados'].map((s) => rMon(s)) }) as ReplayStep['view']
const replay: ReplayData = { version: 1, challenge, playerLead: 0, battleSeed: 's', ai: 'heuristic', steps: [{ lines: [], view }], ended: null }

describe('repetición de un amigo (UT-119)', () => {
  it('se pide al servidor con su nickname y su fecha, y el botón de su equipo dice «Equipo»', async () => {
    const api = fakeApi({ getFriendReplay: async () => encodeReplay(replay) })
    render(<ReplayScreen source={{ kind: 'friend', nickname: 'Eva', date: '2026-10-26' }} api={api} ready data={data} settings={DEFAULT_SETTINGS} onExit={vi.fn()} />)
    expect(await screen.findByTestId('battle-mode')).toHaveAttribute('data-mode', 'replay')
    expect(api.getFriendReplay).toHaveBeenCalledWith('Eva', '2026-10-26')
    expect(screen.getByRole('button', { name: 'Equipo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar enlace' })).toBeNull()
  })

  it('si ya no es amigo, el aviso de que no se ha podido cargar', async () => {
    const api = fakeApi({ getFriendReplay: async () => Promise.reject(serverError('not_friends')) })
    render(<ReplayScreen source={{ kind: 'friend', nickname: 'Eva', date: '2026-10-26' }} api={api} ready data={data} settings={DEFAULT_SETTINGS} onExit={vi.fn()} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
