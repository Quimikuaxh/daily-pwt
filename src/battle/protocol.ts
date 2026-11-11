import type { ResolvedSet } from '../core/types'

export type Choice = { type: 'move' | 'switch'; slot: number }

export type AiKind = 'heuristic' | 'trivial'

export type BattleGeneration = 3 | 5

/** Un set de combate, con nivel de 1 a 100, de uno a cuatro movimientos y `''` cuando no lleva objeto. */
export type BattleSet = Omit<ResolvedSet, 'level' | 'moves'> & {
  level: number
  moves: string[]
  happiness?: number
}

export type EngineInit = {
  battleSeed: string
  generation?: BattleGeneration
  player: BattleSet[]
  /** Índice, dentro de `player`, del Pokémon que sale primero. */
  playerLead?: number
  /** `rival[0]` es el inicial. */
  rival: BattleSet[]
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
  /** Posición en el equipo de entrada cuando la especie se repite; ausente en repeticiones antiguas. */
  teamIndex?: number
  species: string
  hpPercent: number
  status: string | null
  fainted: boolean
  /** Tiene un sustituto en pie (solo el activo): en el campo se ve el muñeco en vez del Pokémon (decisión de Jose, 27/10/2026). */
  substitute?: boolean
  /** Solo el bando del jugador conoce los PS reales. */
  hp?: number
  maxHp?: number
  /**
   * Objeto que lleva en ese momento (id; `''` sin objeto): cambia con Truco, Trapicheo, Desarme o al gastarlo. Las repeticiones guardadas
   * antes de tenerlo no lo traen: entonces vale el del set.
   */
  item?: string
  /** PP actuales y máximos de sus movimientos, en el orden del set (pantalla de datos; los del rival, en el botón RIVAL). */
  moves?: { id: string; pp: number; maxPp: number }[]
}

import type { FieldState } from './fieldState'

/** `active` es un índice en `team`. */
export type SideView = { remaining: number; active: number | null; team: MonView[] }

export type BattleView = {
  turn: number
  weather: string | null
  /** Turnos que le quedan al clima; `null` si es permanente (habilidad, 5.ª gen.) o no se sabe aún (llega con la instantánea). */
  weatherTurns?: number | null
  /** Pantalla «Estado» (RF-44b): efectos del campo, de cada lado y de los dos Pokémon en combate. Las repeticiones antiguas no lo traen. */
  field?: FieldState
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

/** Preparación transportable y persistible como JSON; los Set se reconstruyen solo en el worker. */
export type CampaignBattlePreparation = Omit<import('../core/nuzlocke/battle').BattlePreparation, 'unlockedMoves'> & {
  unlockedMoves: readonly string[]
}

export type CampaignBattleInput = {
  definition: import('../core/nuzlocke/battle').CampaignBattleDefinition
  state: import('../core/nuzlocke/campaign').CampaignState
  preparation: CampaignBattlePreparation
  selected?: readonly string[]
}

/** El estado vigente lo aporta el hilo principal; el resultado se obtiene del motor del worker. */
export type CampaignBattleFinish = {
  definition: import('../core/nuzlocke/battle').CampaignBattleDefinition
  state: import('../core/nuzlocke/campaign').CampaignState
  battleSeed: string
}

export type CampaignDecision = import('../storage/gameStore').Decision
export type SavedCampaignBattle = {
  /** Estado anterior al combate y preparación serializable; la definición se aporta al reanudar. */
  source: Omit<CampaignBattleInput, 'definition'>
  /** null mientras el worker aún no ha confirmado la preparación. */
  init: EngineInit | null
  decisions: CampaignDecision[]
  checkpoint: { decisions: number; update: EngineUpdate } | null
}

export type CampaignBattleResume = {
  definition: CampaignBattleInput['definition']
  state: CampaignBattleInput['state']
  battle: SavedCampaignBattle & { init: EngineInit }
}
