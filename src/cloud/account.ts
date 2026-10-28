import type { EngineEnd } from '../battle/protocol'
import type { Decision, GameStore, NewOfficial, VoidReason } from '../storage/gameStore'
import { accountStorageKey, LocalStorageStore } from '../storage/localStorageStore'
import { CloudError, isPermanent, type CloudApi, type StartResult } from './api'
import type { CloudAuth, Session } from './auth'
import type { GoogleCredential } from './googleIdentity'
import { CloudSync, outboxKey, type TurnState } from './cloudSync'
import { isPlayer, type AccountState } from './state'

export { isPlayer, type AccountState }

export type Cloud = { api: CloudApi; auth: CloudAuth }

/**
 * Marca de que este navegador tenía abierta una sesión de Google (RF-96b). Si al abrir la web ya no está, la sesión se perdió (caducó, se
 * cerró en otro sitio o falló su renovación) y se avisa, en vez de pasar sin decir nada a jugar sin cuenta. Se quita al cerrar sesión.
 */
export const ACCOUNT_SESSION_KEY = 'daily-pwt:account-session'

/** Código para pasar a la cuenta lo jugado sin cuenta: se pide antes de abrir la sesión de Google y se canjea al abrirla. */
export const GUEST_CLAIM_KEY = 'daily-pwt:guest-claim'

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
  /** La sesión de Google de este navegador se perdió al abrir la web (RF-96b): App lo avisa en Hoy. */
  sessionLost = false
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
      // Un fallo de red al renovar la sesión no la sustituye por una anónima (perdería la de Google): se sigue en local (`offline`) y se
      // reintenta en la próxima carga. Si el servidor la rechaza, ya no vale: se avisa y se juega sin cuenta.
      let session: Session | null
      try {
        session = await this.cloud.auth.getSession()
      } catch (error) {
        if (!isPermanent(error)) throw error
        session = null
      }
      if (!session) this.noteLostSession()
      await this.open(session ?? (await this.cloud.auth.signInAnonymously()))
    } catch {
      this.set({ status: 'offline' })
    }
  }

  private noteLostSession(): void {
    try {
      if (!this.storage || this.storage.getItem(ACCOUNT_SESSION_KEY) === null) return
      this.storage.removeItem(ACCOUNT_SESSION_KEY)
      this.sessionLost = true
    } catch {
      // Sin almacenamiento no hay marca: no se puede saber si había sesión.
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
    const claimed = await this.claimGuest(cloud)
    try {
      this.storage?.setItem(ACCOUNT_SESSION_KEY, session.userId)
    } catch {
      // Sin almacenamiento no se podrá avisar si la sesión se pierde; nada más.
    }
    this.accountStore = new LocalStorageStore(this.storage, undefined, accountStorageKey(session.userId))
    // Primero lo pendiente de enviar; luego se sube el historial del navegador (RF-97) y se baja el de la cuenta.
    await this.sync.flush()
    const finished = this.localStore.listDays().filter((day) => day.status !== 'inProgress')
    if (finished.length > 0) await cloud.api.importDays(finished)
    this.accountStore.replaceDays(await cloud.api.myDays())
    this.set({ status: 'signedIn', userId: session.userId, nickname: claimed?.nickname ?? profile.nickname, summary: null })
    await this.refreshSummary()
  }

  /** Canjea el código guardado antes de ir a Google (una sola vez: se borra aunque falle). */
  private async claimGuest(cloud: Cloud): Promise<{ days: number; nickname: string | null } | null> {
    let code: string | null = null
    try {
      code = this.storage?.getItem(GUEST_CLAIM_KEY) ?? null
      this.storage?.removeItem(GUEST_CLAIM_KEY)
    } catch {
      return null
    }
    if (!code) return null
    try {
      return await cloud.api.claimGuest(code)
    } catch {
      return null
    }
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

  /**
   * Abre la sesión de Google con la credencial del botón, sin recargar. Sin cuenta, antes envía lo pendiente y pide el código para pasar a
   * la cuenta lo jugado en este navegador (`GUEST_CLAIM_KEY`); si falla, se inicia sesión igual y eso se queda en la sesión anónima.
   */
  async signIn(credential: GoogleCredential): Promise<void> {
    if (!this.cloud) throw new CloudError('disabled', true)
    if (this.state.status === 'guest') {
      try {
        await this.sync?.flush()
        this.storage?.setItem(GUEST_CLAIM_KEY, await this.cloud.api.createGuestClaim())
      } catch {
        // Sin código: se entra en la cuenta sin traspaso.
      }
    }
    let session: Session
    try {
      session = await this.cloud.auth.signInWithGoogle(credential)
    } catch (error) {
      try {
        this.storage?.removeItem(GUEST_CLAIM_KEY)
      } catch {
        // Sin almacenamiento no había código.
      }
      throw error
    }
    this.accountStore = null
    this.sync = null
    this.set({ status: 'connecting' })
    try {
      await this.open(session)
    } catch {
      // La sesión de Google ya está guardada: la próxima carga la abre.
      this.set({ status: 'offline' })
    }
  }

  /** RF-96: vuelve al modo local (con una sesión anónima nueva); lo guardado en el navegador no se borra. */
  async signOut(): Promise<void> {
    if (!this.cloud) return
    try {
      this.storage?.removeItem(ACCOUNT_SESSION_KEY)
    } catch {
      // Sin almacenamiento no hay marca que quitar.
    }
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

  /**
   * F5, RF-135: enlace de la repetición de ese día. Antes envía lo pendiente (la repetición puede estar aún en la cola).
   */
  async shareReplay(date: string): Promise<string> {
    const api = this.api
    if (!api) throw new CloudError('offline', false)
    await this.sync?.flush()
    if ((this.sync?.pending ?? 0) > 0) throw new CloudError('offline', false)
    return api.shareReplay(date)
  }

  /** F5: la repetición del oficial terminado (comprimida); se envía tras su final. */
  replayRecorded(date: string, data: string): void {
    void this.sync?.enqueue({ kind: 'replay', date, data })
  }

  officialVoided(date: string, reason: VoidReason): void {
    void this.sync?.enqueue({ kind: 'void', date, reason })
  }

  /** Reintenta lo pendiente (al volver la conexión). */
  retry(): void {
    void this.sync?.flush()
  }
}
