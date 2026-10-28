import { describe, it, expect } from 'vitest'
import { LocalStorageStore, STORAGE_KEY } from './localStorageStore'
import type { NewOfficial } from './gameStore'
import type { EngineEnd } from '../battle/protocol'
import { MemoryStorage } from '../test-utils/memoryStorage'

// DEC-43: progreso por día detrás de GameStore; localStorage versionado, a prueba de corrupción y de almacenamiento no disponible.
const NOW = new Date('2026-10-21T10:00:00.000Z')
const clock = () => NOW
const entry = (date = '2026-10-21'): NewOfficial => ({
  date, challengeNumber: 3, trainerId: 'misty', variantId: 'misty-1', dataVersion: 'v1', startedAt: NOW.toISOString(),
  battle: { seed: 'seed-1', ai: 'heuristic', leadIndex: 2 },
})
const WIN: EngineEnd = { result: 'win', reason: 'faint', turns: 12, playerAlive: 4, rivalFainted: 6, playerFainted: [false, true, false, false, true, false] }
const LOSS: EngineEnd = { result: 'loss', reason: 'forfeit', turns: 5, playerAlive: 6, rivalFainted: 0, playerFainted: [false, false, false, false, false, false] }
const stored = (storage: MemoryStorage) => JSON.parse(storage.getItem(STORAGE_KEY) as string)

describe('un oficial por día', () => {
  it('registra el oficial al empezarlo: en curso, con semilla, inicial y sin decisiones', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock)
    const { record, created } = store.startOfficial(entry())
    expect(created).toBe(true)
    expect(record).toMatchObject({ date: '2026-10-21', status: 'inProgress', challengeNumber: 3, trainerId: 'misty', variantId: 'misty-1', finishedAt: null })
    expect(record.battle).toEqual({ seed: 'seed-1', ai: 'heuristic', leadIndex: 2, decisions: [], checkpoint: null })
  })

  it('no da otro intento: empezar de nuevo devuelve el existente, en curso o terminado', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock)
    store.startOfficial(entry())
    expect(store.startOfficial({ ...entry(), battle: { seed: 'otra', ai: 'heuristic', leadIndex: 0 } })).toMatchObject({ created: false, record: { battle: { seed: 'seed-1' } } })
    store.finishOfficial('2026-10-21', WIN, NOW.toISOString())
    const again = store.startOfficial(entry())
    expect(again.created).toBe(false)
    expect(again.record.status).toBe('won')
  })

  it('terminar guarda resultado, turnos, supervivientes y hora de fin, y borra lo necesario para reanudar', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock)
    store.startOfficial(entry())
    store.finishOfficial('2026-10-21', WIN, '2026-10-21T10:20:00.000Z')
    expect(store.getDay('2026-10-21')).toMatchObject({ status: 'won', turns: 12, survivors: 4, rivalFainted: 6, endReason: 'faint', finishedAt: '2026-10-21T10:20:00.000Z', battle: null })
    expect(store.getDay('2026-10-21')?.playerFainted).toEqual(WIN.playerFainted)
  })

  it('rendirse (derrota) queda como derrota con motivo forfeit', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock)
    store.startOfficial(entry())
    store.finishOfficial('2026-10-21', LOSS, NOW.toISOString())
    expect(store.getDay('2026-10-21')).toMatchObject({ status: 'lost', endReason: 'forfeit' })
  })

  it('un resultado no se puede sobrescribir: terminar dos veces conserva el primero', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock)
    store.startOfficial(entry())
    store.finishOfficial('2026-10-21', WIN, NOW.toISOString())
    store.finishOfficial('2026-10-21', LOSS, NOW.toISOString())
    store.voidOfficial('2026-10-21', 'replayFailed', NOW.toISOString())
    expect(store.getDay('2026-10-21')?.status).toBe('won')
  })

  it('anular gasta el intento sin victoria ni derrota', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock)
    store.startOfficial(entry())
    store.voidOfficial('2026-10-21', 'replayFailed', NOW.toISOString())
    expect(store.getDay('2026-10-21')).toMatchObject({ status: 'void', voidReason: 'replayFailed', turns: null, battle: null })
    expect(store.startOfficial(entry()).created).toBe(false)
  })

  it('dos pestañas sobre el mismo almacenamiento no abren cada una su oficial: la segunda ve el de la primera', () => {
    const storage = new MemoryStorage()
    const tabA = new LocalStorageStore(storage, clock)
    const tabB = new LocalStorageStore(storage, clock)
    expect(tabA.startOfficial(entry()).created).toBe(true)
    expect(tabB.getDay('2026-10-21')?.status).toBe('inProgress')
    expect(tabB.startOfficial(entry()).created).toBe(false)
    tabA.finishOfficial('2026-10-21', WIN, NOW.toISOString())
    expect(tabB.getDay('2026-10-21')?.status).toBe('won')
  })

  it('cada día tiene su oficial y el historial sale ordenado por fecha', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock)
    store.startOfficial(entry('2026-10-22'))
    store.startOfficial(entry('2026-10-21'))
    expect(store.listDays().map((day) => day.date)).toEqual(['2026-10-21', '2026-10-22'])
  })
})

