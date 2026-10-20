import type { EngineEnd } from './protocol'

export type EndSnapshot = {
  ended: boolean
  winner: 'player' | 'rival' | 'tie' | null
  turn: number
  playerAlive: number
  rivalFainted: number
  forfeited?: boolean
}

/** Resultado del combate, o null si sigue. Rendición, empate y límite de turnos cuentan como derrota (DEC-14). */
export function evaluateEnd(snapshot: EndSnapshot, maxTurns: number): EngineEnd | null {
  const counts = { turns: snapshot.turn, playerAlive: snapshot.playerAlive, rivalFainted: snapshot.rivalFainted }

  if (snapshot.ended) {
    if (snapshot.forfeited) return { result: 'loss', reason: 'forfeit', ...counts }
    if (snapshot.winner === 'player') return { result: 'win', reason: 'faint', ...counts }
    if (snapshot.winner === 'tie') return { result: 'loss', reason: 'tie', ...counts }
    return { result: 'loss', reason: 'faint', ...counts }
  }
  if (snapshot.turn > maxTurns) return { result: 'loss', reason: 'turnLimit', ...counts }
  return null
}

/** `forfeit` no existe en el simulador: rendirse es perder el combate para p1. */
export function forfeitBattle(battle: { lose(side: 'p1'): void }): void {
  battle.lose('p1')
}
