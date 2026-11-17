export type ProgressRecord<State, Battle> = { version: 1; revision: number; state: State; battle: Battle | null }

export interface ProgressStore<State, Battle> {
  readonly persistent: boolean
  read(): ProgressRecord<State, Battle> | null
  write(state: State, battle: Battle | null, expectedRevision: number): ProgressRecord<State, Battle> | Promise<ProgressRecord<State, Battle>>
}

const DEFAULT_ERRORS = {
  damaged: 'El guardado tiene un formato incompatible o está dañado; se ha conservado sin cambios.',
  conflict: 'La partida ha cambiado desde otra sesión.',
  invalid: 'El estado de la partida no se puede guardar.',
}

/** Conserva registros incompatibles y detecta escrituras desde una revisión antigua. */
export class LocalProgressStore<State, Battle> implements ProgressStore<State, Battle> {
  persistent = false
  private record: ProgressRecord<State, Battle> | null = null
  private usable = true
  private blocked = false

  constructor(
    private readonly storage: Storage | null,
    private readonly key: string,
    private readonly valid: (value: unknown) => value is ProgressRecord<State, Battle>,
    private readonly errors = DEFAULT_ERRORS,
  ) {
    this.readStorage()
  }

  private readStorage() {
    if (!this.storage || !this.usable) return
    let raw: string | null
    try { raw = this.storage.getItem(this.key) } catch {
      this.usable = false
      this.persistent = false
      return
    }
    try {
      let record: ProgressRecord<State, Battle> | null = null
      if (raw !== null) {
        const value: unknown = JSON.parse(raw)
        if (!this.valid(value)) throw new Error('invalid progress')
        record = value
      }
      this.record = record
      this.persistent = true
    } catch {
      this.blocked = true
      this.persistent = false
    }
  }

  read(): ProgressRecord<State, Battle> | null {
    if (this.persistent) this.readStorage()
    if (this.blocked) throw new Error(this.errors.damaged)
    return structuredClone(this.record)
  }

  write(state: State, battle: Battle | null, expectedRevision: number): ProgressRecord<State, Battle> {
    const current = this.read()
    if ((current?.revision ?? 0) !== expectedRevision) throw new Error(this.errors.conflict)
    const next = structuredClone({ version: 1 as const, revision: expectedRevision + 1, state, battle })
    if (!this.valid(next)) throw new Error(this.errors.invalid)
    this.record = next
    if (this.storage && this.usable) {
      try {
        this.storage.setItem(this.key, JSON.stringify(next))
        this.persistent = true
      } catch { this.persistent = false }
    }
    return structuredClone(next)
  }
}