describe('registro de decisiones', () => {
  it('guarda las decisiones en orden y el último punto de control', () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageStore(storage, clock)
    store.startOfficial(entry())
    store.recordDecision('2026-10-21', { type: 'move', slot: 2 })
    store.recordDecision('2026-10-21', { type: 'switch', slot: 3 })
    store.recordCheckpoint('2026-10-21', { decisions: 2, turn: 3, playerRemaining: 6, rivalRemaining: 5 })
    expect(stored(storage).days['2026-10-21'].battle).toMatchObject({ decisions: [{ type: 'move', slot: 2 }, { type: 'switch', slot: 3 }], checkpoint: { decisions: 2, turn: 3 } })
  })

  it('ignora decisiones de un día terminado o inexistente', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock)
    store.recordDecision('2026-10-21', { type: 'forfeit' })
    store.startOfficial(entry())
    store.finishOfficial('2026-10-21', WIN, NOW.toISOString())
    store.recordDecision('2026-10-21', { type: 'forfeit' })
    expect(store.getDay('2026-10-21')?.battle).toBeNull()
  })

  it('lo guardado se recupera al crear otro store sobre el mismo almacenamiento (recarga)', () => {
    const storage = new MemoryStorage()
    const first = new LocalStorageStore(storage, clock)
    first.startOfficial(entry())
    first.recordDecision('2026-10-21', { type: 'move', slot: 1 })
    const second = new LocalStorageStore(storage, clock)
    expect(second.getDay('2026-10-21')).toEqual(first.getDay('2026-10-21'))
    expect(second.persistent).toBe(true)
  })
})

describe('versión y corrupción', () => {
  it('guarda con la clave daily-pwt:v1 y la versión 1 del esquema', () => {
    const storage = new MemoryStorage()
    new LocalStorageStore(storage, clock).startOfficial(entry())
    expect(STORAGE_KEY).toBe('daily-pwt:v1')
    expect(stored(storage).version).toBe(1)
  })

  it('un JSON ilegible empieza vacío y se conserva una copia aparte', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, '{no es json')
    const store = new LocalStorageStore(storage, clock)
    expect(store.listDays()).toEqual([])
    expect(storage.getItem('daily-pwt:v1:corrupt')).toBe('{no es json')
    expect(store.startOfficial(entry()).created).toBe(true)
  })

  it('una forma inesperada (array, sin versión) empieza vacía', () => {
    for (const raw of ['[]', '"hola"', '{"days":{}}', 'null']) {
      const storage = new MemoryStorage()
      storage.setItem(STORAGE_KEY, raw)
      expect(new LocalStorageStore(storage, clock).listDays()).toEqual([])
    }
  })

  it('un archivo de otra versión del esquema no se pisa: se trabaja en memoria', () => {
    const storage = new MemoryStorage()
    const future = JSON.stringify({ version: 2, days: { x: 1 } })
    storage.setItem(STORAGE_KEY, future)
    const store = new LocalStorageStore(storage, clock)
    expect(store.persistent).toBe(false)
    expect(store.startOfficial(entry()).created).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe(future)
  })

  it('un día con el registro roto cuenta como oficial gastado y anulado, no como otro intento', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-10-21': { date: '2026-10-21', status: 'inProgress', battle: 'roto' } } }))
    const store = new LocalStorageStore(storage, clock)
    expect(store.getDay('2026-10-21')).toMatchObject({ status: 'void', voidReason: 'corrupt' })
    expect(store.startOfficial(entry()).created).toBe(false)
  })

  it('un día guardado antes de F3 (sin playerFainted) se lee con playerFainted null, no como roto', () => {
    const storage = new MemoryStorage()
    const old = new LocalStorageStore(new MemoryStorage(), clock)
    old.startOfficial(entry())
    old.finishOfficial('2026-10-21', WIN, '2026-10-21T10:20:00.000Z')
    const { playerFainted: _dropped, ...withoutField } = old.getDay('2026-10-21') as unknown as Record<string, unknown>
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-10-21': withoutField } }))
    expect(new LocalStorageStore(storage, clock).getDay('2026-10-21')).toMatchObject({ status: 'won', playerFainted: null })
  })

  it('un playerFainted mal formado cuenta como registro roto', () => {
    const storage = new MemoryStorage()
    const good = new LocalStorageStore(new MemoryStorage(), clock)
    good.startOfficial(entry())
    good.finishOfficial('2026-10-21', WIN, '2026-10-21T10:20:00.000Z')
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-10-21': { ...good.getDay('2026-10-21'), playerFainted: ['sí'] } } }))
    expect(new LocalStorageStore(storage, clock).getDay('2026-10-21')).toMatchObject({ status: 'void', voidReason: 'corrupt' })
  })

  it('un día bueno junto a uno roto se conserva', () => {
    const storage = new MemoryStorage()
    const good = new LocalStorageStore(new MemoryStorage(), clock)
    good.startOfficial(entry('2026-10-20'))
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-10-20': good.getDay('2026-10-20'), '2026-10-21': 7, 'no-fecha': {} } }))
    const store = new LocalStorageStore(storage, clock)
    expect(store.getDay('2026-10-20')?.status).toBe('inProgress')
    expect(store.getDay('2026-10-21')?.status).toBe('void')
    expect(store.listDays()).toHaveLength(2)
  })

  it('un en curso sin datos de combate, o con decisiones mal formadas, se considera roto', () => {
    const base = new LocalStorageStore(new MemoryStorage(), clock)
    base.startOfficial(entry())
    const record = base.getDay('2026-10-21')!
    for (const broken of [{ ...record, battle: null }, { ...record, battle: { ...record.battle, decisions: [{ type: 'volar', slot: 1 }] } }, { ...record, status: 'ganado' }]) {
      const storage = new MemoryStorage()
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-10-21': broken } }))
      expect(new LocalStorageStore(storage, clock).getDay('2026-10-21')?.voidReason).toBe('corrupt')
    }
  })
})

