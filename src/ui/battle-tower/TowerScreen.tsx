import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AccountTower } from '../../cloud/campaign'
import type { EngineEnd } from '../../battle/protocol'
import type { BattleClient } from '../../battle/client'
import type { GameData } from '../../core/types'
import { finishTowerRound, newTowerRun, setTowerOrder, startTowerRound, towerBattleSeed, TOWER_ROUNDS, type TowerRun } from '../../core/battle-tower/tower'
import { es } from '../../i18n/es'
import { esTower as t } from '../../i18n/esTower'
import { browserStorage } from '../../storage/browserStorage'
import type { Decision } from '../../storage/gameStore'
import type { Settings } from '../../storage/settings'
import { LocalTowerStore, type TowerBattle, type TowerRecord } from '../../storage/towerStore'
import { BattleScreen } from '../battle/BattleScreen'
import { trainerSprite } from '../common/spriteUrls'
import { MemberIcon } from '../battle/party/MemberIcon'
import { TowerTeam } from './TowerTeam'
import { TowerVictory } from './TowerVictory'
import './tower.css'

type Props = {
  data: GameData
  playerName?: string
  createClient: () => BattleClient
  ai: TowerRun['ai']
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onExit: () => void
  cloud?: AccountTower
}

const subscribeNothing = () => () => {}
const noCloud = () => null

function readLocal(store: LocalTowerStore): { record: TowerRecord | null; error: string | null } {
  try { return { record: store.read(), error: null } }
  catch (error) { return { record: null, error: error instanceof Error ? error.message : t.saveError } }
}

