// UT-90 a UT-96 y UT-112 · F4 (REQUISITOS-F4, DEC-63): la migración del esquema `pwt` sobre PGlite, con `auth` simulado.
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type Caller, type TestDb } from './testDb'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
}, 60_000)

const START = `select pwt.start_official($1::date, 7, 'misty', 'misty-1', 'v1', 'seed', 'heuristic', 0, 6, 6)`
const move = (slot: number) => ({ type: 'move', slot })
const decisions = (count: number) => JSON.stringify(Array.from({ length: count }, (_, index) => move(index % 4)))
const fainted = (lost: number) => `{${Array.from({ length: 6 }, (_, index) => (index < lost ? 'true' : 'false')).join(',')}}`

async function play(caller: Caller, date: string, result: 'win' | 'loss', survivors: number) {
  await t.call(caller, START, [date])
  await t.as(caller, `select pwt.save_turn($1::date, $2::jsonb, 1, 6, 6)`, [date, decisions(1)])
  await t.as(caller, `select pwt.save_turn($1::date, $2::jsonb, 2, $3, $4)`, [date, decisions(2), survivors, result === 'win' ? 1 : 6])
  return t.call<{ validated: boolean }>(caller, `select pwt.finish_official($1::date, $2, 'faint', 3, $3, $4::boolean[], $5, $6::jsonb)`, [
    date, result, survivors, fainted(6 - survivors), result === 'win' ? 6 : 2, decisions(3),
  ])
}

type RankingPage = { page: number; pages: number; total: number; myPage: number | null; rows: Array<Record<string, unknown>> }
const pointsPage = (caller: Caller, month: string, scope: string, page: number | null = null, size = 20) =>
  t.call<RankingPage>(caller, `select pwt.points_ranking_page($1::date, $2, $3, $4)`, [month, scope, page, size])

/** Día ya terminado y validado, escrito a mano (la API solo deja empezar el de hoy). */
async function seedDay(user: string, date: string, status: 'won' | 'lost' | 'void', survivors: number, extra: { validated?: boolean; imported?: boolean } = {}) {
  await t.admin(
    `insert into pwt.day_results (user_id, date, challenge_number, trainer_id, variant_id, data_version, status, started_at, finished_at, survivors, validated, imported)
     values ($1, $2::date, 1, 'misty', 'misty-1', 'v1', $3, now(), now(), $4, $5, $6)`,
    [user, date, status, survivors, extra.validated ?? true, extra.imported ?? false],
  )
}

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

describe('perfil y nickname (UT-90)', () => {
  it('crea el perfil con un nickname provisional y no lo repite', async () => {
    const user = await t.user()
    const first = await t.call<{ nickname: string; created: boolean }>(user, `select pwt.ensure_profile()`)
    expect(first).toMatchObject({ created: true, registered: true })
    expect(first.nickname).toMatch(/^entrenador_\d{5}$/)
    expect(await t.call(user, `select pwt.ensure_profile()`)).toEqual({ nickname: first.nickname, created: false, registered: true })
  })

  it('sin cuenta también hay perfil y nombre propio; al enlazar Google se conserva y pasa a registrado (RF-94, RF-104b)', async () => {
    const anonymous = await t.user(true)
    expect(await t.call(anonymous, `select pwt.ensure_profile()`)).toMatchObject({ created: true, registered: false })
    expect(await t.call(anonymous, `select pwt.set_nickname('Invitado_1')`)).toBe('Invitado_1')
    const linked = { ...anonymous, anonymous: false }
    expect(await t.call(linked, `select pwt.ensure_profile()`)).toEqual({ nickname: 'Invitado_1', created: false, registered: true })
  })

  it('nadie puede coger un nombre ya cogido, tampoco el de un jugador sin cuenta (RF-95)', async () => {
    const [guest, member] = [await t.user(true), await t.user()]
    await t.call(guest, `select pwt.ensure_profile()`)
    await t.call(member, `select pwt.ensure_profile()`)
    await t.call(guest, `select pwt.set_nickname('Libre_99')`)
    await expect(t.call(member, `select pwt.set_nickname('libre_99')`)).rejects.toThrow('nickname_taken')
    await t.call(member, `select pwt.set_nickname('Socio_99')`)
    await expect(t.call(guest, `select pwt.set_nickname('SOCIO_99')`)).rejects.toThrow('nickname_taken')
  })

  it('RF-113: el nombre de un jugador sin cuenta se libera a los 30 días sin jugar; si vuelve, recibe otro', async () => {
    const [idle, playing, member] = [await t.user(true), await t.user(true), await t.user()]
    for (const [player, name] of [[idle, 'Dormido'], [playing, 'Activo'], [member, 'Socio_viejo']] as const) {
      await t.call(player, `select pwt.ensure_profile()`)
      await t.call(player, `select pwt.set_nickname($1)`, [name])
    }
    await t.admin(`update pwt.profiles set last_active_at = now() - interval '31 days' where id = any($1::uuid[])`, [[idle.id, playing.id, member.id]])
    await t.call(playing, START, [t.today])
    expect(await t.admin(`select pwt.release_idle_nicknames() as released`)).toEqual([{ released: 1 }])
    const names = await t.admin(`select id, nickname from pwt.profiles where id = any($1::uuid[]) order by nickname nulls first`, [[idle.id, playing.id, member.id]])
    expect(names).toEqual([{ id: idle.id, nickname: null }, { id: playing.id, nickname: 'Activo' }, { id: member.id, nickname: 'Socio_viejo' }])
    expect(await t.call(member, `select pwt.set_nickname('dormido')`)).toBe('dormido')
    expect(await t.call<{ nickname: string; created: boolean }>(idle, `select pwt.ensure_profile()`)).toMatchObject({ created: true, nickname: expect.stringMatching(/^entrenador_\d{5}$/) })
  })

  it('nickname único sin distinguir mayúsculas, se guarda tal cual y el anterior queda libre', async () => {
    const [first, second] = [await t.user(), await t.user()]
    await t.call(first, `select pwt.ensure_profile()`)
    await t.call(second, `select pwt.ensure_profile()`)
    expect(await t.call(first, `select pwt.set_nickname('Jose_01')`)).toBe('Jose_01')
    await expect(t.call(second, `select pwt.set_nickname('jose_01')`)).rejects.toThrow('nickname_taken')
    await t.call(first, `select pwt.set_nickname('JOSE_01')`)
    await t.call(first, `select pwt.set_nickname('Otro')`)
    expect(await t.call(second, `select pwt.set_nickname('jose_01')`)).toBe('jose_01')
  })

  it.each(['ab', 'a'.repeat(17), 'José', 'con espacio', 'guion-medio'])('rechaza el nickname «%s» (RF-95)', async (nickname) => {
    const user = await t.user()
    await t.call(user, `select pwt.ensure_profile()`)
    await expect(t.call(user, `select pwt.set_nickname($1)`, [nickname])).rejects.toThrow('invalid_nickname')
  })
})

