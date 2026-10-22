import type { EngineEnd } from '../battle/protocol'
import type { Checkpoint, DayRecord, DayStatus, Decision, GameStore, NewOfficial, VoidReason } from './gameStore'

export const STORAGE_KEY = 'daily-pwt:v1'
const CORRUPT_BACKUP_KEY = 'daily-pwt:v1:corrupt'
const SCHEMA_VERSION = 1
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const STATUSES: readonly DayStatus[] = ['inProgress', 'won', 'lost', 'void']

type StoredFile = { version: typeof SCHEMA_VERSION; days: Record<string, DayRecord> }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value !== ''
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
const isNullableCount = (value: unknown): boolean => value === null || isCount(value)

function isDecision(value: unknown): value is Decision {
  if (!isObject(value)) return false
  return value.type === 'forfeit' || ((value.type === 'move' || value.type === 'switch') && isCount(value.slot))
}

function isCheckpoint(value: unknown): value is Checkpoint {
  return isObject(value) && isCount(value.decisions) && isCount(value.turn) && isCount(value.playerRemaining) && isCount(value.rivalRemaining)
}

function isSavedBattle(value: unknown): boolean {
  return (
    isObject(value) &&
    isText(value.seed) &&
    (value.ai === 'heuristic' || value.ai === 'trivial') &&
    isCount(value.leadIndex) &&
    Array.isArray(value.decisions) &&
    value.decisions.every(isDecision) &&
    (value.checkpoint === null || isCheckpoint(value.checkpoint))
  )
}

function isDayRecord(value: unknown, date: string): value is DayRecord {
  if (!isObject(value) || value.date !== date) return false
  if (!isCount(value.challengeNumber) || !isText(value.trainerId) || !isText(value.variantId) || !isText(value.dataVersion) || !isText(value.startedAt)) return false
  if (!STATUSES.includes(value.status as DayStatus)) return false
  if (!(value.finishedAt === null || isText(value.finishedAt)) || !isNullableCount(value.turns) || !isNullableCount(value.survivors) || !isNullableCount(value.rivalFainted)) return false
  if (!(value.endReason === null || isText(value.endReason)) || !(value.voidReason === null || isText(value.voidReason))) return false
  const inProgress = value.status === 'inProgress'
  return inProgress ? isSavedBattle(value.battle) : value.battle === null
}

/** Un día cuyo registro no se puede leer: el intento queda gastado (no se regala otro) pero sin resultado inventado. */
function corruptDay(date: string, nowIso: string): DayRecord {
  return { date, challengeNumber: 0, trainerId: '', variantId: '', dataVersion: '', status: 'void', startedAt: nowIso, finishedAt: nowIso, turns: null, survivors: null, rivalFainted: null, endReason: null, voidReason: 'corrupt', battle: null }
}

const emptyFile = (): StoredFile => ({ version: SCHEMA_VERSION, days: {} })

/**
 * `GameStore` sobre `localStorage` (clave `daily-pwt:v1`). Todo el acceso va en try/catch: sin almacenamiento (null, bloqueado o cuota llena) el
 * estado sigue en memoria y el sitio funciona igual, solo que no sobrevive a recargar. Un archivo de otra versión del esquema no se pisa:
 * se trabaja en memoria y no se escribe. Un JSON ilegible se guarda aparte (`daily-pwt:v1:corrupt`) y se empieza vacío.
 */
export class LocalStorageStore implements GameStore {
  persistent: boolean
  private file: StoredFile = emptyFile()
  private usable: boolean

  constructor(private readonly storage: Storage | null, private readonly now: () => Date = () => new Date()) {
    this.usable = storage !== null
    this.persistent = this.usable
    this.load()
  }

