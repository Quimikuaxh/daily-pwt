import type { SfxId } from '../audio/audio'
import { ACTION_END } from './moveFxCues'

/**
 * Efectos de sonido del combate (DEC-57). Golpe: en cada `-damage` sin `[from]` (el que baja la barra del objetivo; también uno por golpe
 * en los de varios golpes). Su sonido depende de si en la misma acción llega `-supereffective` o `-resisted` para ese objetivo:
 * `deferHitMessages` los pone después del daño, así que se mira hacia delante hasta el final de la acción.
 */
export function hitSoundAt(lines: readonly (string | null)[], index: number): SfxId | null {
  const [, type = '', target = '', , ...rest] = (lines[index] ?? '').split('|')
  if (type !== '-damage' || rest.some((part) => part.startsWith('[from]'))) return null
  const who = target.slice(0, 2)
  for (let next = index + 1; next < lines.length; next += 1) {
    const [, nextType = '', nextTarget = ''] = (lines[next] ?? '').split('|')
    if (ACTION_END.has(nextType)) break
    if (nextTarget.slice(0, 2) !== who) continue
    if (nextType === '-supereffective') return 'hit-super'
    if (nextType === '-resisted') return 'hit-weak'
  }
  return 'hit-neutral'
}

/**
 * Poké Ball: cuándo se lanza y cuándo se abre, en ms a x1 desde que empieza la fase de la intro o el cambio (los mismos tiempos que el
 * CSS de battle.css). Sin retirada (`-send`) el cambio arranca `skipMs` más tarde en su animación.
 */
export const BALL_SFX_MS = {
  rivalSend: { throw: 100, open: 520 },
  playerSend: { throw: 650, open: 1070 },
  switch: { throw: 800, open: 1120, skipMs: 500 },
} as const

export function switchBallTimes(send: boolean): { throw: number; open: number } {
  const skip = send ? BALL_SFX_MS.switch.skipMs : 0
  return { throw: BALL_SFX_MS.switch.throw - skip, open: BALL_SFX_MS.switch.open - skip }
}
