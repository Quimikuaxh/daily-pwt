import type { EngineEnd } from '../battle/protocol'
import type { Decision, GameStore, NewOfficial, VoidReason } from '../storage/gameStore'
import { accountStorageKey, LocalStorageStore } from '../storage/localStorageStore'
import { CloudError, type CloudApi, type StartResult } from './api'
import type { CloudAuth, Session } from './auth'
import { CloudSync, outboxKey, type TurnState } from './cloudSync'
import { isPlayer, type AccountState } from './state'

export { isPlayer, type AccountState }

export type Cloud = { api: CloudApi; auth: CloudAuth }

/** Otro dispositivo ya había empezado el oficial de este día (RF-98): el de aquí no cuenta y se enseña el de la cuenta. */
export type ConflictListener = (date: string) => void

/**
 * Cuenta del jugador (F4, DEC-63): abre la sesión (anónima si no hay otra), elige el almacén que leen las pantallas (el local o la caché de
 * la cuenta) y replica el oficial en la base de datos con `CloudSync`. Nada de esto bloquea el juego: si algo falla, se sigue en local.
 */
export class Account {
  private state: AccountState
  private readonly listeners = new Set<() => void>()
  private readonly conflictListeners = new Set<ConflictListener>()
  private cloud: Cloud | null = null
  private sync: CloudSync | null = null
  private accountStore: LocalStorageStore | null = null

  constructor(
    private readonly cloudLoader: Promise<Cloud | null> | null,
    private readonly storage: Storage | null,
    private readonly localStore: GameStore,
  ) {
    this.state = cloudLoader ? { status: 'connecting' } : { status: 'disabled' }
  }

  getState = (): AccountState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onConflict(listener: ConflictListener): () => void {
    this.conflictListeners.add(listener)
    return () => this.conflictListeners.delete(listener)
  }

  private set(state: AccountState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }

  get api(): CloudApi | null {
    return isPlayer(this.state) ? (this.cloud?.api ?? null) : null
  }

  /** El almacén que leen y escriben las pantallas: el de la cuenta con sesión de Google; si no, el local. */
  get store(): GameStore {
    return this.state.status === 'signedIn' && this.accountStore ? this.accountStore : this.localStore
  }

  async start(): Promise<void> {
    if (!this.cloudLoader) return
    try {
      this.cloud = await this.cloudLoader
      if (!this.cloud) return this.set({ status: 'disabled' })
      const session = (await this.cloud.auth.getSession()) ?? (await this.cloud.auth.signInAnonymously())
      await this.open(session)
    } catch {
      this.set({ status: 'offline' })
    }
  }

  private async open(session: Session): Promise<void> {
    const cloud = this.cloud as Cloud
    this.sync = new CloudSync(cloud.api, this.storage, outboxKey(session.userId), (result, entry) => this.started(result, entry))
    if (session.anonymous) {
      this.accountStore = null
      this.set({ status: 'guest', userId: session.userId, nickname: null, summary: null })
      void this.sync.flush()
      try {
        const profile = await cloud.api.ensureProfile()
        if (this.state.status === 'guest') this.set({ ...this.state, nickname: profile.nickname })
      } catch {
        // Sin nombre de momento: se juega igual y el oficial cuenta; el perfil se pide en la próxima carga.
      }
      await this.refreshSummary()
      return
    }
    const profile = await cloud.api.ensureProfile()
    this.accountStore = new LocalStorageStore(this.storage, undefined, accountStorageKey(session.userId))
    // Primero lo pendiente de enviar; luego se sube el historial del navegador (RF-97) y se baja el de la cuenta.
    await this.sync.flush()
    const finished = this.localStore.listDays().filter((day) => day.status !== 'inProgress')
    if (finished.length > 0) await cloud.api.importDays(finished)
    this.accountStore.replaceDays(await cloud.api.myDays())
    this.set({ status: 'signedIn', userId: session.userId, nickname: profile.nickname, summary: null })
    await this.refreshSummary()
  }

  /** Vuelve a bajar el historial de la cuenta y los puntos (al volver a la pestaña: otro dispositivo pudo jugar). */
  async refresh(): Promise<void> {
    if (this.state.status === 'guest') {
      await this.sync?.flush()
      return this.refreshSummary()
    }
    if (this.state.status !== 'signedIn' || !this.cloud || !this.accountStore) return
    try {
      await this.sync?.flush()
      this.accountStore.replaceDays(await this.cloud.api.myDays())
      if (this.state.status === 'signedIn') this.set({ ...this.state })
      await this.refreshSummary()
    } catch {
      // Sin red: se queda lo que había.
    }
  }

  /** Vuelve a bajar nickname, puntos y solicitudes pendientes. */
  async refreshSummary(): Promise<void> {
    if (!isPlayer(this.state) || !this.cloud) return
    try {
      const summary = await this.cloud.api.mySummary()
      if (isPlayer(this.state)) this.set({ ...this.state, nickname: summary.nickname ?? this.state.nickname, summary })
    } catch {
      // Los puntos se verán en la próxima carga.
    }
  }

  private started(result: StartResult, entry: NewOfficial): void {
    if (result.created || result.day.battle?.seed === entry.battle.seed) return
    if (this.state.status === 'signedIn' && this.accountStore) {
      this.accountStore.replaceDays([result.day])
      for (const listener of this.conflictListeners) listener(entry.date)
    }
  }

  signIn(): Promise<void> {
    return this.cloud ? this.cloud.auth.signInWithGoogle() : Promise.reject(new CloudError('disabled', true))
  }

  /** RF-96: vuelve al modo local (con una sesión anónima nueva); lo guardado en el navegador no se borra. */
  async signOut(): Promise<void> {
    if (!this.cloud) return
    await this.cloud.auth.signOut()
    this.accountStore = null
    this.sync = null
    this.set({ status: 'connecting' })
    try {
      await this.open(await this.cloud.auth.signInAnonymously())
    } catch {
      this.set({ status: 'offline' })
    }
  }

  async setNickname(nickname: string): Promise<void> {
    if (!isPlayer(this.state) || !this.cloud) return
    const saved = await this.cloud.api.setNickname(nickname)
    if (isPlayer(this.state)) this.set({ ...this.state, nickname: saved })
  }

  // Réplica del oficial (RF-100, RF-101). Sin sesión (desactivado o sin red al abrir) no se envía nada y el oficial no cuenta.

  officialStarted(entry: NewOfficial, sizes: { player: number; rival: number }): void {
    void this.sync?.enqueue({ kind: 'start', entry, sizes })
  }

  turnSettled(date: string, decisions: Decision[], state: TurnState): void {
    // El estado inicial (antes de la primera decisión) ya está en el servidor desde el empezar.
    if (decisions.length === 0) return
    void this.sync?.enqueue({ kind: 'turn', date, decisions: [...decisions], state })
  }

  officialFinished(date: string, ended: EngineEnd, decisions: Decision[]): void {
    void this.sync?.enqueue({ kind: 'finish', date, ended, decisions: [...decisions] }).then(() => this.refreshSummary())
  }

  officialVoided(date: string, reason: VoidReason): void {
    void this.sync?.enqueue({ kind: 'void', date, reason })
  }

  /** Reintenta lo pendiente (al volver la conexión). */
  retry(): void {
    void this.sync?.flush()
  }
}
