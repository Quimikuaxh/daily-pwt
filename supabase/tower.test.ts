import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createTestDb, type Caller, type TestDb } from './testDb'

let t: TestDb
beforeAll(async () => { t = await createTestDb() }, 60_000)
afterAll(async () => { await t?.db.close() })

const get = (user: Caller) => t.call(user, 'select pwt.get_tower()')
const save = (user: Caller, revision: number, seed: string, op = randomUUID()) =>
  t.call(user, 'select pwt.save_tower($1,$2,1,$3::jsonb,null)', [revision, op, JSON.stringify({ seed })])

it('guarda una serie independiente del locke y permite reintentos tras reaplicar la migración', async () => {
  const owner = await t.user()
  const op = randomUUID()
  await t.call(owner, 'select pwt.save_campaign(0,$1,1,$2::jsonb,null)', [op, JSON.stringify({ seed: 'locke' })])
  const receipt = await save(owner, 0, 'torre', op)
  await t.db.exec(readFileSync(new URL('./migrations/20261117000000_pwt_tower.sql', import.meta.url), 'utf8'))
  expect(await save(owner, 0, 'torre', op)).toEqual(receipt)
  expect(await get(owner)).toMatchObject({ revision: 1, state: { seed: 'torre' } })
  expect(await t.call(owner, 'select pwt.get_campaign()')).toMatchObject({ revision: 1, state: { seed: 'locke' } })
  await expect(save(owner, 0, 'otra')).rejects.toThrow('campaign_revision_conflict')
})

it('aísla propietarios y rechaza cuentas anónimas', async () => {
  const [owner, other, guest] = [await t.user(), await t.user(), await t.user(true)]
  await save(owner, 0, 'propietario')
  expect(await get(other)).toBeNull()
  await expect(get(guest)).rejects.toThrow('not_registered')
  await expect(save(guest, 0, 'invitado')).rejects.toThrow('not_registered')
  expect(await t.admin(`select relname from pg_class where oid in ('pwt.tower_runs'::regclass, 'pwt.tower_operations'::regclass) and not relrowsecurity`)).toEqual([])
  expect(await t.admin(`select * from information_schema.role_table_grants where table_schema = 'pwt'
    and table_name in ('tower_runs', 'tower_operations') and grantee in ('anon', 'authenticated', 'PUBLIC')`)).toEqual([])
})