export default function TowerScreen({ data, playerName, createClient, ai, settings, onSettingsChange, onExit, cloud }: Props) {
  const [local] = useState(() => new LocalTowerStore(browserStorage()))
  const [localState, setLocal] = useState(() => readLocal(local))
  const [entered, setEntered] = useState(null as string | null)
  const [replayFailed, setReplayFailed] = useState(false)
  const remote = useSyncExternalStore(cloud?.subscribe ?? subscribeNothing, cloud?.getState ?? noCloud)
  const record = cloud ? remote?.record ?? null : localState.record
  const run = record?.state
  const key = run && towerBattleSeed(run)
  const cloudStatus = remote?.status
  useEffect(() => {
    if (cloud && cloudStatus === 'closed') void cloud.load().catch(() => {})
  }, [cloud, cloudStatus])

  function write(state: TowerRun, battle: TowerBattle | null, revision: number) {
    if (cloud) {
      void cloud.write(state, battle, revision).catch(() => {})
      return
    }
    try { setLocal({ record: local.write(state, battle, revision), error: null }) }
    catch (error) {
      setLocal(previous => ({ ...previous, error: error instanceof Error ? error.message : t.saveError }))
    }
  }

  function current(): TowerRecord | null {
    try { return (cloud ?? local).read() }
    catch (error) {
      setLocal(previous => ({ ...previous, error: error instanceof Error ? error.message : t.saveError }))
      return null
    }
  }

  function beginSeries() {
    try { write(newTowerRun(crypto.randomUUID(), data, ai), null, record?.revision ?? 0) }
    catch { setLocal(previous => ({ ...previous, error: t.saveError })) }
  }

  function orderTeam(ids: readonly string[]) {
    const latest = current()
    if (!latest) return
    const ordered = setTowerOrder(latest.state, ids)
    if (ordered !== latest.state) write(ordered, null, latest.revision)
  }

  function beginRound() {
    const latest = current()
    if (!latest) return
    const state = latest.state
    setReplayFailed(false)
    if (state.phase !== 'battle') write(startTowerRound(state), { decisions: [] }, latest.revision)
    setEntered(towerBattleSeed(state))
  }

  function recordDecision(decision: Decision) {
    const latest = current()
    if (!latest?.battle || towerBattleSeed(latest.state) !== entered) return
    write(latest.state, { decisions: [...latest.battle.decisions, decision] }, latest.revision)
  }

  function finish(ended: EngineEnd) {
    const latest = current()
    if (!latest?.battle || towerBattleSeed(latest.state) !== entered) return
    write(finishTowerRound(latest.state, ended.result), null, latest.revision)
    setEntered(null)
  }

  const localError = cloud ? null : localState.error
  const cloudError = cloudStatus === 'offline' || cloudStatus === 'conflict' || cloudStatus === 'error'
  if (run?.phase === 'battle' && record?.battle && entered === key && !cloudError && !localError && !replayFailed) {
    return (
      <RoundBattle key={key} run={run} decisions={record.battle.decisions} createClient={createClient}
        data={data} playerName={playerName} settings={settings} onSettingsChange={onSettingsChange}
        paused={cloudStatus === 'saving'} onDecision={recordDecision} onFinish={finish}
        onReplayFailed={() => setReplayFailed(true)} onExit={onExit} />
    )
  }

  const finished = run?.phase === 'won' || run?.phase === 'lost'
  const loading = cloudStatus === 'closed' || cloudStatus === 'loading'
  const error = localError ?? (replayFailed ? t.replayError : cloudError ? remote?.message ?? t.saveError : null)
  const content = (() => {
    if (loading) { return <p role="status">{t.loading}</p> }
    if (error) { return (
      <div className="tower-card">
        <p role="alert">{error}</p>
        {cloudStatus === 'offline' && <button type="button" className="btn" onClick={() => void cloud?.retry().catch(() => {})}>{t.retry}</button>}
        {cloudStatus === 'conflict' && <button type="button" className="btn" onClick={() => void cloud?.reload().catch(() => {})}>{t.reload}</button>}
        {localError && <button type="button" className="btn" onClick={() => setLocal(readLocal(local))}>{t.reload}</button>}
        {replayFailed && <button type="button" className="btn" onClick={() => { setEntered(null); setReplayFailed(false) }}>{t.retry}</button>}
      </div>
    ) }
    // Serie ganada: la pantalla de victoria (maqueta aprobada el 17/11/2026); la derrota sigue con su tarjeta.
    if (run?.phase === 'won') {
      return <TowerVictory data={data} run={run} title={t.name} playerName={playerName} busy={cloudStatus === 'saving'} onNewSeries={beginSeries} onExit={onExit} />
    }
    if (!run || finished) { return (
      <div className="tower-card">
        {finished ? <><h2>{t.lost}</h2><p>{t.wins(run.index, TOWER_ROUNDS)}</p></> : <p>{t.hint}</p>}
        <button type="button" className="btn btn-primary" disabled={cloudStatus === 'saving'} onClick={beginSeries}>{t.newRun}</button>
      </div>
    ) }
    if (run.phase === 'prepare') {
      return <TowerTeam key={run.seed} title={t.name} data={data} run={run} onOrder={orderTeam} onStart={beginRound} onExit={onExit} />
    }
    return (
      <div className="tower-grid">
        <section className="tower-card">
          <h2>{t.team}</h2>
          {run.phase === 'between' && <p>{t.between}</p>}
          <ol className="tower-team" role="list">
            {run.team.map((member, index) => (
              <li key={member.species}>
                <span className="tower-slot" aria-hidden="true">{index + 1}</span>
                <MemberIcon spriteId={data.dex.species[member.species]?.spriteId ?? member.species} />
                <span>{member.nameEs}</span>

              </li>
            ))}
          </ol>
        </section>
        <section className="tower-card tower-rival">
          <h2>{t.round(run.index + 1, TOWER_ROUNDS)}</h2>
          <img src={trainerSprite(run.rivals[run.index].trainer.sprite)} alt="" width={144} height={144} />
          <p>{run.rivals[run.index].trainer.nameEs}</p>
          <button type="button" className="btn btn-primary" disabled={cloudStatus === 'saving'} onClick={beginRound}>
            {run.phase === 'battle' ? t.resume : t.continue}
          </button>
        </section>
      </div>
    )
  })()
  return (
    <div className="page tower-page">
      <a className="skip-link" href="#tower-main">{es.app.skipToContent}</a>
      <header className="today-header">
        <div className="today-header-inner">
          <div className="logo" translate="no"><span className="logo-ball" aria-hidden="true" /><span className="logo-text">{es.app.name}</span></div>
          <div className="header-actions"><button type="button" className="btn" onClick={onExit}>{t.back}</button></div>
        </div>
      </header>
      <main className="tower-main" id="tower-main">
        {run?.phase !== 'prepare' && run?.phase !== 'won' && <h1>{t.name}</h1>}
        {content}
      </main>
    </div>
  )
}

type RoundProps = Pick<Props, 'createClient' | 'data' | 'playerName' | 'settings' | 'onSettingsChange' | 'onExit'> & {
  run: TowerRun
  decisions: Decision[]
  paused: boolean
  onDecision: (decision: Decision) => void
  onFinish: (end: EngineEnd) => void
  onReplayFailed: () => void
}

function RoundBattle({ run, decisions, createClient, data, playerName, settings, onSettingsChange, paused, onDecision, onFinish, onReplayFailed, onExit }: RoundProps) {
  const [initial] = useState(() => ({
    client: createClient(),
    challenge: { ...run.rivals[run.index], playerTeam: run.team },
    replay: decisions.length ? { decisions, expected: null } : undefined,
  }))
  return (
    <BattleScreen client={initial.client} data={data} challenge={initial.challenge} replay={initial.replay}
      tower={{ round: run.index + 1, total: TOWER_ROUNDS }} battleSeed={towerBattleSeed(run)} playerLead={0}
      ai={run.ai} trainerName={playerName} initialSpeed={settings.speed} animations={settings.animations} sound={settings}
      onSpeedChange={(speed) => onSettingsChange({ ...settings, speed })} onSoundChange={(sound) => onSettingsChange({ ...settings, ...sound })}
      paused={paused} onDecision={onDecision} onFinish={onFinish} onExit={onExit} onReplayFailed={onReplayFailed} />
  )
}