describe('oficial del día y validación por estados (UT-91)', () => {
  it('uno por día y cuenta: el segundo intento devuelve el que hay, con lo necesario para reanudarlo en otro dispositivo', async () => {
    const user = await t.user()
    expect(await t.call(user, START, [t.today])).toMatchObject({ created: true })
    await t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 1, 6, 5)`, [t.today, decisions(1)])
    const again = await t.call<{ created: boolean; day: Record<string, any> }>(user, START, [t.today])
    expect(again.created).toBe(false)
    expect(again.day).toMatchObject({ status: 'inProgress', trainerId: 'misty', battle: { seed: 'seed', ai: 'heuristic', leadIndex: 0, decisions: [move(0)], checkpoint: { decisions: 1, turn: 1, playerRemaining: 6, rivalRemaining: 5 } } })
  })

  it('solo se puede empezar el reto de hoy (Madrid)', async () => {
    const user = await t.user()
    await expect(t.call(user, START, [addDays(t.today, -1)])).rejects.toThrow('wrong_date')
    await expect(t.call(user, START, [addDays(t.today, 1)])).rejects.toThrow('wrong_date')
  })

  it('sin sesión no se puede jugar el oficial en la base de datos', async () => {
    await expect(t.call(null, START, [t.today])).rejects.toThrow()
  })

  it('el estado solo avanza: decisiones que crecen y empiezan por las guardadas, turno que no retrocede, nadie revive', async () => {
    const user = await t.user()
    await t.call(user, START, [t.today])
    await t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 2, 5, 4)`, [t.today, decisions(2)])
    await expect(t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 2, 5, 4)`, [t.today, decisions(2)])).rejects.toThrow('stale_turn')
    await expect(t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 3, 5, 4)`, [t.today, JSON.stringify([move(3), move(3), move(3)])])).rejects.toThrow('decisions_mismatch')
    await expect(t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 1, 5, 4)`, [t.today, decisions(3)])).rejects.toThrow('incoherent_state')
    await expect(t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 3, 6, 4)`, [t.today, decisions(3)])).rejects.toThrow('incoherent_state')
    await t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 2, 5, 3)`, [t.today, decisions(3)])
  })

  it('un resultado coherente se valida y el estado se borra', async () => {
    const user = await t.user()
    expect(await play(user, t.today, 'win', 4)).toEqual({ validated: true })
    expect(await t.admin(`select 1 from pwt.battle_states where user_id = $1`, [user.id])).toHaveLength(0)
    const [day] = await t.admin(`select status, survivors, validated from pwt.day_results where user_id = $1`, [user.id])
    expect(day).toEqual({ status: 'won', survivors: 4, validated: true })
  })

  it.each([
    ['sin estados guardados', null, `select pwt.finish_official($1::date, 'win', 'faint', 1, 6, $2::boolean[], 6, $3::jsonb)`, [fainted(0), decisions(1)]],
    ['más supervivientes que en el último estado', 3, `select pwt.finish_official($1::date, 'win', 'faint', 3, 4, $2::boolean[], 6, $3::jsonb)`, [fainted(2), decisions(3)]],
    ['un turno que no sigue al último', 3, `select pwt.finish_official($1::date, 'win', 'faint', 9, 3, $2::boolean[], 6, $3::jsonb)`, [fainted(3), decisions(3)]],
    ['victoria sin debilitar a todo el rival', 3, `select pwt.finish_official($1::date, 'win', 'faint', 3, 3, $2::boolean[], 5, $3::jsonb)`, [fainted(3), decisions(3)]],
    ['decisiones distintas de las guardadas', 3, `select pwt.finish_official($1::date, 'win', 'faint', 3, 3, $2::boolean[], 6, $3::jsonb)`, [fainted(3), JSON.stringify([move(3), move(3), move(3)])]],
    ['casillas que no cuadran con los supervivientes', 3, `select pwt.finish_official($1::date, 'win', 'faint', 3, 3, $2::boolean[], 6, $3::jsonb)`, [fainted(1), decisions(3)]],
  ])('no valida un resultado incoherente: %s', async (_name, remaining, sql, params) => {
    const user = await t.user()
    await t.call(user, START, [t.today])
    if (remaining !== null) await t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 2, $3, 1)`, [t.today, decisions(2), remaining])
    expect(await t.call(user, sql, [t.today, ...params])).toEqual({ validated: false })
    const [day] = await t.admin(`select status, validated from pwt.day_results where user_id = $1`, [user.id])
    expect(day).toEqual({ status: 'won', validated: false })
  })

  it('rendirse con Pokémon en pie es una derrota coherente (0 puntos)', async () => {
    const user = await t.user()
    await t.call(user, START, [t.today])
    await t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 2, 4, 3)`, [t.today, decisions(2)])
    const result = await t.call(user, `select pwt.finish_official($1::date, 'loss', 'forfeit', 2, 4, $2::boolean[], 3, $3::jsonb)`, [
      t.today, fainted(2), JSON.stringify([move(0), move(1), { type: 'forfeit' }]),
    ])
    expect(result).toEqual({ validated: true })
  })

  it('terminado o anulado, no se puede volver a terminar ni guardar turnos', async () => {
    const user = await t.user()
    await play(user, t.today, 'loss', 0)
    await expect(t.as(user, `select pwt.save_turn($1::date, $2::jsonb, 9, 0, 0)`, [t.today, decisions(9)])).rejects.toThrow('no_battle')
    await expect(play(user, t.today, 'win', 6)).rejects.toThrow()
    const other = await t.user()
    await t.call(other, START, [t.today])
    await t.as(other, `select pwt.void_official($1::date, 'replayFailed')`, [t.today])
    await expect(t.as(other, `select pwt.void_official($1::date, 'replayFailed')`, [t.today])).rejects.toThrow('not_in_progress')
  })

  it('cada usuario solo toca su oficial', async () => {
    const [owner, intruder] = [await t.user(), await t.user()]
    await t.call(owner, START, [t.today])
    await expect(t.as(intruder, `select pwt.save_turn($1::date, $2::jsonb, 1, 6, 6)`, [t.today, decisions(1)])).rejects.toThrow('no_battle')
    await expect(t.as(intruder, `select * from pwt.day_results`)).rejects.toThrow()
    await expect(t.as(intruder, `select * from pwt.battle_states`)).rejects.toThrow()
  })
})

describe('oficial sin terminar a medianoche (UT-112, RF-80b)', () => {
  /** Oficial empezado hoy y movido a `date` (la API solo deja empezar el de hoy). */
  async function startedOn(user: Caller & object, date: string, turns: number) {
    await t.call(user, START, [t.today])
    if (turns > 0) await t.as(user, `select pwt.save_turn($1::date, $2::jsonb, $3, 4, 2)`, [t.today, decisions(turns), turns])
    await t.admin(`update pwt.day_results set date = $2::date where user_id = $1 and date = $3::date`, [user.id, date, t.today])
  }

  it('el cierre lo pasa a derrota con el último estado y cuenta en la media si se jugó algún turno; ya no admite turnos ni resultado', async () => {
    const date = addDays(t.today, -60)
    const [played, untouched, winner] = [await t.user(), await t.user(), await t.user()]
    await startedOn(played, date, 3)
    await startedOn(untouched, date, 0)
    await seedDay(winner.id, date, 'won', 6)
    await expect(t.as(played, `select pwt.save_turn($1::date, $2::jsonb, 4, 4, 2)`, [date, decisions(4)])).rejects.toThrow('day_closed')
    await expect(t.call(played, `select pwt.finish_official($1::date, 'win', 'faint', 4, 4, $2::boolean[], 6, $3::jsonb)`, [date, fainted(2), decisions(4)])).rejects.toThrow('day_closed')
    await expect(t.as(played, `select pwt.void_official($1::date, 'replayFailed')`, [date])).rejects.toThrow('day_closed')
    await t.admin(`select pwt.close_days()`)
    const days = await t.admin(`select user_id, status, end_reason, turns, survivors, rival_fainted, validated from pwt.day_results where date = $1::date order by status, validated desc`, [date])
    expect(days).toEqual([
      { user_id: played.id, status: 'lost', end_reason: 'expired', turns: 3, survivors: 4, rival_fainted: 4, validated: true },
      { user_id: untouched.id, status: 'lost', end_reason: 'expired', turns: 0, survivors: 6, rival_fainted: 0, validated: false },
      { user_id: winner.id, status: 'won', end_reason: null, turns: null, survivors: 6, rival_fainted: null, validated: true },
    ])
    expect(await t.admin(`select 1 from pwt.battle_states where date = $1::date`, [date])).toHaveLength(0)
    // Media (6 + 0) / 2 = 3 → ×1,5: el que no llegó a jugar no cuenta.
    expect(await t.admin(`select players, multiplier::float from pwt.day_difficulty where date = $1::date`, [date])).toEqual([{ players: 2, multiplier: 1.5 }])
  })

  it('el oficial de hoy en curso no se toca', async () => {
    const user = await t.user()
    await t.call(user, START, [t.today])
    await t.admin(`select pwt.close_days()`)
    expect(await t.admin(`select status from pwt.day_results where user_id = $1`, [user.id])).toEqual([{ status: 'inProgress' }])
  })
})

describe('historial de la cuenta (UT-92)', () => {
  it('importa los días terminados que la cuenta no tiene, marcados como importados; si ya lo tiene, manda la cuenta', async () => {
    const user = await t.user()
    const yesterday = addDays(t.today, -1)
    await seedDay(user.id, yesterday, 'won', 5)
    const local = (date: string, status: string) => ({ date, challengeNumber: 1, trainerId: 'brock', variantId: 'brock-1', dataVersion: 'v1', status, startedAt: '2026-10-01T10:00:00Z', finishedAt: '2026-10-01T10:10:00Z', turns: 12, survivors: 2, playerFainted: [true, true, true, true, false, false], rivalFainted: 6, endReason: 'faint', voidReason: null })
    const imported = await t.call(user, `select pwt.import_days($1::jsonb)`, [
      JSON.stringify([local(yesterday, 'lost'), local(addDays(t.today, -2), 'won'), local(addDays(t.today, -3), 'inProgress'), local(addDays(t.today, 1), 'won')]),
    ])
    expect(imported).toBe(1)
    const days = await t.call<Array<Record<string, unknown>>>(user, `select pwt.my_days()`)
    expect(days.map((day) => [day.date, day.status, day.imported, day.validated])).toEqual([
      [addDays(t.today, -2), 'won', true, false],
      [yesterday, 'won', false, true],
    ])
  })

  it('una sesión anónima no importa', async () => {
    await expect(t.call(await t.user(true), `select pwt.import_days('[]'::jsonb)`)).rejects.toThrow('not_registered')
  })
})

describe('puntos y multiplicador del día (UT-93)', () => {
  it('puntos = supervivientes × (1 + (6 − media)/6), solo cuando el día está cerrado; derrotas y anónimos entran en la media', async () => {
    const date = addDays(t.today, -40)
    const [first, second, anonymous, importedUser, voided] = [await t.user(), await t.user(), await t.user(true), await t.user(), await t.user()]
    await seedDay(first.id, date, 'won', 6)
    await seedDay(second.id, date, 'won', 3)
    await seedDay(anonymous.id, date, 'lost', 0)
    await seedDay(importedUser.id, date, 'won', 6, { validated: false, imported: true })
    await seedDay(voided.id, date, 'void', 0, { validated: false })
    // Sin cerrar, el día no tiene puntos (solo se dan los definitivos).
    expect(await t.admin(`select * from pwt.day_points($1::date, $1::date)`, [date])).toEqual([])
    expect(await t.admin(`select pwt.close_days() > 0 as closed`)).toEqual([{ closed: true }])
    // Media (6 + 3 + 0) / 3 = 3 → ×1,5.
    const closedPoints = await t.admin(`select user_id, points::float, provisional from pwt.day_points($1::date, $1::date) order by points desc`, [date])
    expect(closedPoints).toEqual([
      { user_id: first.id, points: 9, provisional: false },
      { user_id: second.id, points: 4.5, provisional: false },
      { user_id: anonymous.id, points: 0, provisional: false },
    ])
    expect(await t.admin(`select players, average::float, multiplier::float from pwt.day_difficulty where date = $1::date`, [date])).toEqual([{ players: 3, average: 3, multiplier: 1.5 }])
    // Un oficial terminado tras el cierre puntúa con el multiplicador fijado y no lo cambia.
    const late = await t.user()
    await seedDay(late.id, date, 'won', 2)
    await t.admin(`select pwt.close_days()`)
    const after = await t.admin(`select points::float, provisional from pwt.day_points($1::date, $1::date) where user_id = $2`, [date, late.id])
    expect(after).toEqual([{ points: 3, provisional: false }])
    expect(await t.admin(`select multiplier::float from pwt.day_difficulty where date = $1::date`, [date])).toEqual([{ multiplier: 1.5 }])
  })

  it('el día de hoy no se cierra; con todos a 6 el multiplicador es ×1 y con media 0, ×2', async () => {
    expect(await t.admin(`select pwt.multiplier_of(6)::float as top, pwt.multiplier_of(0)::float as bottom`)).toEqual([{ top: 1, bottom: 2 }])
    await t.admin(`select pwt.close_days()`)
    expect(await t.admin(`select 1 from pwt.day_difficulty where date = $1::date`, [t.today])).toHaveLength(0)
  })
})

describe('rankings (UT-94)', () => {
  it('puntos del mes: suma del mes natural, empate compartido, vista de amigos y posición propia fuera del top', async () => {
    const month = addDays(t.today, -400).slice(0, 8) + '01'
    const day = (offset: number) => addDays(month, offset)
    const players = [await t.user(), await t.user(), await t.user(), await t.user()]
    const names = ['Ana', 'Bea', 'Carla', 'Dani']
    for (const [index, player] of players.entries()) {
      await t.call(player, `select pwt.ensure_profile()`)
      await t.call(player, `select pwt.set_nickname($1)`, [names[index]])
    }
    // Día 1: 6, 6, 3, 3 → media 4,5 → ×1,25. Día 2 (Dani juega solo): 6 → ×1.
    await seedDay(players[0].id, day(0), 'won', 6)
    await seedDay(players[1].id, day(0), 'won', 6)
    await seedDay(players[2].id, day(0), 'won', 3)
    await seedDay(players[3].id, day(0), 'won', 3)
    await seedDay(players[3].id, day(1), 'won', 6)
    // El mes siguiente no cuenta.
    await seedDay(players[2].id, addDays(month, 40), 'won', 6)
    // Sin cuenta también salen (RF-112): uno con nombre (día 3, solo, 6 → ×1) y uno con el nombre liberado (día 4, solo, 3 → ×1,5).
    const [guest, released] = [await t.user(true), await t.user(true)]
    for (const player of [guest, released]) await t.call(player, `select pwt.ensure_profile()`)
    await t.call(guest, `select pwt.set_nickname('Invi')`)
    await t.admin(`update pwt.profiles set nickname = null where id = $1`, [released.id])
    await seedDay(guest.id, day(2), 'won', 6)
    await seedDay(released.id, day(3), 'won', 3)
    await t.admin(`select pwt.close_days()`)

    const global = await pointsPage(players[3], day(10), 'global')
    expect(global).toMatchObject({ page: 1, pages: 1, total: 6, myPage: 1 })
    expect(global.rows).toEqual([
      { rank: 1, nickname: 'Dani', verified: true, points: 9.75, me: true },
      { rank: 2, nickname: 'Ana', verified: true, points: 7.5, me: false },
      { rank: 2, nickname: 'Bea', verified: true, points: 7.5, me: false },
      { rank: 4, nickname: 'Invi', verified: false, points: 6, me: false },
      { rank: 5, nickname: null, verified: false, points: 4.5, me: false },
      { rank: 6, nickname: 'Carla', verified: true, points: 3.75, me: false },
    ])
    // Páginas de 2: sin página pedida, se abre en la del jugador (Invi, 4.º → página 2; Carla, 6.ª → página 3).
    expect(await pointsPage(guest, day(0), 'global', null, 2)).toMatchObject({ page: 2, pages: 3, total: 6, myPage: 2, rows: [{ nickname: 'Bea' }, { nickname: 'Invi', me: true }] })
    expect(await pointsPage(players[2], day(0), 'global', null, 2)).toMatchObject({ page: 3, myPage: 3, rows: [{ nickname: null }, { nickname: 'Carla', rank: 6 }] })
    expect(await pointsPage(players[2], day(0), 'global', 1, 2)).toMatchObject({ page: 1, myPage: 3, rows: [{ nickname: 'Dani' }, { nickname: 'Ana' }] })
    // Una página fuera de rango se ajusta a la última; sin sesión, la primera.
    expect(await pointsPage(players[2], day(0), 'global', 99, 2)).toMatchObject({ page: 3 })
    expect(await pointsPage(null, day(0), 'global', null, 2)).toMatchObject({ page: 1, myPage: null })
    // Mes sin nadie: una página vacía.
    expect(await pointsPage(players[2], addDays(month, -400), 'global')).toEqual({ page: 1, pages: 1, total: 0, myPage: null, rows: [] })

    await t.call(players[0], `select pwt.send_friend_request('carla')`)
    await t.call(players[2], `select pwt.respond_friend_request('ANA', true)`)
    const friends = await pointsPage(players[2], day(0), 'friends')
    expect(friends.rows.map((row) => row.nickname)).toEqual(['Ana', 'Carla'])
    expect((await pointsPage(null, day(0), 'global')).rows).toHaveLength(6)
  })

  it('racha actual: días seguidos ganados hasta hoy o, si hoy no ha terminado, hasta ayer; los importados cuentan; sin cuenta también', async () => {
    const [alive, today, broken, anonymous] = [await t.user(), await t.user(), await t.user(), await t.user(true)]
    for (const [index, player] of [alive, today, broken, anonymous].entries()) {
      await t.call(player, `select pwt.ensure_profile()`)
      await t.call(player, `select pwt.set_nickname($1)`, [`racha_${index}`])
    }
    for (const offset of [-3, -2, -1]) await seedDay(alive.id, addDays(t.today, offset), 'won', 6, { imported: offset === -3, validated: offset !== -3 })
    for (const offset of [-1, 0]) await seedDay(today.id, addDays(t.today, offset), 'won', 6)
    await seedDay(broken.id, addDays(t.today, -2), 'won', 6)
    await seedDay(broken.id, addDays(t.today, -1), 'lost', 0)
    await seedDay(anonymous.id, addDays(t.today, -1), 'won', 6)
    const page = await t.call<RankingPage>(alive, `select pwt.streak_ranking_page('global', 1, 100)`)
    const rows = page.rows.filter((row) => String(row.nickname).startsWith('racha_')).map(({ rank: _rank, ...row }) => row)
    expect(rows).toEqual([
      { nickname: 'racha_0', verified: true, streak: 3, me: true },
      { nickname: 'racha_1', verified: true, streak: 2, me: false },
      { nickname: 'racha_3', verified: false, streak: 1, me: false },
    ])
  })
})

describe('amigos (UT-95)', () => {
  it('buscar, pedir, aceptar, rechazar, cancelar y quitar', async () => {
    const [eva, fede, gema] = [await t.user(), await t.user(), await t.user()]
    for (const [player, name] of [[eva, 'Eva_x'], [fede, 'Fede_x'], [gema, 'Gema_x']] as const) {
      await t.call(player, `select pwt.ensure_profile()`)
      await t.call(player, `select pwt.set_nickname($1)`, [name])
    }
    expect(await t.as(eva, `select * from pwt.search_players('fede_')`)).toEqual([{ nickname: 'Fede_x', relation: 'none' }])
    await expect(t.call(eva, `select pwt.send_friend_request('eva_x')`)).rejects.toThrow('self_request')
    await expect(t.call(eva, `select pwt.send_friend_request('nadie')`)).rejects.toThrow('player_not_found')
    expect(await t.call(eva, `select pwt.send_friend_request('fede_x')`)).toBe('outgoing')
    expect(await t.as(fede, `select * from pwt.list_friends()`)).toEqual([{ nickname: 'Eva_x', relation: 'incoming' }])
    expect(await t.call(fede, `select pwt.my_summary() -> 'incomingRequests'`)).toBe(1)
    await t.as(fede, `select pwt.respond_friend_request('eva_x', true)`)
    expect(await t.as(eva, `select * from pwt.list_friends()`)).toEqual([{ nickname: 'Fede_x', relation: 'friend' }])

    // Si el otro ya había pedido, pedir acepta.
    await t.call(gema, `select pwt.send_friend_request('eva_x')`)
    expect(await t.call(eva, `select pwt.send_friend_request('gema_x')`)).toBe('friend')
    await t.as(eva, `select pwt.remove_friend('gema_x')`)
    expect(await t.as(gema, `select * from pwt.list_friends()`)).toEqual([])

    await t.call(gema, `select pwt.send_friend_request('fede_x')`)
    await t.as(gema, `select pwt.cancel_friend_request('fede_x')`)
    await t.call(gema, `select pwt.send_friend_request('fede_x')`)
    await t.as(fede, `select pwt.respond_friend_request('gema_x', false)`)
    expect(await t.as(fede, `select * from pwt.list_friends()`)).toEqual([{ nickname: 'Eva_x', relation: 'friend' }])
  })

  it('sin cuenta no hay amigos: ni buscar, ni pedir, ni salir en la búsqueda, ni recibir solicitudes (RF-110)', async () => {
    const [guest, member] = [await t.user(true), await t.user()]
    for (const [player, name] of [[guest, 'Invi_amigo'], [member, 'Socio_amigo']] as const) {
      await t.call(player, `select pwt.ensure_profile()`)
      await t.call(player, `select pwt.set_nickname($1)`, [name])
    }
    await expect(t.as(guest, `select * from pwt.list_friends()`)).rejects.toThrow('not_registered')
    await expect(t.as(guest, `select * from pwt.search_players('socio')`)).rejects.toThrow('not_registered')
    await expect(t.call(guest, `select pwt.send_friend_request('socio_amigo')`)).rejects.toThrow('not_registered')
    expect(await t.as(member, `select * from pwt.search_players('invi_')`)).toEqual([])
    await expect(t.call(member, `select pwt.send_friend_request('invi_amigo')`)).rejects.toThrow('player_not_found')
  })
})

// UT-118 · Estadísticas e historial de un amigo (decisión de Jose, 29/10/2026): solo entre amigos y solo de los días ya cerrados.
describe('vista de un amigo (UT-118)', () => {
  // Los nicknames llevan `suffix`: la base es la misma en todo el fichero.
  async function friends(suffix: string) {
    const [eva, fede, gema] = [await t.user(), await t.user(), await t.user()]
    for (const [player, name] of [[eva, 'Eva_'], [fede, 'Fede_'], [gema, 'Gema_']] as const) {
      await t.call(player, `select pwt.ensure_profile()`)
      await t.call(player, `select pwt.set_nickname($1)`, [name + suffix])
    }
    await t.call(eva, `select pwt.send_friend_request($1)`, [`fede_${suffix}`])
    await t.as(fede, `select pwt.respond_friend_request($1, true)`, [`eva_${suffix}`])
    return { eva, fede, gema }
  }

  it('un amigo ve sus días cerrados, sus puntos y su historial; el día de hoy, no', async () => {
    const { eva, fede } = await friends('v')
    // Un día pasado que no usa ningún otro test (la base y sus días cerrados son los mismos en todo el fichero).
    const closed = addDays(t.today, -200)
    for (const date of [closed, t.today]) {
      await seedDay(fede.id, date, 'won', 4)
      await t.as(fede, `select pwt.save_replay($1::date, 'datos')`, [date])
    }
    await t.admin(`insert into pwt.day_difficulty (date, players, average, multiplier) values ($1::date, 1, 4, 1.3333)`, [closed])
    const profile = await t.call<{ nickname: string; days: Array<{ date: string; battle?: unknown }>; points: Array<{ date: string; points: number }>; history: Array<{ date: string; sharedId: unknown }> }>(eva, `select pwt.friend_profile('FEDE_V')`)
    expect(profile.nickname).toBe('Fede_v')
    expect(profile.days.map((day) => day.date)).toEqual([closed])
    expect(profile.days[0]).not.toHaveProperty('battle')
    expect(profile.points).toEqual([expect.objectContaining({ date: closed, points: 5.33 })])
    expect(profile.history).toEqual([expect.objectContaining({ date: closed, sharedId: null })])
    expect(await t.call(eva, `select pwt.get_friend_replay('fede_v', $1::date)`, [closed])).toBe('datos')
    await expect(t.call(eva, `select pwt.get_friend_replay('fede_v', $1::date)`, [t.today])).rejects.toThrow('replay_not_found')
  })

  it('quien no es amigo (o solo tiene la solicitud pendiente) no ve nada, ni con un nickname que no existe ni sin cuenta', async () => {
    const { eva, fede, gema } = await friends('w')
    await seedDay(fede.id, addDays(t.today, -1), 'won', 4)
    await expect(t.call(gema, `select pwt.friend_profile('fede_w')`)).rejects.toThrow('not_friends')
    await t.call(gema, `select pwt.send_friend_request('fede_w')`)
    await expect(t.call(gema, `select pwt.friend_profile('fede_w')`)).rejects.toThrow('not_friends')
    await expect(t.call(gema, `select pwt.get_friend_replay('fede_w', $1::date)`, [addDays(t.today, -1)])).rejects.toThrow('not_friends')
    await expect(t.call(eva, `select pwt.friend_profile('nadie')`)).rejects.toThrow('not_friends')
    const guest = await t.user(true)
    await expect(t.call(guest, `select pwt.friend_profile('fede_w')`)).rejects.toThrow('not_registered')
    await expect(t.as(null, `select pwt.friend_profile('fede_w')`)).rejects.toThrow()
    // Al dejar de ser amigos, deja de verse.
    await t.as(eva, `select pwt.remove_friend('fede_w')`)
    await expect(t.call(eva, `select pwt.friend_profile('fede_w')`)).rejects.toThrow('not_friends')
    // La función interna no se expone.
    await expect(t.as(eva, `select pwt.friend_of_caller('fede_w')`)).rejects.toThrow()
  })
})

describe('permisos (UT-96)', () => {
  it('las funciones internas no se pueden llamar desde la API y las tablas no se leen', async () => {
    const user = await t.user()
    await expect(t.as(user, `select pwt.close_days()`)).rejects.toThrow()
    await expect(t.as(user, `select * from pwt.day_points('2026-01-01', '2026-12-31')`)).rejects.toThrow()
    await expect(t.as(user, `select * from pwt.points_ranked('2026-01-01', 'global')`)).rejects.toThrow()
    await expect(t.as(user, `select * from pwt.profiles`)).rejects.toThrow()
    await expect(t.as(null, `select pwt.my_days()`)).rejects.toThrow()
  })
})

// UT-104 · Inicio de sesión en un solo paso (Jose, 28/10/2026): lo jugado sin cuenta pasa a la cuenta con un código de un solo uso.
describe('traspaso de la sesión anónima a la cuenta (UT-104)', () => {
  it('la cuenta recibe los días que no tiene, con su estado y sus puntos; los repetidos se quedan; el código vale una vez', async () => {
    const [guest, member] = [await t.user(true), await t.user()]
    await t.call(guest, `select pwt.ensure_profile()`)
    await t.call(member, `select pwt.ensure_profile()`)
    await t.call(member, `select pwt.set_nickname('Socio_traspaso')`)
    await t.admin(`update pwt.profiles set created_at = now() - interval '2 days' where id = $1`, [member.id])
    await seedDay(guest.id, addDays(t.today, -3), 'won', 5)
    await seedDay(guest.id, addDays(t.today, -2), 'won', 4)
    await seedDay(member.id, addDays(t.today, -2), 'lost', 0)
    await t.call(guest, START, [t.today])
    await t.as(guest, `select pwt.save_turn($1::date, $2::jsonb, 1, 6, 5)`, [t.today, decisions(1)])

    const code = await t.call<string>(guest, `select pwt.create_guest_claim()`)
    expect(await t.call(member, `select pwt.claim_guest($1)`, [code])).toEqual({ days: 2, nickname: null })
    await expect(t.call(member, `select pwt.claim_guest($1)`, [code])).rejects.toThrow('invalid_claim')

    const days = await t.call<Array<Record<string, any>>>(member, `select pwt.my_days()`)
    expect(days.map((day) => [day.date, day.status])).toEqual([[addDays(t.today, -3), 'won'], [addDays(t.today, -2), 'lost'], [t.today, 'inProgress']])
    expect(days[2].battle).toMatchObject({ decisions: [move(0)] })
    // El día repetido se queda en la sesión anónima (sigue contando en la media); el nombre de la cuenta no cambia.
    expect(await t.admin(`select date::text from pwt.day_results where user_id = $1`, [guest.id])).toEqual([{ date: addDays(t.today, -2) }])
    expect(await t.admin(`select nickname from pwt.profiles where id = $1`, [member.id])).toEqual([{ nickname: 'Socio_traspaso' }])
    // La cuenta puede seguir su oficial de hoy.
    await t.as(member, `select pwt.save_turn($1::date, $2::jsonb, 2, 6, 4)`, [t.today, decisions(2)])
  })

  it('una cuenta nueva se queda con el nombre de la sesión anónima', async () => {
    const [guest, member] = [await t.user(true), await t.user()]
    await t.call(guest, `select pwt.ensure_profile()`)
    await t.call(guest, `select pwt.set_nickname('Invitada_trasp')`)
    await t.call(member, `select pwt.ensure_profile()`)
    const code = await t.call<string>(guest, `select pwt.create_guest_claim()`)
    expect(await t.call(member, `select pwt.claim_guest($1)`, [code])).toEqual({ days: 0, nickname: 'Invitada_trasp' })
    expect(await t.admin(`select id, nickname from pwt.profiles where id = any($1::uuid[]) order by nickname nulls first`, [[guest.id, member.id]]))
      .toEqual([{ id: guest.id, nickname: null }, { id: member.id, nickname: 'Invitada_trasp' }])
  })

  it('solo una sesión anónima pide código; un código caducado o inventado no vale', async () => {
    const [guest, member] = [await t.user(true), await t.user()]
    await t.call(member, `select pwt.ensure_profile()`)
    await expect(t.call(member, `select pwt.create_guest_claim()`)).rejects.toThrow('not_guest')
    await expect(t.call(member, `select pwt.claim_guest('inventado')`)).rejects.toThrow('invalid_claim')
    const code = await t.call<string>(guest, `select pwt.create_guest_claim()`)
    await t.admin(`update pwt.guest_claims set created_at = now() - interval '2 hours' where code = $1`, [code])
    await expect(t.call(member, `select pwt.claim_guest($1)`, [code])).rejects.toThrow('invalid_claim')
    await expect(t.call(await t.user(true), `select pwt.claim_guest($1)`, [code])).rejects.toThrow('not_registered')
  })
})

// UT-105 · F5 (REQUISITOS-F5, DEC-67): historial de 20 repeticiones y compartidas (como máximo 20 por jugador).
describe('historial y repeticiones (UT-105)', () => {
  const finished = async (player: Caller & {}, date: string) => seedDay((player as { id: string }).id, date, 'won', 4)

  it('guarda la repetición de un oficial propio terminado; al pasar de 20, la más antigua se borra y su resultado se queda', async () => {
    const player = await t.user()
    for (let offset = 0; offset < 22; offset++) {
      const date = addDays(t.today, -30 + offset)
      await finished(player, date)
      await t.as(player, `select pwt.save_replay($1::date, $2)`, [date, `datos-${offset}`])
    }
    const history = await t.call<Array<Record<string, unknown>>>(player, `select pwt.my_history()`)
    expect(history).toHaveLength(20)
    expect(history[0]).toMatchObject({ date: addDays(t.today, -9), status: 'won', survivors: 4, trainerId: 'misty', sharedId: null })
    expect(history.at(-1)?.date).toBe(addDays(t.today, -28))
    expect(await t.admin(`select count(*)::int as days from pwt.day_results where user_id = $1`, [player.id])).toEqual([{ days: 22 }])
    expect(await t.call(player, `select pwt.get_my_replay($1::date)`, [addDays(t.today, -9)])).toBe('datos-21')
    await expect(t.call(player, `select pwt.get_my_replay($1::date)`, [addDays(t.today, -30)])).rejects.toThrow('replay_not_found')
  })

  it('el historial trae los debilitados del equipo, en su orden (null si el día no los tiene)', async () => {
    const player = await t.user()
    const [fainted, without] = [addDays(t.today, -2), addDays(t.today, -1)]
    for (const date of [fainted, without]) {
      await finished(player, date)
      await t.as(player, `select pwt.save_replay($1::date, 'x')`, [date])
    }
    await t.admin(`update pwt.day_results set player_fainted = '{true,false,false,true,false,false}' where user_id = $1 and date = $2::date`, [player.id, fainted])
    const history = await t.call<Array<Record<string, unknown>>>(player, `select pwt.my_history()`)
    expect(history.map((entry) => entry.playerFainted)).toEqual([null, [true, false, false, true, false, false]])
  })

  it('no guarda de un día sin terminar, de otro jugador ni datos vacíos o enormes', async () => {
    const [player, other] = [await t.user(), await t.user()]
    await t.call(player, START, [t.today])
    await expect(t.as(player, `select pwt.save_replay($1::date, 'x')`, [t.today])).rejects.toThrow('not_finished')
    await finished(other, addDays(t.today, -1))
    await expect(t.as(player, `select pwt.save_replay($1::date, 'x')`, [addDays(t.today, -1)])).rejects.toThrow('not_finished')
    await finished(player, addDays(t.today, -1))
    await expect(t.as(player, `select pwt.save_replay($1::date, '')`, [addDays(t.today, -1)])).rejects.toThrow('invalid_replay')
    await expect(t.as(player, `select pwt.save_replay($1::date, $2)`, [addDays(t.today, -1), 'x'.repeat(70_000)])).rejects.toThrow('invalid_replay')
    await expect(t.as(null, `select pwt.save_replay($1::date, 'x')`, [addDays(t.today, -1)])).rejects.toThrow()
  })

  it('compartir crea un enlace que se abre sin sesión, es el mismo si se repite y sobrevive al historial; su dueño lo puede borrar', async () => {
    const [owner, stranger] = [await t.user(), await t.user()]
    await t.call(owner, `select pwt.ensure_profile()`)
    await t.call(owner, `select pwt.set_nickname('Comparte')`)
    const date = addDays(t.today, -2)
    await finished(owner, date)
    await t.as(owner, `select pwt.save_replay($1::date, 'grabacion')`, [date])
    const id = await t.call<string>(owner, `select pwt.share_replay($1::date)`, [date])
    expect(id).toMatch(/^[a-z0-9]{10}$/)
    expect(await t.call(owner, `select pwt.share_replay($1::date)`, [date])).toBe(id)
    expect(await t.call(null, `select pwt.get_shared_replay($1)`, [id])).toMatchObject({ id, nickname: 'Comparte', date, challengeNumber: 1, trainerId: 'misty', data: 'grabacion', mine: false })
    expect(await t.call(owner, `select pwt.get_shared_replay($1)`, [id])).toMatchObject({ mine: true })
    expect((await t.call<Array<Record<string, unknown>>>(owner, `select pwt.my_history()`))[0]).toMatchObject({ sharedId: id })
    // Sale del historial (se borra la repetición), pero el enlace sigue.
    await t.admin(`delete from pwt.replays where user_id = $1`, [owner.id])
    expect(await t.call(null, `select pwt.get_shared_replay($1)`, [id])).toMatchObject({ data: 'grabacion' })
    await expect(t.as(stranger, `select pwt.delete_shared_replay($1)`, [id])).rejects.toThrow('replay_not_found')
    await t.as(owner, `select pwt.delete_shared_replay($1)`, [id])
    await expect(t.call(null, `select pwt.get_shared_replay($1)`, [id])).rejects.toThrow('replay_not_found')
  })

  it('como máximo 20 compartidas por jugador: la 21.ª borra la más antigua; las demás siguen en el historial con su enlace', async () => {
    const owner = await t.user(true)
    const ids: string[] = []
    for (let offset = 0; offset < 21; offset++) {
      const date = addDays(t.today, -60 + offset)
      await finished(owner, date)
      await t.as(owner, `select pwt.save_replay($1::date, 'g')`, [date])
      ids.push(await t.call<string>(owner, `select pwt.share_replay($1::date)`, [date]))
    }
    expect(await t.admin(`select count(*)::int as shared from pwt.shared_replays where owner = $1`, [owner.id])).toEqual([{ shared: 20 }])
    await expect(t.call(null, `select pwt.get_shared_replay($1)`, [ids[0]])).rejects.toThrow('replay_not_found')
    expect(await t.call(null, `select pwt.get_shared_replay($1)`, [ids[1]])).toMatchObject({ id: ids[1] })
    // El historial también guarda 20: el día de la primera ya no está; los demás conservan su enlace.
    const history = await t.call<Array<Record<string, unknown>>>(owner, `select pwt.my_history()`)
    expect(history).toHaveLength(20)
    expect(history.find((item) => item.date === addDays(t.today, -60))).toBeUndefined()
    expect(history.find((item) => item.date === addDays(t.today, -59))?.sharedId).toBe(ids[1])
    expect(history.find((item) => item.date === addDays(t.today, -40))?.sharedId).toBe(ids[20])
  })

  it('las tablas no se leen desde la API', async () => {
    const player = await t.user()
    await expect(t.as(player, `select * from pwt.replays`)).rejects.toThrow()
    await expect(t.as(null, `select * from pwt.shared_replays`)).rejects.toThrow()
  })
})
