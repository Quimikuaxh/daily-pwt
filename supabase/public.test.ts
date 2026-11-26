// UT-253 · `public` cerrado a la clave pública (DEC-63): migración `20261126010000_pwt_public_cerrado.sql` sobre PGlite.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './testDb'

const MIGRATION = readFileSync(join(import.meta.dirname, 'migrations', '20261126010000_pwt_public_cerrado.sql'), 'utf8')

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
}, 60_000)

const user = { id: '00000000-0000-4000-8000-000000009999' }

describe('public cerrado a anon y authenticated (UT-253)', () => {
  it('quita los permisos de las tablas existentes y las nuevas no nacen abiertas, aunque no tengan RLS', async () => {
    // Como en Supabase: permisos por defecto que lo conceden todo a la clave pública, y una tabla de otra app sin RLS.
    await t.db.exec(`
      alter default privileges in schema public grant all on tables to anon, authenticated;
      alter default privileges in schema public grant all on sequences to anon, authenticated;
      create table public.otra_app_vieja (id serial primary key, dato text);
      insert into public.otra_app_vieja (dato) values ('privado');
    `)
    expect(await t.as(null, `select dato from public.otra_app_vieja`)).toEqual([{ dato: 'privado' }])

    await t.db.exec(MIGRATION)
    await t.db.exec(`create table public.otra_app_nueva (id serial primary key, dato text); insert into public.otra_app_nueva (dato) values ('privado');`)

    for (const table of ['otra_app_vieja', 'otra_app_nueva']) {
      for (const caller of [null, user]) {
        await expect(t.as(caller, `select * from public.${table}`)).rejects.toThrow('permission denied')
        await expect(t.as(caller, `insert into public.${table} (dato) values ('x')`)).rejects.toThrow('permission denied')
        await expect(t.as(caller, `truncate public.${table}`)).rejects.toThrow('permission denied')
      }
    }
    // El propietario (como claude-test por conexión directa) sigue leyendo.
    expect(await t.admin(`select dato from public.otra_app_nueva`)).toEqual([{ dato: 'privado' }])
  })

  it('no toca pwt: la API sigue funcionando como antes', async () => {
    const player = await t.user()
    const profile = await t.call<{ created: boolean }>(player, `select pwt.ensure_profile()`)
    expect(profile).toMatchObject({ created: true })
  })
})
