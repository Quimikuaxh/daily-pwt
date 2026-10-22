import type { ResolvedSet } from '../core/types'

export type Choice = { type: 'move' | 'switch'; slot: number }

export type AiKind = 'heuristic' | 'trivial'

export type EngineInit = {
  battleSeed: string
  player: ResolvedSet[]
  /** Índice, dentro de `player`, del Pokémon que sale primero. */
  playerLead?: number
  /** `rival[0]` es el inicial. */
  rival: ResolvedSet[]
  ai: AiKind
  maxTurns: number
}

export type RequestMove = {
  move: string
  id: string
  pp?: number
  maxpp?: number
  target?: string
  disabled?: boolean
}

export type RequestPokemon = {
  ident: string
  details: string
  condition: string
  active: boolean
  stats?: Record<string, number>
  moves?: string[]
  baseAbility?: string
  item?: string
}

/** Petición del simulador al jugador (DEC-11): la UI lee de aquí las restricciones, no las reimplementa. */
export type BattleRequest = {
  rqid?: number
  active?: { moves: RequestMove[]; trapped?: boolean; maybeTrapped?: boolean }[]
  forceSwitch?: boolean[]
  wait?: boolean
  side: { name: string; id: string; pokemon: RequestPokemon[] }
}

export type MonView = {
  species: string
  hpPercent: number
  status: string | null
  fainted: boolean
  /** Solo el bando del jugador conoce los PS reales. */
  hp?: number
  maxHp?: number
  /** PP actuales y máximos de sus movimientos, en el orden del set (pantalla de datos; los del rival, en el botón RIVAL). */
  moves?: { id: string; pp: number; maxPp: number }[]
}

/** `active` es un índice en `team`. */
export type SideView = { remaining: number; active: number | null; team: MonView[] }

export type BattleView = {
  turn: number
  weather: string | null
  /** Turnos que le quedan al clima; `null` si es permanente (habilidad, 5.ª gen.) o no se sabe aún (llega con la instantánea). */
  weatherTurns?: number | null
  player: SideView
  rival: SideView
}

/** La vista que construye el motor: en 1v1 cada bando siempre tiene un activo. */
export type EngineBattleView = BattleView & { player: SideView & { active: number }; rival: SideView & { active: number } }

export type EndReason = 'faint' | 'forfeit' | 'turnLimit' | 'tie'

export type EngineEnd = {
  result: 'win' | 'loss'
  reason: EndReason
  turns: number
  playerAlive: number
  rivalFainted: number
  /** Debilitado o no cada Pokémon del jugador, en el orden del equipo del reto (no el del simulador, que pone el inicial delante). */
  playerFainted: boolean[]
}

export type EngineUpdate = {
  lines: string[]
  view: EngineBattleView
  request: BattleRequest | null
  ended?: EngineEnd
}
