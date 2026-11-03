// UT-140 · Aviso por Discord (RF-115 a RF-119, DEC-77): migración `20261103000000_pwt_aviso_discord.sql` sobre PGlite.
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type Caller, type TestDb } from './testDb'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
}, 60_000)

let discordCounter = 0

/** Jugador con cuenta y Discord vinculado, con la hora del aviso en UTC. */
async function linked(minute = 1200, user?: Caller & object) {
  const player = user ?? (await t.user())
  const state = await t.call<string>(player, `select pwt.discord_link_start('UTC')`)
  discordCounter += 1
  await t.admin(`select pwt.discord_link_finish($1, $2, 'jose')`, [state, String(100 + discordCounter)])
  await t.as(player, `select pwt.set_discord_reminder(true, $1, 'UTC')`, [minute])
  return player
}

/** Media hora de UTC en curso (la del aviso «ahora») y la de dentro de `hours` horas. */
async function utcSlot(hours = 0): Promise<number> {
  const [{ minute }] = await t.admin<{ minute: number }>(
    `select ((extract(hour from now() at time zone 'UTC') * 60 + extract(minute from now() at time zone 'UTC'))::integer / 30 * 30) as minute`,
  )
  return (minute + hours * 60) % 1440
}

const due = async () => (await t.admin<{ user_id: string }>(`select user_id from pwt.discord_due_reminders()`)).map((row) => row.user_id)

describe('aviso por Discord (UT-140)', () => {
  it('vincula con el state una sola vez; sin cuenta no se empieza y un state inventado no vale', async () => {
    const player = await t.user()
    const state = await t.call<string>(player, `select pwt.discord_link_start('Europe/Madrid')`)
    expect(state).toMatch(/^[0-9a-f]{64}$/)
    await t.admin(`select pwt.discord_link_finish($1, '42', 'jose')`, [state])
    expect(await t.call(player, `select pwt.discord_reminder()`)).toEqual({ name: 'jose', enabled: true, minute: 1200, timeZone: 'Europe/Madrid', failed: false })
    await expect(t.admin(`select pwt.discord_link_finish($1, '42', 'jose')`, [state])).rejects.toThrow('invalid_state')
    await expect(t.admin(`select pwt.discord_link_finish('inventado', '42', 'jose')`)).rejects.toThrow('invalid_state')
    await expect(t.as(await t.user(true), `select pwt.discord_link_start('UTC')`)).rejects.toThrow('not_registered')
    await expect(t.as(player, `select pwt.discord_link_start('Marte/Olimpo')`)).rejects.toThrow('invalid_time_zone')
  })

  it('un state caducado no vale; la misma cuenta de Discord en otro jugador se quita del anterior', async () => {
    const player = await t.user()
    const state = await t.call<string>(player, `select pwt.discord_link_start('UTC')`)
    await t.admin(`update pwt.discord_link_states set expires_at = now() - interval '1 second' where state = $1`, [state])
    await expect(t.admin(`select pwt.discord_link_finish($1, '7', 'ana')`, [state])).rejects.toThrow('invalid_state')

    const first = await t.user()
    const second = await t.user()
    await t.admin(`select pwt.discord_link_finish($1, '7', 'ana')`, [await t.call<string>(first, `select pwt.discord_link_start('UTC')`)])
    await t.admin(`select pwt.discord_link_finish($1, '7', 'ana')`, [await t.call<string>(second, `select pwt.discord_link_start('UTC')`)])
    expect(await t.call(first, `select pwt.discord_reminder()`)).toBeNull()
    expect(await t.call(second, `select pwt.discord_reminder()`)).toMatchObject({ name: 'ana' })
  })

  it('cambia la hora (de media en media hora) y el interruptor; desvincular lo borra', async () => {
    const player = await linked()
    await t.as(player, `select pwt.set_discord_reminder(false, 450, 'America/Mexico_City')`)
    expect(await t.call(player, `select pwt.discord_reminder()`)).toMatchObject({ enabled: false, minute: 450, timeZone: 'America/Mexico_City' })
    await expect(t.as(player, `select pwt.set_discord_reminder(true, 451, 'UTC')`)).rejects.toThrow('invalid_reminder')
    await expect(t.as(player, `select pwt.set_discord_reminder(true, 1440, 'UTC')`)).rejects.toThrow('invalid_reminder')
    await t.as(player, `select pwt.discord_unlink()`)
    expect(await t.call(player, `select pwt.discord_reminder()`)).toBeNull()
    await expect(t.as(player, `select pwt.set_discord_reminder(true, 450, 'UTC')`)).rejects.toThrow('not_linked')
  })

  it('avisa a su hora a quien no ha empezado el oficial de hoy, una sola vez; no a otra hora, desactivado ni tras jugar', async () => {
    const now = await utcSlot()
    const waiting = await linked(now)
    const later = await linked(await utcSlot(3))
    const off = await linked(now)
    await t.as(off, `select pwt.set_discord_reminder(false, $1, 'UTC')`, [now])
    const played = await linked(now)
    await t.call(played, `select pwt.start_official($1::date, 7, 'misty', 'misty-1', 'v1', 'seed', 'heuristic', 0, 6, 6)`, [t.today])

    const first = await due()
    expect(first).toContain(waiting.id)
    expect(first).not.toContain(later.id)
    expect(first).not.toContain(off.id)
    expect(first).not.toContain(played.id)
    expect(await due()).not.toContain(waiting.id)

    // Pasadas 20 horas vuelve a tocar (al día siguiente, a la misma hora).
    await t.admin(`update pwt.discord_links set last_sent_at = now() - interval '21 hours' where user_id = $1`, [waiting.id])
    expect(await due()).toContain(waiting.id)
  })

  it('apunta si el mensaje no llegó y lo quita al llegar uno', async () => {
    const player = await linked()
    await t.admin(`select pwt.discord_report($1, false)`, [player.id])
    expect(await t.call(player, `select pwt.discord_reminder()`)).toMatchObject({ failed: true })
    await t.admin(`select pwt.discord_report($1, true)`, [player.id])
    expect(await t.call(player, `select pwt.discord_reminder()`)).toMatchObject({ failed: false })
  })

  it('lo de la Edge Function no se llama desde la API y las tablas no se leen', async () => {
    const player = await linked()
    await expect(t.as(player, `select pwt.discord_link_finish('x', '1', 'y')`)).rejects.toThrow()
    await expect(t.as(player, `select * from pwt.discord_due_reminders()`)).rejects.toThrow()
    await expect(t.as(player, `select pwt.discord_report($1, true)`, [player.id])).rejects.toThrow()
    await expect(t.as(player, `select pwt.discord_ping()`)).rejects.toThrow()
    await expect(t.as(player, `select * from pwt.discord_links`)).rejects.toThrow()
    await expect(t.as(null, `select pwt.discord_reminder()`)).rejects.toThrow()
  })
})
