import { expect, it } from 'vitest'
import { newTowerRun, startTowerRound } from '../core/battle-tower/tower'
import { loadGameData } from '../data/gameData'
import { fakeApi } from '../test-utils/cloud'
import { MemoryStorage } from '../test-utils/memoryStorage'
import { AccountTower } from '../cloud/campaign'
import { LocalTowerStore, TOWER_STORAGE_KEY, validTowerRecord, type TowerRecord } from './towerStore'

const run = newTowerRun('persistencia-torre', loadGameData())

it('recarga el mismo rival, equipo y decisiones en un registro independiente del locke', () => {
  const storage = new MemoryStorage()
  storage.setItem('daily-pwt:nuzlocke:v1', 'campaña')
  const local = new LocalTowerStore(storage)
  local.write(run, null, 0)
  const battle = startTowerRound(run)
  const saved = local.write(battle, { decisions: [{ type: 'move', slot: 1 }] }, 1)
  expect(new LocalTowerStore(storage).read()).toEqual(saved)
  expect(storage.getItem('daily-pwt:nuzlocke:v1')).toBe('campaña')
  expect(() => local.write(run, null, 1)).toThrow()
})

it('bloquea la sobrescritura de series dañadas o con un campeón fuera del séptimo puesto', () => {
  const storage = new MemoryStorage()
  const bad = { version: 1, revision: 1, state: { ...run, rivals: [...run.rivals].reverse() }, battle: null }
  expect(validTowerRecord(bad)).toBe(false)
  storage.setItem(TOWER_STORAGE_KEY, JSON.stringify(bad))
  const local = new LocalTowerStore(storage)
  expect(() => local.write(run, null, 0)).toThrow()
  expect(storage.getItem(TOWER_STORAGE_KEY)).toBe(JSON.stringify(bad))
})

it('usa el registro de Torre de la cuenta y separa la caché de cada usuario y de la serie local', async () => {
  const storage = new MemoryStorage()
  const local = new LocalTowerStore(storage)
  local.write(run, null, 0)
  let remote: TowerRecord | null = null
  const account = new AccountTower(storage)
  const api = fakeApi({
    getTower: async () => remote,
    saveTower: async ({ operationId, record }) => {
      remote = record
      return { operationId, revision: record.revision }
    },
  })
  account.setAccount(api, 'cuenta-a')
  await account.load()
  expect(account.read()).toBeNull()
  await account.write({ ...run, seed: 'en-cuenta' }, null, 0)
  expect(account.read()?.state.seed).toBe('en-cuenta')
  expect(local.read()?.state.seed).toBe(run.seed)
  account.setAccount(fakeApi(), 'cuenta-b')
  await account.load()
  expect(account.read()).toBeNull()
})
