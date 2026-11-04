import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect, useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getDailyChallenge } from '../../core/challenge'
import { CloudError } from '../../cloud/api'
import type { ReplayData, ReplayStep } from '../../replay/replayData'
import { DEFAULT_SETTINGS } from '../../storage/settings'
import { makeGameData } from '../../test-utils/fixtures'
import { fakeApi } from '../../test-utils/cloud'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { settle } from '../../test-utils/ui'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { BattleScreen } from '../battle/BattleScreen'
import { FriendsPanel } from '../stats/FriendsPanel'
import { LiveScreen } from './LiveScreen'
import { ReplayViewer } from './ReplayViewer'

// UT-150 · Directo (RF-111c, DEC-80): el visor en directo, la pantalla que lo carga, la fila del amigo y el aviso a quien juega.
const data = makeGameData()
const challenge = getDailyChallenge('2026-11-04', data)
const SIX = ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic']
const RSIX = ['snorlax', 'tyranitar', 'heatran', 'lapras', 'starmie', 'gyarados']
const view = (turn: number, rivalHp = 100) => mkView({ turn, player: SIX.map((s) => pMon(s, 150, 150)), rival: RSIX.map((s, i) => (i === 0 ? rMon(s, rivalHp) : rMon(s))) }) as ReplayStep['view']
const ENDED = { result: 'win' as const, reason: 'faint' as const, turns: 2, playerAlive: 6, rivalFainted: 6, playerFainted: [false, false, false, false, false, false] }
const live = (steps: ReplayStep[], ended: ReplayData['ended'] = null): ReplayData => ({ version: 1, challenge, playerLead: 0, battleSeed: 's', ai: 'heuristic', steps, ended })
const first: ReplayStep[] = [{ lines: [], view: view(1) }, { lines: ['|turn|2'], view: view(2, 60) }]

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('directo (UT-150)', () => {
  it('el visor en directo: EN DIRECTO; al ponerse al día espera el turno del amigo; con los pasos nuevos sigue hasta el final', async () => {
    const { rerender } = render(<ReplayViewer replay={live(first)} data={data} settings={DEFAULT_SETTINGS} onExit={vi.fn()} own={false} live={{ nickname: 'Eva' }} playerName="Eva" />)
    for (let second = 0; second < 20 && !screen.queryByText('Esperando el turno de Eva…'); second++) await settle(1_000)
    expect(screen.getByTestId('battle-mode')).toHaveTextContent('EN DIRECTO')
    expect(screen.getByText('Esperando el turno de Eva…')).toBeInTheDocument()
    // El contador del equipo que se ve es el de Eva, no «Tú» (prueba de Jose, 04/11/2026).
    expect(screen.getByTestId('remaining-player')).toHaveTextContent(/^Eva/)
    rerender(<ReplayViewer replay={live([...first, { lines: ['|win|Jugador'], view: view(2, 0), ended: ENDED }], ENDED)} data={data} settings={DEFAULT_SETTINGS} onExit={vi.fn()} own={false} live={{ nickname: 'Eva' }} />)
    for (let second = 0; second < 20 && !screen.queryByText(/^Victoria/); second++) await settle(1_000)
    expect(screen.getByText(/^Victoria/)).toBeInTheDocument()
    expect(screen.getByTestId('battle-mode')).toHaveTextContent('REPETICIÓN')
  })

  it('sin permiso o con el combate anulado, lo dice y vuelve a Hoy', async () => {
    const onExit = vi.fn()
    const notAllowed = fakeApi({ liveBattle: async () => Promise.reject(new CloudError('live_not_allowed', true)) })
    const { unmount } = render(<LiveScreen nickname="Eva" api={notAllowed} data={data} settings={DEFAULT_SETTINGS} createClient={() => mockClient() as never} onExit={onExit} />)
    await settle(100)
    expect(screen.getByRole('alert')).toHaveTextContent('No tienes permiso para ver este combate.')
    unmount()
    render(<LiveScreen nickname="Eva" api={fakeApi()} data={data} settings={DEFAULT_SETTINGS} createClient={() => mockClient() as never} onExit={onExit} />)
    await settle(100)
    expect(screen.getByRole('alert')).toHaveTextContent('Eva no ha terminado su combate: se ha anulado.')
  })

  it('en curso: arranca su motor con su semilla e inicial y vuelve a pedir el combate cada pocos segundos', async () => {
    const client = mockClient()
    const api = fakeApi({ liveBattle: async () => ({ state: 'live', date: '2026-11-04', seed: 'semilla', ai: 'heuristic', leadIndex: 2, decisions: [], turn: 0 }) })
    render(<LiveScreen nickname="Eva" api={api} data={data} settings={DEFAULT_SETTINGS} createClient={() => client as never} onExit={vi.fn()} />)
    await settle(100)
    expect(client.init).toHaveBeenCalledWith(expect.objectContaining({ battleSeed: 'semilla', playerLead: 2, ai: 'heuristic' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000)
    })
    expect(api.liveBattle.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
})

describe('la fila del amigo que juega (UT-150)', () => {
  const friend = (live: 'pending' | 'accepted' | 'rejected' | null) => fakeApi({ listFriends: async () => [{ nickname: 'Eva', relation: 'friend', playing: true, live }] })

  it('«Jugando ahora»: pedirlo, esperar, volver a pedirlo tras un rechazo y, aceptado, verlo', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    const onWatchLive = vi.fn()
    const api = friend(null)
    const { unmount } = render(<FriendsPanel api={api} onWatchLive={onWatchLive} />)
    expect(await screen.findByText('Jugando ahora')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pedir a Eva ver su combate en directo' }))
    expect(api.requestLive).toHaveBeenCalledWith('Eva')
    unmount()
    const pending = render(<FriendsPanel api={friend('pending')} onWatchLive={onWatchLive} />)
    expect(await screen.findByText('Esperando a que acepte…')).toBeInTheDocument()
    pending.unmount()
    const rejected = render(<FriendsPanel api={friend('rejected')} onWatchLive={onWatchLive} />)
    expect(await screen.findByText('Ha rechazado la solicitud')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pedir a Eva ver su combate en directo' })).toHaveTextContent('Pedir otra vez')
    rejected.unmount()
    render(<FriendsPanel api={friend('accepted')} onWatchLive={onWatchLive} />)
    await user.click(await screen.findByRole('button', { name: 'Ver en directo el combate de Eva' }))
    expect(onWatchLive).toHaveBeenCalledWith('Eva')
  })
})

describe('la lista se vuelve a pedir mientras un amigo juega (UT-150)', () => {
  // Prueba de Jose (04/11/2026): Hoy se repinta cada segundo (cuenta atrás) y pasa `onWatchLive` nueva en cada render; el temporizador
  // de 5 s se borraba antes de dispararse y «Ver en directo» no salía hasta cerrar y abrir Amigos.
  it('aunque quien lo monta se repinte cada segundo con otra función, a los 5 s pide la lista otra vez', async () => {
    const api = fakeApi({ listFriends: async () => [{ nickname: 'Eva', relation: 'friend', playing: true, live: 'pending' }] })
    function Ticking() {
      const [tick, setTick] = useState(0)
      useEffect(() => {
        const timer = setInterval(() => setTick((value) => value + 1), 1000)
        return () => clearInterval(timer)
      }, [])
      return <FriendsPanel key="panel" api={api} onWatchLive={() => tick} />
    }
    render(<Ticking />)
    await settle(100)
    expect(api.listFriends).toHaveBeenCalledTimes(1)
    // Segundo a segundo, como en el navegador: cada tic repinta antes del siguiente.
    for (let second = 0; second < 6; second++) await settle(1_000)
    expect(api.listFriends.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

describe('el aviso a quien juega (UT-150)', () => {
  it('en el oficial, la solicitud sustituye a los contadores; aceptarla avisa al servidor y vuelve la fila con el ojo', async () => {
    const api = fakeApi({ liveInbox: vi.fn().mockResolvedValueOnce({ pending: ['Jose'], watching: 0 }).mockResolvedValue({ pending: [], watching: 1 }) })
    const client = mockClient()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BattleScreen client={client as never} data={data} challenge={challenge} playerLead={0} battleSeed="s" mode="official" liveApi={api} onFinish={vi.fn()} onExit={vi.fn()} />)
    client.emit(mkUpdate({ view: mkView({ player: SIX.map((s) => pMon(s, 150, 150)), rival: RSIX.map((s) => rMon(s)) }) }))
    await settle(1000)
    expect(screen.getByRole('alert')).toHaveTextContent('Jose quiere ver tu combate')
    expect(screen.queryByTestId('remaining-player')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(api.answerLiveRequest).toHaveBeenCalledWith('Jose', true)
    await settle(1000)
    expect(screen.getByTestId('remaining-player')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '1 amigo viendo tu combate' })).toBeInTheDocument()
  })

  it('en la práctica no se pregunta', async () => {
    const api = fakeApi()
    const client = mockClient()
    render(<BattleScreen client={client as never} data={data} challenge={challenge} playerLead={0} battleSeed="s" mode="practice" liveApi={api} onFinish={vi.fn()} onExit={vi.fn()} />)
    client.emit(mkUpdate({ view: mkView({ player: SIX.map((s) => pMon(s, 150, 150)), rival: RSIX.map((s) => rMon(s)) }) }))
    await settle(1000)
    expect(api.liveInbox).not.toHaveBeenCalled()
  })
})
