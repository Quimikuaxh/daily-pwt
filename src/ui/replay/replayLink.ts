import { SITE_URL } from '../../config'

/** Parámetro de la dirección con el id de una repetición compartida (RF-131): `…/daily-pwt/?replay=<id>`. */
export const REPLAY_PARAM = 'replay'

export const replayLink = (id: string): string => `${SITE_URL}?${REPLAY_PARAM}=${encodeURIComponent(id)}`

/**
 * Id de la repetición compartida de la dirección, si lo hay y tiene la forma de los que da el servidor (10 de [a-z0-9]). Con una
 * expresión regular y no `URLSearchParams`: E2E-17 comprueba que el build de producción no lleva `URLSearchParams` (lo usan los ganchos
 * de prueba, que no deben llegar a él).
 */
export function replayIdFrom(search: string): string | null {
  return new RegExp(`[?&]${REPLAY_PARAM}=([a-z0-9]{10})(?:&|$)`).exec(search)?.[1] ?? null
}
