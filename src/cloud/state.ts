import type { Summary } from './api'

/**
 * - `disabled`: sin Supabase configurado; todo en local, como antes de F4.
 * - `connecting`: abriendo la sesión.
 * - `offline`: el servicio no responde; se juega en local y se avisa (RF-93).
 * - `guest`: sin cuenta, con la sesión anónima: nickname, puntos y rankings; historial en el navegador (RF-104b, RF-112).
 * - `signedIn`: con Google; historial, rachas y puntos en la cuenta, y amigos.
 * `nickname` es `null` mientras no se ha podido pedir el perfil.
 */
export type AccountState =
  | { status: 'disabled' | 'connecting' | 'offline' }
  | { status: 'guest' | 'signedIn'; userId: string; nickname: string | null; summary: Summary | null }

/** Con sesión (con cuenta o sin ella): tiene perfil, puntos y rankings. */
export const isPlayer = (state: AccountState): state is Extract<AccountState, { userId: string }> => state.status === 'guest' || state.status === 'signedIn'

/** Estados mientras `Account` (`account.ts`) no está cargada: va en otro fichero, fuera de la ruta crítica (E2E-21). */
export const DISABLED: AccountState = { status: 'disabled' }
export const CONNECTING: AccountState = { status: 'connecting' }
export const OFFLINE: AccountState = { status: 'offline' }

/** Qué le falta al jugador para el aviso de Hoy (RF-94b): elegir nombre, iniciar sesión o las dos cosas. */
export type WelcomeNeeds = { name: boolean; account: boolean }

/** `null` si no le falta nada o si aún no se sabe (sin resumen, o servidor sin `nicknameChosen`). */
export function welcomeNeeds(state: AccountState | undefined): WelcomeNeeds | null {
  if (!state || !isPlayer(state) || !state.summary || state.summary.nicknameChosen === undefined) return null
  const needs = { name: !state.summary.nicknameChosen, account: state.status === 'guest' }
  return needs.name || needs.account ? needs : null
}
