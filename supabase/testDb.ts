import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS = join(import.meta.dirname, 'migrations')

/**
 * Lo mínimo de Supabase que usan las migraciones: los roles `anon` y `authenticated`, `auth.users` y `auth.uid()` / `auth.jwt()`, que en
 * Supabase leen el JWT de la petición de `request.jwt.claims` (aquí se pone a mano con `as`).
 */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt() ->> 'sub')::uuid $$;
`

export type Caller = { id: string; anonymous?: boolean } | null

export type TestDb = {
  db: PGlite
  /** Crea un usuario de `auth.users` y lo devuelve. */
  user: (anonymous?: boolean) => Promise<{ id: string; anonymous: boolean }>
  /** Ejecuta una consulta como lo haría la API de Supabase: rol `authenticated` (o `anon` sin sesión) y el JWT de `caller`. */
  as: <T = Record<string, unknown>>(caller: Caller, sql: string, params?: unknown[]) => Promise<T[]>
  /** Primera columna de la primera fila de `as`. */
  call: <T = unknown>(caller: Caller, sql: string, params?: unknown[]) => Promise<T>
  /** Como superusuario (preparar datos que la API no deja escribir: días pasados, cierres). */
  admin: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
  today: string
}

let counter = 0

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }

  async function as<T>(caller: Caller, sql: string, params: unknown[] = []): Promise<T[]> {
    return db.transaction(async (tx) => {
      const claims = caller ? JSON.stringify({ sub: caller.id, is_anonymous: caller.anonymous ?? false }) : ''
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
      await tx.exec(`set local role ${caller ? 'authenticated' : 'anon'}`)
      return (await tx.query<T>(sql, params)).rows
    })
  }

  const admin = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => (await db.query<T>(sql, params)).rows
  const [{ today }] = await admin<{ today: string }>(`select pwt.madrid_today()::text as today`)

  return {
    db,
    today,
    as,
    admin,
    async call<T>(caller: Caller, sql: string, params: unknown[] = []): Promise<T> {
      const [row] = await as<Record<string, T>>(caller, sql, params)
      return Object.values(row)[0]
    },
    async user(anonymous = false) {
      counter += 1
      const id = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
      await admin(`insert into auth.users (id) values ($1)`, [id])
      return { id, anonymous }
    },
  }
}
