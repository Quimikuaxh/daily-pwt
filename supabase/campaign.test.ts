import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type Caller, type TestDb } from './testDb'

let t: TestDb
const migration = readFileSync(new URL('./migrations/20261111000000_pwt_campaign.sql', import.meta.url), 'utf8')
beforeAll(async () => { t = await createTestDb() }, 60_000)
afterAll(async () => { await t?.db.close() })

const save = (who: Caller, revision: number | null, op = randomUUID(), version: number | null = 1,
  state: unknown = { seed: 'campaign' }, battle: unknown = null) =>
  t.call(who, 'select pwt.save_campaign($1, $2, $3, $4::jsonb, $5::jsonb)',
    [revision, op, version, JSON.stringify(state), JSON.stringify(battle)])
const load = (who: Caller) => t.call(who, 'select pwt.get_campaign()')

describe('D4(a): contrato SQL de campaña', () => {
  it('ejecuta el mismo SQL de aislamiento y RLS destinado a Supabase local', async () => {
    await t.db.exec(readFileSync(new URL('./tests/campaign.test.sql', import.meta.url), 'utf8'))
  })

  it('la migración se puede reaplicar sin perder campaña ni recibos', async () => {
    const who = await t.user()
    const op = randomUUID()
    const receipt = await save(who, 0, op)
    await t.db.exec(migration)
    expect(await load(who)).toMatchObject({ revision: 1, state: { seed: 'campaign' } })
    expect(await save(who, 0, op)).toEqual(receipt)
  })

  it('oferta, elección, alineación y decisiones se conservan en un único registro versionado', async () => {
    const who = await t.user()
    const state = { offer: ['a', 'b', 'c', 'd'], choice: 'a', lineup: ['member-1'] }
    const battle = { decisions: [{ type: 'move', slot: 1 }], preparation: { seed: 'x' } }
    await save(who, 0, randomUUID(), 1, state)
    await save(who, 1, randomUUID(), 1, state, battle)
    expect(await load(who)).toEqual({ version: 1, revision: 2, state, battle })
    await save(who, 2, randomUUID(), 1, { ...state, completed: true })
    expect(await load(who)).toEqual({ version: 1, revision: 3, state: { ...state, completed: true }, battle: null })
  })

  it('dos creaciones desde revisión cero o dos escrituras desde la misma revisión no se pisan', async () => {
    const who = await t.user()
    await save(who, 0)
    await expect(save(who, 0)).rejects.toThrow('campaign_revision_conflict')
    await save(who, 1)
    await expect(save(who, 1)).rejects.toThrow('campaign_revision_conflict')
    expect(await load(who)).toMatchObject({ revision: 2 })
    expect(await t.admin('select * from pwt.campaign_operations where user_id = $1', [who.id])).toHaveLength(2)
  })

  it('reintentos comparan JSON por contenido y rechazan reutilizar un ID con otra intención', async () => {
    const who = await t.user()
    const op = randomUUID()
    const receipt = await save(who, 0, op, 1, { a: 1, b: 2 })
    expect(await save(who, 0, op, 1, { b: 2, a: 1 })).toEqual(receipt)
    await expect(save(who, 1, op, 1, { a: 1, b: 2 })).rejects.toThrow('campaign_operation_reused')
    await expect(save(who, 0, op, 1, { a: 2, b: 2 })).rejects.toThrow('campaign_operation_reused')
    await expect(save(who, 0, op, 1, { a: 1, b: 2 }, {})).rejects.toThrow('campaign_operation_reused')
  })

  it.each([
    [null, 1, {}, null], [-1, 1, {}, null], [9007199254740991, 1, {}, null],
    [0, null, {}, null], [0, 2, {}, null], [0, 1, null, null], [0, 1, [], null],
    [0, 1, {}, []], [0, 1, {}, 'bad'],
  ])('rechaza formato inválido sin escribir (%j, %j, %j, %j)', async (revision, version, state, battle) => {
    const who = await t.user()
    await expect(save(who, revision as number | null, randomUUID(), version as number | null, state, battle)).rejects.toThrow('invalid_campaign')
    expect(await load(who)).toBeNull()
    expect(await t.admin('select * from pwt.campaign_operations where user_id = $1', [who.id])).toHaveLength(0)
  })

  it('rechaza identificadores nulos y parámetros SQL nulos', async () => {
    const who = await t.user()
    await expect(t.call(who, "select pwt.save_campaign(0, null, 1, '{}', null)")).rejects.toThrow('invalid_campaign')
    await expect(t.call(who, 'select pwt.save_campaign(0, $1, 1, null, null)', [randomUUID()])).rejects.toThrow('invalid_campaign')
  })

  it('rechaza JWT sin usuario y sesiones anónimas aunque tengan rol authenticated', async () => {
    await expect(t.db.transaction(async (tx) => {
      await tx.exec(`set local role authenticated; select set_config('request.jwt.claims', '{}', true)`)
      await tx.query('select pwt.get_campaign()')
    })).rejects.toThrow('not_registered')
    await expect(save(await t.user(true), 0)).rejects.toThrow('not_registered')
    await expect(load(await t.user(true))).rejects.toThrow('not_registered')
  })

  it('audita RLS, privilegios directos y ejecución de RPC', async () => {
    expect(await t.admin(`select relname, relrowsecurity from pg_class where oid in ('pwt.campaigns'::regclass, 'pwt.campaign_operations'::regclass) order by relname`))
      .toEqual([{ relname: 'campaign_operations', relrowsecurity: true }, { relname: 'campaigns', relrowsecurity: true }])
    expect(await t.admin(`select * from information_schema.role_table_grants where table_schema = 'pwt'
      and table_name in ('campaigns', 'campaign_operations') and grantee in ('anon', 'authenticated', 'PUBLIC')`)).toEqual([])
    expect(await t.admin(`select proname from pg_proc where oid in ('pwt.get_campaign()'::regprocedure,
      'pwt.save_campaign(bigint,uuid,integer,jsonb,jsonb)'::regprocedure) and
      (not prosecdef or proconfig <> array['search_path=""'] or has_function_privilege('anon', oid, 'execute'))`)).toEqual([])
  })
})
