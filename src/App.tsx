import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { newBattleSeed } from './battle/seed'
import type { Account, Cloud } from './cloud/account'
import { CONNECTING, DISABLED, OFFLINE } from './cloud/state'
import { recordingClient, type ReplayData, type ReplayStep } from './replay/replayData'
import type { BattleClient } from './battle/client'
import type { AiKind, EngineEnd } from './battle/protocol'
import { challengeFor } from './core/challenge'
import type { Challenge, GameData } from './core/types'
import type { ReplayPlan } from './hooks/useBattle'
import { useChallengeDay } from './hooks/useToday'
import { es } from './i18n/es'
import { LocalStorageStore } from './storage/localStorageStore'
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './storage/settings'
import type { MenuContext } from './ui/menu/AppMenu'
import type { BattleMode, DayRecord, GameStore, VoidReason } from './storage/gameStore'
import { readTestHooks } from './testHooks'
import { getAudio } from './audio/audio'
import { preloadBattleImages } from './ui/battle/preloadAssets'
import { ResultScreen } from './ui/result/ResultScreen'
import { TodayScreen } from './ui/today/TodayScreen'
import { useBattleScreen } from './ui/battle/battleScreenLoader'
import type { ReplaySource } from './ui/replay/ReplayScreen'
import type { HistoryArt } from './ui/replay/historyArt'
import type { HistoryItem } from './cloud/api'
import { REPLAY_PARAM, replayIdFrom, replayLink } from './ui/replay/replayLink'

// F5: el visor de repeticiones solo hace falta al abrir una (fuera de la ruta crítica, E2E-21).
const ReplayScreen = lazy(() => import('./ui/replay/replayModule').then((module) => ({ default: module.ReplayScreen })))

type AppProps = {
  data: GameData | null
  createClient: () => BattleClient
  /** Progreso guardado. Por defecto, `localStorage` (si el navegador no lo deja, en memoria). */
  store?: GameStore
  /** Supabase (F4, DEC-63), cargado aparte. Sin él (o `null`), solo local, como antes de F4. */
  cloud?: Promise<Cloud | null> | null
}

/** `recorded`: los pasos del oficial que ha visto la pantalla, para su repetición (F5). */
type Battle = { challenge: Challenge; leadIndex: number; seed: string; client: BattleClient; mode: BattleMode; ai: AiKind; replay?: ReplayPlan; recorded?: () => ReplayStep[] }

/** DEC-16: today -> battle -> result -> (today | battle), sin router. El combate conserva el reto con el que empezó. */
type Screen =
  | { name: 'today'; notice?: string }
  | { name: 'battle'; battle: Battle }
  // `replay`: la del oficial que acaba de terminar (F5, RF-135), y `replaySaved`, su envío (compartir espera a que llegue al servidor).
  | { name: 'result'; challenge: Challenge; leadIndex: number; ended: EngineEnd; mode: BattleMode; replay?: ReplayData; replaySaved?: Promise<void> }
  // `back`: a qué pantalla se vuelve (Resultado, si se abrió desde ella; si no, Hoy).
  | { name: 'replay'; source: ReplaySource; back?: Screen }

const noSubscription = () => () => {}

/**
 * Sprite del rival y equipo de un combate del historial (F5): el reto es determinista, así que sale de la fecha, el rival y la variante con
 * los datos del juego. Si los datos ya no dan ese reto (rival o variante retirados), `null` y el historial va sin dibujos.
 */
function historyArtFor(item: HistoryItem, data: GameData | null): HistoryArt | null {
  if (!data) return null
  try {
    const challenge = challengeFor({ date: item.date, trainerId: item.trainerId, variantId: item.variantId }, data)
    return { trainerSprite: challenge.trainer.sprite, team: challenge.playerTeam.map((member) => data.dex.species[member.species]?.spriteId ?? member.species) }
  } catch {
    return null
  }
}

