import { useEffect, useId, useState } from 'react'
import type { CloudApi } from '../../cloud/api'
import { isPlayer, type AccountState } from '../../cloud/state'
import { useToday, type RivalOverride } from '../../hooks/useToday'
import type { Challenge, GameData } from '../../core/types'
import type { BattleMode, DayRecord, GameStore } from '../../storage/gameStore'
import { es } from '../../i18n/es'
import { PlayerCard } from './PlayerCard'
import { usePreloadChallengeSprites } from '../battle/preloadAssets'
import { RivalSection, type DayWins } from './RivalSection'
import { TodayFooter } from './TodayFooter'
import { TodayHeader } from './TodayHeader'
import type { MenuContext } from '../menu/AppMenu'

type TodayScreenProps = {
  data: GameData | null
  onStart: (challenge: Challenge, leadIndex: number, mode: BattleMode) => void
  /** Reanuda el oficial de hoy en curso (los de días anteriores ya son derrota, RF-80b). */
  onResume?: (record: DayRecord) => void
  /** Progreso guardado: de él sale el estado del botón oficial. Sin él, nada está jugado. */
  store?: GameStore
  /** Aviso en español que deja la pantalla anterior (p. ej. un oficial que no se pudo reanudar). */
  notice?: string | null
  /** Estadísticas, Ayuda y Ajustes de la cabecera. */
  menu?: MenuContext
  /** Solo con los ganchos de prueba (?date=). */
  dateOverride?: string
  /** Solo con los ganchos de prueba (?trainer=&variant=). */
  rivalOverride?: RivalOverride
}

type TodayContentProps = {
  challenge: Challenge
  data: GameData
  onStart: TodayScreenProps['onStart']
  onResume?: TodayScreenProps['onResume']
  store?: GameStore
  dayWins?: DayWins
}

/**
 * «Victorias: X/Y» del día bajo el rival (decisión de Jose, 29/10/2026). Solo con la cuenta abierta o abriéndose: sin servicio (o sin
 * Supabase configurado) no se enseña. Se pide al entrar en Hoy, también al volver de un combate.
 */
function useDayWins(api: CloudApi | null, date: string, state: AccountState | undefined): DayWins {
  const [loaded, setLoaded] = useState(null as { date: string; wins: number; players: number } | null)
  useEffect(() => {
    if (!api || !date) return
    let active = true
    api.dayWins(date).then(
      (result) => active && setLoaded({ date, ...result }),
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [api, date])
  if (!state || !(isPlayer(state) || state.status === 'connecting')) return undefined
  return loaded?.date === date ? { wins: loaded.wins, players: loaded.players } : null
}

function officialStatusText(record: DayRecord | null): string {
  if (record === null) return es.today.official.play
  if (record.status === 'inProgress') return es.today.official.resume
  if (record.status === 'void') return es.today.official.void
  const result = record.status === 'won' ? es.today.official.won : es.today.official.lost
  return result(record.turns ?? 0, record.survivors ?? 0)
}

function TodayContent({ challenge, data, onStart, onResume, store, dayWins }: TodayContentProps) {
  usePreloadChallengeSprites(challenge, data)
  const playerHeadingId = useId()
  const hintId = useId()
  const [leadIndex, setLeadIndex] = useState(null as number | null)
  const canFight = leadIndex !== null
  const day = store?.getDay(challenge.date) ?? null
  const officialInProgress = day?.status === 'inProgress'
  const officialDone = day !== null && !officialInProgress
  const officialDisabled = officialDone || (!officialInProgress && !canFight)

  return (
    <>
      <RivalSection challenge={challenge} data={data} dayWins={dayWins} />

      <section aria-labelledby={playerHeadingId} className="panel">
        <h2 id={playerHeadingId} className="section-title">{es.today.playerSection}</h2>
        <p className="section-hint">{es.today.playerSectionHint}</p>
        <div className="player-grid">
          {challenge.playerTeam.map((set, index) => (
            <PlayerCard key={`${set.species}-${index}`} set={set} data={data} isLead={leadIndex === index} onChooseLead={() => setLeadIndex(index)} />
          ))}
        </div>
      </section>

      <div className="fight-bar">
        <div className="fight-buttons">
          <button
            type="button"
            className="btn btn-primary btn-fight btn-official"
            data-official-state={day === null ? 'play' : day.status}
            disabled={officialDisabled}
            aria-describedby={officialDisabled && !officialDone ? hintId : undefined}
            onClick={() => {
              if (officialInProgress && day && onResume) onResume(day)
              else if (leadIndex !== null) onStart(challenge, leadIndex, 'official')
            }}
          >
            <span className="btn-fight-title">{es.today.officialFight}</span>
            <span className="btn-fight-status" data-testid="official-status">{officialStatusText(day)}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-fight btn-practice"
            disabled={!canFight}
            aria-describedby={canFight ? undefined : hintId}
            onClick={() => leadIndex !== null && onStart(challenge, leadIndex, 'practice')}
          >
            {es.today.practiceFight}
          </button>
        </div>
        {!canFight && !officialInProgress && <p id={hintId} className="fight-hint">{es.today.fightHint}</p>}
        {officialDone && <p className="fight-hint">{es.today.official.doneHint}</p>}
        {officialInProgress && <p className="fight-hint">{es.today.official.resumeHint}</p>}
        {store && !store.persistent && <p className="fight-hint" role="status">{es.today.official.notSaved}</p>}
      </div>
    </>
  )
}

export function TodayScreen({ data, onStart, onResume, store, notice, menu, dateOverride, rivalOverride }: TodayScreenProps) {
  const { challenge, countdown, error } = useToday(data, dateOverride, rivalOverride)
  const dayWins = useDayWins(menu?.account?.api ?? null, challenge?.date ?? '', menu?.accountState)
  return (
    <div className="page">
      <a href="#main" className="skip-link">{es.app.skipToContent}</a>
      <TodayHeader challengeNumber={challenge?.number ?? null} countdown={countdown} menu={menu} date={challenge?.date} />
      <main id="main" tabIndex={-1} className="page-main">
        {notice && <p role="alert" className="alert">{notice}</p>}
        {challenge && data ? (
          <TodayContent key={challenge.date} challenge={challenge} data={data} onStart={onStart} onResume={onResume} store={store} dayWins={dayWins} />
        ) : (
          <p role="alert" className="alert">{error ?? es.today.dataError}</p>
        )}
      </main>
      <TodayFooter />
    </div>
  )
}
