// UT-255 · Ranking «Vivos hoy» (Jose, 27/11/2026): Pokémon en pie al acabar el oficial de hoy (día de Madrid), al momento.
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type Caller, type TestDb } from './testDb'

let t: TestDb
beforeAll(async () => {
  t = await createTestDb()
}, 60_000)

type RankingPage = { page: number; pages: number; total: number; myPage: number | null; rows: Array<Record<string, unknown>> }
const page = (caller: Caller, scope: string) => t.call<RankingPage>(caller, `select pwt.survivors_ranking_page($1, null, 20)`, [scope])

async function player(nickname: string, anonymous = false) {
  const user = await t.user(anonymous)
  await t.call(user, `select pwt.ensure_profile()`)
  await t.call(user, `select pwt.set_nickname($1)`, [nickname])
  return user
}

/** Resultado de un día escrito a mano (la API solo deja jugar el de hoy, turno a turno). */
async function result(user: { id: string }, date: string, status: 'won' | 'lost' | 'void' | 'inProgress', survivors: number | null, imported = false) {
  await t.admin(
    `insert into pwt.day_results (user_id, date, challenge_number, trainer_id, variant_id, data_version, status, started_at, finished_at, survivors, imported)
     values ($1, $2::date, 1, 'misty', 'misty-1', 'v1', $3, now(), case when $3 = 'inProgress' then null else now() end, $4, $5)`,
    [user.id, date, status, survivors, imported],
  )
}

describe('ranking de vivos hoy', () => {
  it('todos: solo quien ha terminado hoy, de más a menos con empates; perdido y anulado cuentan 0; amigos: también los que no han jugado', async () => {
    const [{ today, yesterday }] = await t.admin<{ today: string; yesterday: string }>(`select pwt.madrid_today()::text as today, (pwt.madrid_today() - 1)::text as yesterday`)
    const [ana, bea, carla, dani, eva, fran, gus] = [await player('Ana'), await player('Bea'), await player('Carla'), await player('Dani'), await player('Eva'), await player('Fran'), await player('Gus', true)]
    await result(ana, today, 'won', 4)
    await result(bea, today, 'won', 6)
    await result(carla, today, 'won', 4)
    await result(dani, today, 'lost', 0)
    await result(eva, today, 'void', null)
    await result(fran, today, 'inProgress', null) // a medias: no sale en «Todos»
    await result(gus, yesterday, 'won', 5) // ayer no cuenta

    const global = await page(ana, 'global')
    expect(global).toMatchObject({ page: 1, pages: 1, total: 5, myPage: 1 })
    expect(global.rows).toEqual([
      { rank: 1, nickname: 'Bea', verified: true, survivors: 6, me: false },
      { rank: 2, nickname: 'Ana', verified: true, survivors: 4, me: true },
      { rank: 2, nickname: 'Carla', verified: true, survivors: 4, me: false },
      { rank: 4, nickname: 'Dani', verified: true, survivors: 0, me: false },
      { rank: 4, nickname: 'Eva', verified: true, survivors: 0, me: false },
    ])
    // Sin sesión se ve igual (RF-109), sin «me».
    expect((await page(null, 'global')).rows.map((row) => row.me)).toEqual([false, false, false, false, false])

    // Amigos: Fran (a medias, sale con «—») y Bea (ha jugado).
    await t.call(fran, `select pwt.send_friend_request('Bea')`)
    await t.call(bea, `select pwt.respond_friend_request('Fran', true)`)
    const friends = await page(fran, 'friends')
    expect(friends.rows).toEqual([
      { rank: 1, nickname: 'Bea', verified: true, survivors: 6, me: false },
      { rank: null, nickname: 'Fran', verified: true, survivors: null, me: true },
    ])
    // Sin sesión, «Solo amigos» sale vacío.
    expect((await page(null, 'friends')).rows).toEqual([])
  })
})
