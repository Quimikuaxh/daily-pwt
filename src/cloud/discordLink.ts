import { FUNCTION_NAME } from '../../supabase/functions/pwt-discord/handler'

/**
 * Aviso por Discord (RF-115 a RF-119, DEC-77): la vuelta de la vinculación trae `?discord=ok|cancelled|error` (lo pone la Edge Function
 * `pwt-discord`); Cuenta se abre con el resultado y el parámetro se quita de la dirección.
 */
export const DISCORD_PARAM = 'discord'

export type DiscordLinkResult = 'ok' | 'cancelled' | 'error'

/** Dirección de la Edge Function que empieza la vinculación con el `state` del servidor. */
export const discordStartUrl = (functionsUrl: string, state: string): string => `${functionsUrl}/${FUNCTION_NAME}?start=${encodeURIComponent(state)}`

/** Con expresión regular y no `URLSearchParams`, como `replayIdFrom` (E2E-17). */
export function discordResultFrom(search: string): DiscordLinkResult | null {
  return (new RegExp(`[?&]${DISCORD_PARAM}=(ok|cancelled|error)(?:&|$)`).exec(search)?.[1] as DiscordLinkResult | undefined) ?? null
}

/** La dirección sin `?discord=` (para no volver a enseñar el resultado al recargar). */
export function withoutDiscordParam(href: string): string {
  const url = new URL(href)
  url.searchParams.delete(DISCORD_PARAM)
  return url.toString()
}

/** Zona horaria del dispositivo: la hora del aviso se elige en ella. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
  } catch {
    return 'Europe/Madrid'
  }
}

/** Horas que se pueden elegir: de media en media hora (como `pwt.discord_links.remind_minute`). */
export const REMINDER_MINUTES: readonly number[] = Array.from({ length: 48 }, (_, index) => index * 30)

export const DEFAULT_REMINDER_MINUTE = 20 * 60

export const formatMinute = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
