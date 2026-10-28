import type { EngineEnd } from '../battle/protocol'
import type { DayRecord, Decision, NewOfficial, VoidReason } from '../storage/gameStore'

/**
 * Llamadas a las funciones del esquema `pwt` (supabase/migrations, DEC-63). La aplicación solo conoce esta interfaz: la implementación
 * con `supabase-js` está en `supabaseCloud.ts` y los tests usan una falsa.
 */

/** Día de la cuenta: un `DayRecord` más lo que solo sabe el servidor. */
export type CloudDay = DayRecord & { imported: boolean; validated: boolean }

export type StartResult = { created: boolean; day: CloudDay }

export type DayPoints = { date: string; points: number; provisional: boolean }

export type Summary = { nickname: string | null; registered: boolean; points: DayPoints[]; incomingRequests: number }

export type RankingScope = 'global' | 'friends'
/** `verified`: jugador con cuenta (tick). `nickname` es `null` si era sin cuenta y su nombre se liberó (RF-113). */
export type PointsRow = { rank: number; nickname: string | null; verified: boolean; points: number; provisional: boolean; me: boolean }
export type StreakRow = { rank: number; nickname: string | null; verified: boolean; streak: number; me: boolean }
/** Una página de 20 de un ranking (RF-108). `myPage`: la página del jugador, o `null` si no aparece. */
export type RankingPage<Row> = { page: number; pages: number; total: number; myPage: number | null; rows: Row[] }

/** Un oficial del historial (F5, RF-124): su resultado y, si se compartió, el id del enlace. */
export type HistoryItem = {
  date: string
  challengeNumber: number
  trainerId: string
  variantId: string
  status: 'won' | 'lost'
  turns: number | null
  survivors: number | null
  sharedId: string | null
}

/** Repetición compartida (RF-132). `mine`: la compartió quien la está viendo (puede borrarla, RF-133). */
export type SharedReplay = { id: string; nickname: string | null; date: string; challengeNumber: number; trainerId: string; data: string; mine: boolean }

/** Relación con otro jugador: amigo, solicitud recibida, solicitud enviada o ninguna. */
export type Relation = 'friend' | 'incoming' | 'outgoing' | 'none'
export type PlayerRow = { nickname: string; relation: Relation }

export interface CloudApi {
  ensureProfile(): Promise<{ nickname: string; created: boolean; registered: boolean }>
  setNickname(nickname: string): Promise<string>
  /** Sesión anónima: código de un solo uso (una hora) para pasar lo jugado a la cuenta al iniciar sesión. */
  createGuestClaim(): Promise<string>
  /** Cuenta: canjea el código; recibe los días que no tenga y, si es nueva, el nombre de la sesión anónima. */
  claimGuest(code: string): Promise<{ days: number; nickname: string | null }>
  startOfficial(entry: NewOfficial, sizes: { player: number; rival: number }): Promise<StartResult>
  saveTurn(date: string, decisions: Decision[], state: { turn: number; playerRemaining: number; rivalRemaining: number }): Promise<void>
  finishOfficial(date: string, ended: EngineEnd, decisions: Decision[]): Promise<{ validated: boolean }>
  voidOfficial(date: string, reason: VoidReason): Promise<void>
  importDays(days: DayRecord[]): Promise<number>
  myDays(): Promise<CloudDay[]>
  mySummary(): Promise<Summary>
  /** `page` null: la del jugador (o la primera, si no aparece). */
  pointsRanking(month: string, scope: RankingScope, page: number | null): Promise<RankingPage<PointsRow>>
  streakRanking(scope: RankingScope, page: number | null): Promise<RankingPage<StreakRow>>
  searchPlayers(query: string): Promise<PlayerRow[]>
  sendFriendRequest(nickname: string): Promise<Relation>
  respondFriendRequest(nickname: string, accept: boolean): Promise<void>
  cancelFriendRequest(nickname: string): Promise<void>
  removeFriend(nickname: string): Promise<void>
  listFriends(): Promise<PlayerRow[]>
  /** F5: repetición comprimida del oficial de ese día (`encodeReplay`). */
  saveReplay(date: string, data: string): Promise<void>
  myHistory(): Promise<HistoryItem[]>
  getMyReplay(date: string): Promise<string>
  /** Crea el enlace (o devuelve el que hay) y da su id. */
  shareReplay(date: string): Promise<string>
  getSharedReplay(id: string): Promise<SharedReplay>
  deleteSharedReplay(id: string): Promise<void>
}

/**
 * Error de una llamada. `permanent`: el servidor la rechazó (`raise exception` de las funciones, con `code` = el mensaje, p. ej.
 * `nickname_taken`); repetirla no sirve. Si no, es de red o del servicio y se puede reintentar.
 */
export class CloudError extends Error {
  constructor(readonly code: string, readonly permanent: boolean) {
    super(code)
    this.name = 'CloudError'
  }
}

export const isPermanent = (error: unknown): boolean => error instanceof CloudError && error.permanent