  private load(): void {
    this.file = emptyFile()
    if (this.storage === null) return
    let raw: string | null
    try {
      raw = this.storage.getItem(STORAGE_KEY)
    } catch {
      this.usable = false
      this.persistent = false
      return
    }
    if (raw === null) return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.keepCorruptBackup(raw)
      return
    }
    if (!isObject(parsed) || !('version' in parsed)) {
      this.keepCorruptBackup(raw)
      return
    }
    if (parsed.version !== SCHEMA_VERSION) {
      this.usable = false
      this.persistent = false
      return
    }
    if (!isObject(parsed.days)) {
      this.keepCorruptBackup(raw)
      return
    }
    const nowIso = this.now().toISOString()
    for (const [date, entry] of Object.entries(parsed.days)) {
      if (!DATE_PATTERN.test(date)) continue
      this.file.days[date] = isDayRecord(entry, date) ? entry : corruptDay(date, nowIso)
    }
  }

  private keepCorruptBackup(raw: string): void {
    try {
      this.storage?.setItem(CORRUPT_BACKUP_KEY, raw)
    } catch {
      // Sin sitio para la copia: se empieza vacío igualmente.
    }
  }

  private save(): void {
    if (this.storage === null || !this.usable) return
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.file))
      this.persistent = true
    } catch {
      // Cuota llena o escritura bloqueada: se sigue en memoria y se reintenta en el próximo cambio.
      this.persistent = false
    }
  }

  /**
   * Otra pestaña puede haber escrito desde la última lectura: sin releer, dos pestañas abrirían cada una su «único» oficial. Solo se relee
   * si lo último que hubo en memoria es lo que hay guardado (`persistent`); si una escritura falló, la memoria manda.
   */
  private refresh(): void {
    if (this.usable && this.persistent) this.load()
  }

  getDay(date: string): DayRecord | null {
    this.refresh()
    return this.file.days[date] ?? null
  }

  listDays(): DayRecord[] {
    this.refresh()
    return Object.values(this.file.days).sort((first, second) => first.date.localeCompare(second.date))
  }

  startOfficial(entry: NewOfficial): { record: DayRecord; created: boolean } {
    this.refresh()
    const existing = this.getDay(entry.date)
    if (existing) return { record: existing, created: false }
    const record: DayRecord = {
      date: entry.date,
      challengeNumber: entry.challengeNumber,
      trainerId: entry.trainerId,
      variantId: entry.variantId,
      dataVersion: entry.dataVersion,
      status: 'inProgress',
      startedAt: entry.startedAt,
      finishedAt: null,
      turns: null,
      survivors: null,
      rivalFainted: null,
      endReason: null,
      voidReason: null,
      battle: { ...entry.battle, decisions: [], checkpoint: null },
    }
    this.file.days[entry.date] = record
    this.save()
    return { record, created: true }
  }

  private inProgress(date: string): DayRecord | null {
    const record = this.getDay(date)
    return record?.status === 'inProgress' && record.battle ? record : null
  }

  recordDecision(date: string, decision: Decision): void {
    const record = this.inProgress(date)
    if (!record?.battle) return
    record.battle.decisions.push(decision)
    this.save()
  }

  recordCheckpoint(date: string, checkpoint: Checkpoint): void {
    const record = this.inProgress(date)
    if (!record?.battle) return
    record.battle.checkpoint = checkpoint
    this.save()
  }

  finishOfficial(date: string, ended: EngineEnd, finishedAt: string): void {
    const record = this.inProgress(date)
    if (!record) return
    record.status = ended.result === 'win' ? 'won' : 'lost'
    record.finishedAt = finishedAt
    record.turns = ended.turns
    record.survivors = ended.playerAlive
    record.rivalFainted = ended.rivalFainted
    record.endReason = ended.reason
    record.battle = null
    this.save()
  }

  voidOfficial(date: string, reason: VoidReason, finishedAt: string): void {
    const record = this.inProgress(date)
    if (!record) return
    record.status = 'void'
    record.voidReason = reason
    record.finishedAt = finishedAt
    record.battle = null
    this.save()
  }
}
