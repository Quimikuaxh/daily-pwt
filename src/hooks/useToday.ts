import { useEffect, useMemo, useState } from 'react'
import { challengeFor, getDailyChallenge } from '../core/challenge'
import { localDate, msUntilNextLocalMidnight } from '../core/date'
import type { Challenge, GameData } from '../core/types'
import { es } from '../i18n/es'

export type TodayState = {
  challenge: Challenge | null
  /** hh:mm:ss hasta la próxima medianoche local (las horas pueden ser 23 o 25 en los cambios de hora). */
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
      const untilNextSecond = msUntilNextLocalMidnight(current) % MS_PER_SECOND
      timer = setTimeout(scheduleNextTick, untilNextSecond === 0 ? MS_PER_SECOND : untilNextSecond)
    }
    const first = new Date()
    timer = setTimeout(scheduleNextTick, msUntilNextLocalMidnight(first) % MS_PER_SECOND || MS_PER_SECOND)
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

/** Reto de la fecha local del dispositivo (RF-01) y cuenta atrás hasta el siguiente (RF-30/31). */
export function useToday(data: GameData | null, dateOverride?: string, rivalOverride?: RivalOverride): TodayState {
  const now = useNow()
  const date = dateOverride ?? localDate(now)
  const trainerId = rivalOverride?.trainerId
  const variantId = rivalOverride?.variantId
  const { challenge, error } = useMemo(
    () => buildChallenge(date, data, trainerId === undefined ? undefined : { trainerId, variantId }),
    [date, data, trainerId, variantId],
  )
  return { challenge, countdown: formatCountdown(msUntilNextLocalMidnight(now)), error }
}

/** Solo la cuenta atrás hasta la próxima medianoche local (Resultado, PRD §10.3). */
export function useCountdown(): string {
  return formatCountdown(msUntilNextLocalMidnight(useNow()))
}
