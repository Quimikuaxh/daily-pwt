import { useEffect, useState } from 'react'
import { newBattleSeed } from './battle/seed'
import type { BattleClient } from './battle/client'
import type { AiKind, EngineEnd } from './battle/protocol'
import { challengeFor } from './core/challenge'
import type { Challenge, GameData } from './core/types'
import type { ReplayPlan } from './hooks/useBattle'
import { es } from './i18n/es'
import { LocalStorageStore } from './storage/localStorageStore'
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './storage/settings'
import type { MenuContext } from './ui/menu/AppMenu'
import type { BattleMode, DayRecord, GameStore, VoidReason } from './storage/gameStore'
import { readTestHooks } from './testHooks'
import { BattleScreen } from './ui/battle/BattleScreen'
import { preloadBattleImages } from './ui/battle/preloadAssets'
import { ResultScreen } from './ui/result/ResultScreen'
import { TodayScreen } from './ui/today/TodayScreen'

type AppProps = {
  data: GameData | null
  createClient: () => BattleClient
  /** Progreso guardado. Por defecto, `localStorage` (si el navegador no lo deja, en memoria). */
  store?: GameStore
}

type Battle = { challenge: Challenge; leadIndex: number; seed: string; client: BattleClient; mode: BattleMode; ai: AiKind; replay?: ReplayPlan }

/** DEC-16: today -> battle -> result -> (today | battle), sin router. El combate conserva el reto con el que empezó. */
type Screen =
  | { name: 'today'; notice?: string }
  | { name: 'battle'; battle: Battle }
  | { name: 'result'; challenge: Challenge; leadIndex: number; ended: EngineEnd; mode: BattleMode }

/** Acceder a `localStorage` puede lanzar (cookies bloqueadas, modo privado): sin él el sitio funciona igual, sin guardar. */
function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export default function App({ data, createClient, store: injectedStore }: AppProps) {
  const [hooks] = useState(() => readTestHooks(window.location.search))
  const [store] = useState<GameStore>(() => injectedStore ?? new LocalStorageStore(browserStorage()))
  const [settings, setSettings] = useState<Settings>(() => loadSettings(browserStorage()))
  // Tras «Borrar datos locales» se vuelve a pintar: Hoy relee el historial (vacío) en cada render; Ajustes sigue abierto con su aviso.
  const [, setDataGeneration] = useState(0)
  const [screen, setScreen] = useState<Screen>({ name: 'today' })
  const [battlesStarted, setBattlesStarted] = useState(0)

  useEffect(() => preloadBattleImages(), [])

  const nowIso = () => new Date().toISOString()

  function changeSettings(next: Settings) {
    setSettings(next)
    saveSettings(browserStorage(), next)
  }

  const menu: MenuContext = {
    store,
    settings,
    onSettingsChange: changeSettings,
    onClearData: () => {
      store.clear()
      clearSettings(browserStorage())
      setSettings(DEFAULT_SETTINGS)
      setDataGeneration((generation) => generation + 1)
    },
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
      const { record, created } = store.startOfficial({
        date: challenge.date,
        challengeNumber: challenge.number,
        trainerId: challenge.trainer.id,
        variantId: challenge.variant.id,
        dataVersion: challenge.dataVersion,
        startedAt: nowIso(),
        battle: { seed, ai, leadIndex },
      })
      // Un segundo intento (otra pestaña, doble clic) no abre otro combate: retoma el que hay o enseña el resultado.
      if (!created) return record.status === 'inProgress' ? resumeOfficial(record) : setScreen({ name: 'today' })
    }
    setScreen({ name: 'battle', battle: { challenge, leadIndex, seed, ai, mode, client: createClient() } })
  }

  function abandonUnresumable(record: DayRecord, reason: VoidReason) {
    store.voidOfficial(record.date, reason, nowIso())
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
      battle: { challenge, leadIndex: saved.leadIndex, seed: saved.seed, ai: saved.ai, mode: 'official', client: createClient(), replay: { decisions: saved.decisions, expected } },
    })
  }

  if (screen.name === 'battle') {
    const { battle } = screen
    const date = battle.challenge.date
    const official = battle.mode === 'official'
    return (
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
        onSettled={official ? (state) => store.recordCheckpoint(date, { ...state, decisions: store.getDay(date)?.battle?.decisions.length ?? 0 }) : undefined}
        onReplayFailed={official ? () => abandonUnresumable(store.getDay(date) as DayRecord, 'replayFailed') : undefined}
        initialSpeed={settings.speed}
        moveAnimations={settings.moveAnimations}
        onSpeedChange={(speed) => changeSettings({ ...settings, speed })}
        onFinish={(ended) => {
          // El oficial cuenta para el día del reto con el que empezó, aunque termine pasada la medianoche (PRD §4.3).
          if (official) store.finishOfficial(date, ended, nowIso())
          setScreen({ name: 'result', challenge: battle.challenge, leadIndex: battle.leadIndex, ended, mode: battle.mode })
        }}
        onExit={() => setScreen({ name: 'today' })}
      />
    )
  }

  if (screen.name === 'result') {
    const { challenge, leadIndex, ended, mode } = screen
    return (
      <ResultScreen
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
      notice={screen.notice}
      onStart={startBattle}
      onResume={resumeOfficial}
      dateOverride={hooks.date}
      rivalOverride={hooks.trainer ? { trainerId: hooks.trainer, variantId: hooks.variant } : undefined}
    />
  )
}
