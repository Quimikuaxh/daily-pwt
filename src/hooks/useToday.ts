import { useEffect, useMemo, useState } from 'react'
import { challengeFor, getDailyChallenge } from '../core/challenge'
import { challengeDate, msUntilNextChallenge } from '../core/date'
import type { Challenge, GameData } from '../core/types'
import { es } from '../i18n/es'

export type TodayState = {
  challenge: Challenge | null
  /** hh:mm:ss hasta la próxima medianoche de Madrid (las horas pueden ser 23 o 25 en los cambios de hora). */
  countdown: string
  error: string | null
}

const MS_PER_SECOND = 1000
const pad = (value: number): string => String(value).padStart(2, '0')

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / MS_PER_SECOND))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${pad(hours)}:${pad(minutes)}:${pad(totalSeconds % 60)}`
}

/** Reloj en vivo: se actualiza cada segundo, alineado con el cambio de segundo de la cuenta atrás. Un único temporizador. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const scheduleNextTick = () => {
      const current = new Date()
      setNow(current)
      const untilNextSecond = msUntilNextChallenge(current) % MS_PER_SECOND
      timer = setTimeout(scheduleNextTick, untilNextSecond === 0 ? MS_PER_SECOND : untilNextSecond)
    }
    const first = new Date()
    timer = setTimeout(scheduleNextTick, msUntilNextChallenge(first) % MS_PER_SECOND || MS_PER_SECOND)
    return () => clearTimeout(timer)
  }, [])

  return now
}

/** Rival y variante forzados por id (ganchos de prueba, DEC-17): se saltan la bolsa. */
export type RivalOverride = { trainerId: string; variantId?: string }

function buildChallenge(date: string, data: GameData | null, rival?: RivalOverride): { challenge: Challenge | null; error: string | null } {
  try {
    const challenge = rival ? challengeFor({ date, ...rival }, data as GameData) : getDailyChallenge(date, data as GameData)
    return { challenge, error: null }
  } catch {
    // El detalle técnico no se enseña (RNF-05): cualquier fallo del generador es un problema de datos para el usuario.
    return { challenge: null, error: es.today.dataError }
  }
}

/** Reto de la fecha de Madrid (RF-01) y cuenta atrás hasta el siguiente (RF-30/31). */
export function useToday(data: GameData | null, dateOverride?: string, rivalOverride?: RivalOverride): TodayState {
  const now = useNow()
  const date = dateOverride ?? challengeDate(now)
  const trainerId = rivalOverride?.trainerId
  const variantId = rivalOverride?.variantId
  const { challenge, error } = useMemo(
    () => buildChallenge(date, data, trainerId === undefined ? undefined : { trainerId, variantId }),
    [date, data, trainerId, variantId],
  )
  return { challenge, countdown: formatCountdown(msUntilNextChallenge(now)), error }
}

/**
 * Fecha del reto de Madrid que cambia sola a medianoche (RF-80b), con un temporizador hasta entonces (no uno por segundo, como `useNow`).
 * Con `override` (ganchos de prueba, `?date=`), esa fecha fija.
 */
export function useChallengeDay(override?: string): string {
  const [date, setDate] = useState(() => challengeDate(new Date()))
  useEffect(() => {
    if (override !== undefined) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const now = new Date()
      setDate(challengeDate(now))
      // Un poco después de la medianoche, para caer ya en el día nuevo.
      timer = setTimeout(schedule, msUntilNextChallenge(now) + 50)
    }
    timer = setTimeout(schedule, msUntilNextChallenge(new Date()) + 50)
    return () => clearTimeout(timer)
  }, [override])
  return override ?? date
}

/** Solo la cuenta atrás hasta la próxima medianoche de Madrid (Resultado, PRD §10.3). */
export function useCountdown(): string {
  return formatCountdown(msUntilNextChallenge(useNow()))
}