describe('borrar datos locales (Ajustes)', () => {
  it('clear olvida todo el historial, también el oficial de hoy, y vuelve a dejar jugar', () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageStore(storage, clock)
    store.startOfficial(entry())
    store.finishOfficial('2026-10-21', WIN, '2026-10-21T10:20:00.000Z')
    storage.setItem('daily-pwt:v1:corrupt', '{')
    store.clear()
    expect(store.listDays()).toEqual([])
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem('daily-pwt:v1:corrupt')).toBeNull()
    expect(store.startOfficial(entry()).created).toBe(true)
    expect(new LocalStorageStore(storage, clock).getDay('2026-10-21')?.status).toBe('inProgress')
  })
})

describe('almacenamiento no disponible', () => {
  it('sin almacenamiento (null) funciona en memoria y avisa de que no persiste', () => {
    const store = new LocalStorageStore(null, clock)
    expect(store.persistent).toBe(false)
    expect(store.startOfficial(entry()).created).toBe(true)
    expect(store.startOfficial(entry()).created).toBe(false)
  })

  it('almacenamiento bloqueado al leer: funciona en memoria', () => {
    const storage = new MemoryStorage()
    storage.failReads = true
    const store = new LocalStorageStore(storage, clock)
    expect(store.persistent).toBe(false)
    store.startOfficial(entry())
    store.recordDecision('2026-10-21', { type: 'move', slot: 1 })
    expect(store.getDay('2026-10-21')?.battle?.decisions).toHaveLength(1)
    expect(storage.length).toBe(0)
  })

  it('cuota llena al escribir: el estado sigue en memoria y no lanza', () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageStore(storage, clock)
    storage.failWrites = true
    expect(() => store.startOfficial(entry())).not.toThrow()
    expect(store.persistent).toBe(false)
    expect(store.getDay('2026-10-21')?.status).toBe('inProgress')
  })

  it('si la cuota se libera, el siguiente cambio vuelve a guardarse con todo lo acumulado', () => {
    const storage = new MemoryStorage()
    const store = new LocalStorageStore(storage, clock)
    storage.failWrites = true
    store.startOfficial(entry())
    storage.failWrites = false
    store.recordDecision('2026-10-21', { type: 'move', slot: 1 })
    expect(store.persistent).toBe(true)
    expect(stored(storage).days['2026-10-21'].battle.decisions).toHaveLength(1)
  })
})

// UT-99 · F4 (DEC-63): caché del historial de una cuenta.
describe('caché de una cuenta', () => {
  it('va en su propia clave y no toca el historial sin cuenta', () => {
    const storage = new MemoryStorage()
    const local = new LocalStorageStore(storage, clock)
    local.startOfficial(entry())
    const cache = new LocalStorageStore(storage, clock, 'daily-pwt:v1:account:u1')
    expect(cache.listDays()).toEqual([])
    cache.startOfficial(entry('2026-10-22'))
    expect(local.listDays().map((day) => day.date)).toEqual(['2026-10-21'])
    cache.clear()
    expect(local.listDays()).toHaveLength(1)
  })

  it('replaceDays: manda el servidor, salvo un oficial en curso de aquí más avanzado; ignora días ilegibles', () => {
    const store = new LocalStorageStore(new MemoryStorage(), clock, 'daily-pwt:v1:account:u1')
    store.startOfficial(entry())
    store.recordDecision('2026-10-21', { type: 'move', slot: 0 })
    store.recordDecision('2026-10-21', { type: 'move', slot: 1 })
    const local = store.getDay('2026-10-21')!
    const server = { ...local, battle: { ...local.battle!, decisions: [{ type: 'move' as const, slot: 0 }] } }
    const finished = { ...local, date: '2026-10-20', status: 'won' as const, battle: null, turns: 3, survivors: 2, finishedAt: 'y' }
    store.replaceDays([server, finished, { date: 'mal' } as never])
    expect(store.getDay('2026-10-21')?.battle?.decisions).toHaveLength(2)
    expect(store.getDay('2026-10-20')?.status).toBe('won')

    const otherBattle = { ...server, battle: { ...server.battle, seed: 'otra' } }
    store.replaceDays([otherBattle])
    expect(store.getDay('2026-10-21')?.battle?.seed).toBe('otra')
  })
})