/** Acceder a `localStorage` puede lanzar (cookies bloqueadas, modo privado): sin él el sitio funciona igual, sin guardar. */
function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export default function App({ data, createClient, store: injectedStore, cloud = null }: AppProps) {
  const [hooks] = useState(() => readTestHooks(window.location.search))
  // Fichero aparte, traído en reposo (E2E-21); si aún no ha llegado al empezar un combate, se pinta al llegar.
  const BattleScreen = useBattleScreen()
  const [localStore] = useState<GameStore>(() => injectedStore ?? new LocalStorageStore(browserStorage()))
  // La cuenta (F4) se carga aparte, solo con Supabase configurado (E2E-21); mientras tanto, todo local.
  const [account, setAccount] = useState(null as Account | null)
  const [accountFailed, setAccountFailed] = useState(false)
  const accountState = useSyncExternalStore(account?.subscribe ?? noSubscription, account?.getState ?? (() => (accountFailed ? OFFLINE : cloud ? CONNECTING : DISABLED)))
  // Con sesión de Google, la caché de la cuenta; si no, el historial de este navegador.
  const store = account && accountState.status === 'signedIn' ? account.store : localStore
  const [settings, setSettings] = useState<Settings>(() => loadSettings(browserStorage()))
  // Tras «Borrar datos locales» se vuelve a pintar: Hoy relee el historial (vacío) en cada render; Ajustes sigue abierto con su aviso.
  const [, setDataGeneration] = useState(0)
  // Un enlace compartido (`?replay=<id>`, RF-131) abre directamente su repetición.
  const [screen, setScreen] = useState<Screen>(() => {
    const id = replayIdFrom(window.location.search)
    return id ? { name: 'replay', source: { kind: 'shared', id } } : { name: 'today' }
  })
  const [battlesStarted, setBattlesStarted] = useState(0)
  const today = useChallengeDay(hooks.date)

  useEffect(() => preloadBattleImages(), [])
  // RF-80b: al abrir la web y a medianoche de Madrid, el oficial de un día anterior sin terminar pasa a derrota (en la cuenta lo cierra
  // también el servidor, `close_days`). Si se estaba jugando, se vuelve a Hoy, con el reto nuevo y el aviso.
  useEffect(() => {
    const finishedAt = new Date().toISOString()
    const expired = [...new Set([localStore, store])].flatMap((target) => target.expireOfficials(today, finishedAt))
    if (expired.length === 0) return
    const notice = es.today.official.expired(expired[expired.length - 1].challengeNumber)
    // El historial vive en `localStorage` (fuera de React): primero se cierra ahí y, solo si cerró algo (al abrir o a medianoche), se
    // cambia de pantalla. Un render más, una vez al día.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScreen((current) => {
      if (current.name === 'today') return { name: 'today', notice }
      const stale = current.name === 'battle' && current.battle.mode === 'official' && current.battle.challenge.date < today
      return stale ? { name: 'today', notice } : current
    })
  }, [today, store, localStore])
  useEffect(() => {
    if (!cloud) return
    let active = true
    import('./cloud/account').then(
      ({ Account }) => active && setAccount(new Account(cloud, browserStorage(), localStore)),
      () => active && setAccountFailed(true),
    )
    return () => {
      active = false
    }
  }, [cloud, localStore])
  useEffect(() => {
    if (!account) return
    // RF-96b: si la sesión de Google se perdió al abrir la web, se avisa en Hoy.
    void account.start().then(() => {
      if (account.sessionLost) setScreen((current) => (current.name === 'today' ? { name: 'today', notice: es.account.sessionLost } : current))
    })
    // Otro dispositivo pudo jugar mientras tanto; y lo que no se pudo enviar se reintenta al volver la conexión.
    const onVisible = () => document.visibilityState === 'visible' && void account.refresh()
    const onOnline = () => account.retry()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    // RF-98: el oficial de hoy ya estaba empezado en otro dispositivo; el de aquí no cuenta y Hoy enseña el de la cuenta.
    const offConflict = account.onConflict((date) =>
      setScreen((current) => (current.name === 'battle' && current.battle.mode === 'official' && current.battle.challenge.date === date ? { name: 'today', notice: es.today.official.otherDevice } : current)),
    )
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      offConflict()
    }
  }, [account])
  // Animaciones (Ajustes): la regla global de «reducir movimiento» de index.css solo se aplica con «Según el sistema»; «Siempre» la
  // anula y «Nunca» la fuerza.
  useEffect(() => {
    const motion = settings.animations === 'always' ? 'full' : settings.animations === 'never' ? 'reduced' : null
    if (motion) document.documentElement.dataset.motion = motion
    else delete document.documentElement.dataset.motion
  }, [settings.animations])
  // Volumen y silencio de Ajustes, al instante en lo que suene (DEC-57).
  useEffect(() => getAudio().configure({ volume: settings.volume, muted: !settings.sound }), [settings.volume, settings.sound])

  const nowIso = () => new Date().toISOString()

  function changeSettings(next: Settings) {
    setSettings(next)
    saveSettings(browserStorage(), next)
  }

  const menu: MenuContext = {
    trainerName: (trainerId) => data?.trainers.find((trainer) => trainer.id === trainerId)?.nameEs ?? trainerId,
    onWatchReplay: (date) => setScreen({ name: 'replay', source: { kind: 'mine', date } }),
    historyArt: (item) => historyArtFor(item, data),
    store,
    account: account ?? undefined,
    accountState,
    settings,
    onSettingsChange: changeSettings,
    onClearData: () => {
      // «Datos locales»: el historial de este navegador y, con sesión, la copia de la cuenta (se vuelve a bajar al recargar).
      localStore.clear()
      if (store !== localStore) store.clear()
      clearSettings(browserStorage())
      setSettings(DEFAULT_SETTINGS)
      setDataGeneration((generation) => generation + 1)
    },
  }

  /** Cliente del combate; el oficial, con la grabación para su repetición (F5, RF-120). */
  function battleClient(mode: BattleMode): Pick<Battle, 'client' | 'recorded'> {
    if (mode !== 'official') return { client: createClient() }
    const recording = recordingClient(createClient())
    return { client: recording.client, recorded: recording.steps }
  }

  function nextSeed(): string {
    const ordinal = battlesStarted + 1
    setBattlesStarted(ordinal)
    return hooks.seed ? (ordinal === 1 ? hooks.seed : `${hooks.seed}-${ordinal}`) : newBattleSeed()
  }

  function startBattle(challenge: Challenge, leadIndex: number, mode: BattleMode) {
    const seed = nextSeed()
    const ai: AiKind = hooks.ai ?? 'heuristic'
    if (mode === 'official') {
      const entry = {
        date: challenge.date,
        challengeNumber: challenge.number,
        trainerId: challenge.trainer.id,
        variantId: challenge.variant.id,
        dataVersion: challenge.dataVersion,
        startedAt: nowIso(),
        battle: { seed, ai, leadIndex },
      }
      const { record, created } = store.startOfficial(entry)
      // Un segundo intento (otra pestaña, doble clic) no abre otro combate: retoma el que hay o enseña el resultado.
      if (!created) return record.status === 'inProgress' ? resumeOfficial(record) : setScreen({ name: 'today' })
      account?.officialStarted(entry, { player: challenge.playerTeam.length, rival: challenge.rivalTeam.length })
    }
    setScreen({ name: 'battle', battle: { challenge, leadIndex, seed, ai, mode, ...battleClient(mode) } })
  }

  function abandonUnresumable(record: DayRecord, reason: VoidReason) {
    store.voidOfficial(record.date, reason, nowIso())
    account?.officialVoided(record.date, reason)
    setScreen({ name: 'today', notice: es.today.official.resumeFailed })
  }

  function resumeOfficial(record: DayRecord) {
    const saved = record.battle
    if (!data || !saved) return abandonUnresumable(record, 'corrupt')
    let challenge: Challenge
    try {
      challenge = challengeFor({ date: record.date, trainerId: record.trainerId, variantId: record.variantId }, data)
    } catch {
      return abandonUnresumable(record, 'dataChanged')
    }
    if (challenge.dataVersion !== record.dataVersion || saved.leadIndex >= challenge.playerTeam.length) return abandonUnresumable(record, 'dataChanged')
    const checkpoint = saved.checkpoint
    const expected = checkpoint && checkpoint.decisions === saved.decisions.length ? checkpoint : null
    setScreen({
      name: 'battle',
      battle: { challenge, leadIndex: saved.leadIndex, seed: saved.seed, ai: saved.ai, mode: 'official', ...battleClient('official'), replay: { decisions: saved.decisions, expected } },
    })
  }

  if (screen.name === 'replay' && data) {
    const leaveReplay = () => {
      // Al salir de un enlace compartido se quita `?replay=` de la dirección (recargar lleva a Hoy).
      const url = new URL(window.location.href)
      if (url.searchParams.has(REPLAY_PARAM)) {
        url.searchParams.delete(REPLAY_PARAM)
        window.history.replaceState(null, '', url)
      }
      setScreen(screen.back ?? { name: 'today' })
    }
    const ready = accountState.status !== 'connecting'
    return (
      <Suspense fallback={null}>
        <ReplayScreen source={screen.source} api={account?.api ?? null} ready={ready} data={data} settings={settings} onExit={leaveReplay} />
      </Suspense>
    )
  }

  // Aún descargándose (si se empieza a combatir antes de que llegue): nada, un instante, en vez de volver a pintar Hoy.
  if (screen.name === 'battle' && !BattleScreen) return null

  if (screen.name === 'battle' && BattleScreen) {
    const { battle } = screen
    const date = battle.challenge.date
    const official = battle.mode === 'official'
    return (
      // `BattleScreen` viene del cargador, pero es siempre el mismo componente (se fija una vez al llegar el fichero): no se crea en el render.
      // eslint-disable-next-line react-hooks/static-components
      <BattleScreen
        key={battle.seed}
        client={battle.client}
        data={data as GameData}
        challenge={battle.challenge}
        playerLead={battle.leadIndex}
        battleSeed={battle.seed}
        ai={battle.ai}
        mode={battle.mode}
        replay={battle.replay}
        onDecision={official ? (decision) => store.recordDecision(date, decision) : undefined}
        onSettled={
          official
            ? (state) => {
                const decisions = store.getDay(date)?.battle?.decisions ?? []
                store.recordCheckpoint(date, { ...state, decisions: decisions.length })
                account?.turnSettled(date, decisions, state)
              }
            : undefined
        }
        onReplayFailed={official ? () => abandonUnresumable(store.getDay(date) as DayRecord, 'replayFailed') : undefined}
        initialSpeed={settings.speed}
        animations={settings.animations}
        sound={settings}
        onSoundChange={(sound) => changeSettings({ ...settings, ...sound })}
        onSpeedChange={(speed) => changeSettings({ ...settings, speed })}
        onFinish={(ended) => {
          // El oficial cuenta para el día del reto con el que empezó, aunque termine pasada la medianoche (PRD §4.3).
          let replay: ReplayData | undefined
          let replaySaved: Promise<void> | undefined
          if (official) {
            const decisions = store.getDay(date)?.battle?.decisions ?? []
            store.finishOfficial(date, ended, nowIso())
            account?.officialFinished(date, ended, decisions)
            if (battle.recorded) {
              replay = { version: 1, challenge: battle.challenge, playerLead: battle.leadIndex, battleSeed: battle.seed, ai: battle.ai, steps: battle.recorded(), ended }
              const recorded = replay
              // La compresión se carga aparte (fuera de la ruta crítica, E2E-21).
              if (account) replaySaved = import('./replay/replayCodec').then(({ encodeReplay }) => encodeReplay(recorded)).then((data) => account.replayRecorded(date, data))
              replaySaved?.catch(() => {})
            }
          }
          setScreen({ name: 'result', challenge: battle.challenge, leadIndex: battle.leadIndex, ended, mode: battle.mode, replay, replaySaved })
        }}
        onExit={() => setScreen({ name: 'today' })}
      />
    )
  }

  if (screen.name === 'result') {
    const { challenge, leadIndex, ended, mode, replay, replaySaved } = screen
    const playing = accountState.status === 'guest' || accountState.status === 'signedIn'
    return (
      <ResultScreen
        replay={
          replay && {
            onWatch: () => setScreen({ name: 'replay', source: { kind: 'local', replay }, back: screen }),
            onShare:
              account && playing && replaySaved
                ? async () => {
                    await replaySaved
                    return replayLink(await account.shareReplay(challenge.date))
                  }
                : undefined,
          }
        }
        ended={ended}
        mode={mode}
        store={store}
        date={challenge.date}
        menu={menu}
        onBackToToday={() => setScreen({ name: 'today' })}
        onRematch={() => startBattle(challenge, leadIndex, 'practice')}
      />
    )
  }

  return (
    <TodayScreen
      data={data}
      menu={menu}
      store={store}
      notice={screen.name === 'today' ? screen.notice : undefined}
      onStart={startBattle}
      onResume={resumeOfficial}
      dateOverride={hooks.date}
      rivalOverride={hooks.trainer ? { trainerId: hooks.trainer, variantId: hooks.variant } : undefined}
    />
  )
}
