import { useEffect, useMemo, useRef, useState } from 'react'
import type { BattleClient } from '../../battle/client'
import { CloudError, type CloudApi, type LiveBattle } from '../../cloud/api'
import { getDailyChallenge } from '../../core/challenge'
import type { Challenge, GameData } from '../../core/types'
import { esReplay } from '../../i18n/esReplay'
import { LiveRecorder, type LiveSnapshot } from '../../replay/liveRecorder'
import type { ReplayData } from '../../replay/replayData'
import type { Settings, SoundPrefs } from '../../storage/settings'
import { Loading } from '../common/Loading'
import { ReplayViewer } from './ReplayViewer'
import './replay.css'

const text = esReplay.viewer
/** Cada cuánto se pide al servidor si hay turnos nuevos (el amigo los guarda al acabar cada turno). */
export const LIVE_POLL_MS = 4000

type LiveScreenProps = {
  nickname: string
  api: CloudApi
  data: GameData
  settings: Settings
  /** Botón «Sonido» del visor (Jose, 06/11/2026). */
  onSoundChange: (sound: SoundPrefs) => void
  createClient: () => BattleClient
  onExit: () => void
}

type Status = 'loading' | 'notAllowed' | 'void' | 'failed'

/**
 * Directo (RF-111c, DEC-80): el oficial de un amigo que ha aceptado, en el visor de repeticiones. Pide su combate cada `LIVE_POLL_MS`,
 * lo juega en el motor de aquí con sus decisiones (`LiveRecorder`) y deja de pedir al terminar.
 */
export function LiveScreen({ nickname, api, data, settings, onSoundChange, createClient, onExit }: LiveScreenProps) {
  const [status, setStatus] = useState('loading' as Status)
  const [start, setStart] = useState(null as { challenge: Challenge; seed: string; ai: ReplayData['ai']; leadIndex: number } | null)
  const [snapshot, setSnapshot] = useState(null as LiveSnapshot | null)
  const recorderRef = useRef(null as LiveRecorder | null)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const apply = (battle: LiveBattle) => {
      // Anulado (también a mitad: el amigo salió y caducó): se avisa en vez de esperar un turno que no llegará.
      if (battle.state === 'void') {
        setStatus('void')
        return false
      }
      if (!recorderRef.current) {
        const challenge = getDailyChallenge(battle.date, data)
        const begin = { challenge, seed: battle.seed, ai: battle.ai, leadIndex: battle.leadIndex }
        setStart(begin)
        recorderRef.current = new LiveRecorder(createClient(), begin, (next) => active && setSnapshot(next))
      }
      recorderRef.current.update(battle.decisions)
      return battle.state === 'live'
    }
    const poll = () => {
      api.liveBattle(nickname).then(
        (battle) => {
          if (!active) return
          if (apply(battle)) timer = setTimeout(poll, LIVE_POLL_MS)
        },
        (error) => {
          if (!active) return
          if (error instanceof CloudError && error.permanent) setStatus(error.code === 'live_not_allowed' ? 'notAllowed' : 'failed')
          // Un fallo de red: se vuelve a intentar.
          else timer = setTimeout(poll, LIVE_POLL_MS)
        },
      )
    }
    poll()
    return () => {
      active = false
      clearTimeout(timer)
      recorderRef.current?.stop()
      recorderRef.current = null
    }
  }, [api, nickname, data, createClient])

  const replay = useMemo(
    () =>
      start && snapshot && snapshot.steps.length > 0
        ? ({ version: 1, challenge: start.challenge, playerLead: start.leadIndex, battleSeed: start.seed, ai: start.ai, steps: snapshot.steps, ended: snapshot.ended } as ReplayData)
        : null,
    [start, snapshot],
  )

  const failed = status !== 'loading' || snapshot?.failed
  if (!replay || failed) {
    const message = status === 'notAllowed' ? text.liveNotAllowed : status === 'void' ? text.liveVoid(nickname) : failed ? text.liveFailed : null
    return (
      <main className="page-main replay-message">
        {message ? <p className="settings-hint" role="alert">{message}</p> : <Loading label={text.liveLoading} />}
        {message && <button type="button" className="btn btn-primary" onClick={onExit}>{text.toToday}</button>}
      </main>
    )
  }
  return <ReplayViewer replay={replay} data={data} settings={settings} onSoundChange={onSoundChange} onExit={onExit} own={false} live={{ nickname }} playerName={nickname} />
}
