import type { AiKind, EndReason, EngineEnd } from '../battle/protocol'

/** Oficial = el del día (uno, queda registrado); práctica = ilimitada, no cuenta ni se guarda. */
export type BattleMode = 'official' | 'practice'

/** Decisión del jugador en un combate oficial, en el orden en que se tomó (la elección del inicial va en `battle.leadIndex`). */
export type Decision = { type: 'move' | 'switch'; slot: number } | { type: 'forfeit' }

/** Estado del combate tras la decisión número `decisions`: sirve para comprobar que la reproducción llega al mismo sitio. */
export type Checkpoint = { decisions: number; turn: number; playerRemaining: number; rivalRemaining: number }

/**
 * `void` = oficial consumido sin victoria ni derrota: el combate guardado no se pudo reanudar (datos distintos, registro corrupto o motor
 * que no reproduce el estado). Gasta el intento del día pero no cuenta como derrota (DEC-43).
 */
export type DayStatus = 'inProgress' | 'won' | 'lost' | 'void'
export type VoidReason = 'replayFailed' | 'dataChanged' | 'corrupt'

export type SavedBattle = {
  seed: string
  ai: AiKind
  leadIndex: number
  decisions: Decision[]
  checkpoint: Checkpoint | null
}

/** Un día con combate oficial: la unidad del historial (estadísticas y rachas de F3 se calculan sobre estas entradas). */
export type DayRecord = {
  /** Fecha del reto (YYYY-MM-DD): el «día» del oficial, no la hora a la que se termina. */
  date: string
  challengeNumber: number
  trainerId: string
  variantId: string
  dataVersion: string
  status: DayStatus
  startedAt: string
  finishedAt: string | null
  turns: number | null
  /** Pokémon del jugador en pie al terminar. */
  survivors: number | null
  rivalFainted: number | null
  endReason: EndReason | null
  voidReason: VoidReason | null
  /** Solo mientras está en curso: lo necesario para reanudar. Se borra al terminar. */
  battle: SavedBattle | null
}

export type NewOfficial = {
  date: string
  challengeNumber: number
  trainerId: string
  variantId: string
  dataVersion: string
  startedAt: string
  battle: Omit<SavedBattle, 'decisions' | 'checkpoint'>
}

/**
 * Repositorio del progreso del jugador. Hoy hay una sola implementación local (`LocalStorageStore`); una cuenta con sesión sería otra
 * implementación de esta misma interfaz. Es síncrona porque la local lo es; si una remota exige asincronía, la interfaz pasa a promesas
 * en un solo sitio (el estado de la aplicación que la usa).
 */
export interface GameStore {
  /** `false` si no hay almacenamiento utilizable (bloqueado, cuota llena): el progreso vive solo mientras la pestaña esté abierta. */
  readonly persistent: boolean
  getDay(date: string): DayRecord | null
  /** Todos los días, de más antiguo a más reciente. */
  listDays(): DayRecord[]
  /** Registra el oficial de `date`. Si ya hay uno (en curso o terminado) no crea otro: devuelve el existente y `created: false`. */
  startOfficial(entry: NewOfficial): { record: DayRecord; created: boolean }
  recordDecision(date: string, decision: Decision): void
  recordCheckpoint(date: string, checkpoint: Checkpoint): void
  finishOfficial(date: string, ended: EngineEnd, finishedAt: string): void
  voidOfficial(date: string, reason: VoidReason, finishedAt: string): void
}
