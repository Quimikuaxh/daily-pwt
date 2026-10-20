import type { PsRequest } from './requests'

/**
 * Contrato del motor (src/battle/engine.ts) asumido por los tests -- TODO-CONTRATO:
 *   createBattleEngine(init): BattleEngine, init = { battleSeed: string; player: ResolvedSet[]; playerLead?: number (índice, def. 0);
 *       rival: ResolvedSet[] (rival[0] = inicial); ai: 'heuristic' | 'trivial'; maxTurns: number }
 *   engine.start(): EngineUpdate ; engine.choose(choice): EngineUpdate (LANZA Error si la elección no es válida y no avanza)
 *   engine.forfeit(): EngineUpdate ; tras terminar, choose/forfeit no cambian nada (devuelven el último update).
 *   EngineUpdate = { lines: string[]; view: BattleView; request: PsRequest | null; ended?: EngineEnd }
 *   EngineEnd = { result: 'win' | 'loss'; reason: 'faint' | 'forfeit' | 'turnLimit' | 'tie'; turns: number; playerAlive: number; rivalFainted: number }
 *   BattleView = { turn: number; weather: string | null; player: SideView; rival: SideView }
 *   SideView = { remaining: number; active: number | null; team: MonView[] }   // active = índice en team
 *   MonView  = { species: string; hpPercent: number; status: string | null; fainted: boolean } + (solo jugador) hp, maxHp
 *   Choice = { type: 'move' | 'switch'; slot: number }
 */
export type Choice = { type: 'move' | 'switch'; slot: number }
export type EngineUpdate = {
  lines: string[]
  view: any
  request: PsRequest | null
  ended?: { result: 'win' | 'loss'; reason: string; turns: number; playerAlive: number; rivalFainted: number }
}

export const speciesOfDetails = (details: string): string => details.split(',')[0]

/** Primer movimiento habilitado (o Forcejeo); forceSwitch -> primer vivo no activo. */
export function firstEnabled(req: PsRequest): Choice {
  if (req.forceSwitch) {
    const i = req.side.pokemon.findIndex((p, k) => k > 0 && !p.condition.endsWith('fnt'))
    return { type: 'switch', slot: i + 1 }
  }
  const moves = req.active![0].moves
  const i = moves.findIndex((m) => !m.disabled && (m.pp === undefined || m.pp > 0))
  return { type: 'move', slot: i < 0 ? 1 : i + 1 }
}

export type PlayResult = { updates: EngineUpdate[]; last: EngineUpdate; lines: string[]; choices: Choice[] }

/** Juega hasta que termina (o se agotan `maxSteps` elecciones). `policy` recibe el update y devuelve la elección. */
export function playOut(
  engine: { start(): EngineUpdate; choose(c: Choice): EngineUpdate },
  policy: (u: EngineUpdate) => Choice = (u) => firstEnabled(u.request!),
  maxSteps = 700,
): PlayResult {
  const updates = [engine.start()]
  const choices: Choice[] = []
  while (!updates[updates.length - 1].ended && choices.length < maxSteps) {
    const c = policy(updates[updates.length - 1])
    choices.push(c)
    updates.push(engine.choose(c))
  }
  return { updates, last: updates[updates.length - 1], lines: updates.flatMap((u) => u.lines), choices }
}
