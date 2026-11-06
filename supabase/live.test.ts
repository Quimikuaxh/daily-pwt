// UT-148 · Ver en directo el oficial de un amigo (RF-111c, DEC-80): migración `20261104010000_pwt_directo.sql` sobre PGlite.
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type Caller, type TestDb } from './testDb'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
}, 60_000)

const START = `select pwt.start_official($1::date, 7, 'misty', 'misty-1', 'v1', 'semilla', 'heuristic', 2, 6, 6)`
const move = (slot: number) => ({ type: 'move', slot })
const decisions = (count: number) => JSON.stringify(Array.from({ length: count }, (_, index) => move(index % 4 + 1)))
const fainted = (lost: number) => `{${Array.from({ length: 6 }, (_, index) => (index < lost ? 'true' : 'false')).join(',')}}`

let counter = 0
/** Eva y Fede, amigos; Gema, sin amistad. Nicknames distintos en cada test (la base es la misma en todo el fichero). */
async function people() {
  counter += 1
  const [eva, fede, gema] = [await t.user(), await t.user(), await t.user()]
  for (const [player, name] of [[eva, 'Eva'], [fede, 'Fede'], [gema, 'Gema']] as const) {
    await t.call(player, `select pwt.ensure_profile()`)
    await t.call(player, `select pwt.set_nickname($1)`, [`${name}_${counter}`])
  }
  await t.call(eva, `select pwt.send_friend_request($1)`, [`fede_${counter}`])
  await t.as(fede, `select pwt.respond_friend_request($1, true)`, [`eva_${counter}`])
  return { eva, fede, gema, n: (name: string) => `${name}_${counter}` }
}

const friendRow = async (caller: Caller, nickname: string) =>
  (await t.as<{ nickname: string; playing: boolean; unfinished: boolean; live: string | null }>(caller, `select * from pwt.list_friends()`)).find((row) => row.nickname === nickname)

describe('ver en directo (UT-148)', () => {
  it('Amigos dice quién juega; se pide, quien juega lo ve y lo acepta, y entonces se lee su combate en curso', async () => {
    const { eva, fede, n } = await people()
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: false, live: null })
    await expect(t.call(eva, `select pwt.request_live($1)`, [n('fede')])).rejects.toThrow('not_playing')

    await t.call(fede, START, [t.today])
    await t.as(fede, `select pwt.save_turn($1::date, $2::jsonb, 1, 6, 6)`, [t.today, decisions(1)])
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: true, live: null })
    expect(await t.call(eva, `select pwt.request_live($1)`, [n('fede')])).toBe('pending')
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ live: 'pending' })
    await expect(t.call(eva, `select pwt.live_battle($1)`, [n('fede')])).rejects.toThrow('live_not_allowed')

    expect(await t.call(fede, `select pwt.live_inbox()`)).toEqual({ pending: [n('Eva')], watching: 0 })
    await t.as(fede, `select pwt.answer_live_request($1, true)`, [n('eva')])
    expect(await t.call(fede, `select pwt.live_inbox()`)).toEqual({ pending: [], watching: 1 })
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ live: 'accepted' })
    expect(await t.call(eva, `select pwt.live_battle($1)`, [n('fede')])).toEqual({
      state: 'live', date: t.today, seed: 'semilla', ai: 'heuristic', leadIndex: 2, decisions: [move(1)], turn: 1,
    })
    // Pedirlo otra vez no lo vuelve a poner pendiente.
    expect(await t.call(eva, `select pwt.request_live($1)`, [n('fede')])).toBe('accepted')
  })

  it('al terminar, el espectador recibe las decisiones finales y el motivo', async () => {
    const { eva, fede, n } = await people()
    await t.call(fede, START, [t.today])
    await t.as(fede, `select pwt.save_turn($1::date, $2::jsonb, 1, 6, 6)`, [t.today, decisions(1)])
    await t.call(eva, `select pwt.request_live($1)`, [n('fede')])
    await t.as(fede, `select pwt.answer_live_request($1, true)`, [n('eva')])
    await t.call(fede, `select pwt.finish_official($1::date, 'loss', 'forfeit', 2, 0, $2::boolean[], 0, $3::jsonb)`, [t.today, fainted(6), decisions(2)])
    expect(await t.call(eva, `select pwt.live_battle($1)`, [n('fede')])).toEqual({
      state: 'ended', date: t.today, seed: 'semilla', ai: 'heuristic', leadIndex: 2, decisions: [move(1), move(2)], reason: 'forfeit',
    })
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: false })
  })

  it('rechazar: no se ve, y se puede volver a pedir; un anulado es `void`', async () => {
    const { eva, fede, n } = await people()
    await t.call(fede, START, [t.today])
    await t.call(eva, `select pwt.request_live($1)`, [n('fede')])
    await t.as(fede, `select pwt.answer_live_request($1, false)`, [n('eva')])
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ live: 'rejected' })
    await expect(t.call(eva, `select pwt.live_battle($1)`, [n('fede')])).rejects.toThrow('live_not_allowed')
    await expect(t.as(fede, `select pwt.answer_live_request($1, true)`, [n('eva')])).rejects.toThrow('request_not_found')
    expect(await t.call(eva, `select pwt.request_live($1)`, [n('fede')])).toBe('pending')
    await t.as(fede, `select pwt.answer_live_request($1, true)`, [n('eva')])
    await t.as(fede, `select pwt.void_official($1::date, 'abandoned')`, [t.today])
    expect(await t.call(eva, `select pwt.live_battle($1)`, [n('fede')])).toEqual({ state: 'void', date: t.today })
  })

  it('UT-159: a medias y sin turnos guardados en 10 minutos ya no está «jugando»: sale `unfinished` y no se le puede pedir', async () => {
    const { eva, fede, n } = await people()
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: false, unfinished: false })
    await t.call(fede, START, [t.today])
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: true, unfinished: false })
    const idle = (minutes: number) => t.admin(`update pwt.battle_states set updated_at = now() - make_interval(mins => $2) where user_id = $1`, [fede.id, minutes])
    await idle(9)
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: true, unfinished: false })
    await idle(11)
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: false, unfinished: true })
    await expect(t.call(eva, `select pwt.request_live($1)`, [n('fede')])).rejects.toThrow('not_playing')
    // Vuelve a jugar: al guardar un turno, otra vez «jugando».
    await t.as(fede, `select pwt.save_turn($1::date, $2::jsonb, 1, 6, 6)`, [t.today, decisions(1)])
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: true, unfinished: false })
    // Terminado: ni una cosa ni otra.
    await t.call(fede, `select pwt.finish_official($1::date, 'loss', 'forfeit', 2, 0, $2::boolean[], 0, $3::jsonb)`, [t.today, fainted(6), decisions(2)])
    expect(await friendRow(eva, n('Fede'))).toMatchObject({ playing: false, unfinished: false })
  })

  it('sin amistad, sin cuenta o sin sesión no se pide ni se lee; las tablas no se leen desde la API', async () => {
    const { fede, gema, n } = await people()
    await t.call(fede, START, [t.today])
    await expect(t.call(gema, `select pwt.request_live($1)`, [n('fede')])).rejects.toThrow('not_friends')
    await expect(t.call(gema, `select pwt.live_battle($1)`, [n('fede')])).rejects.toThrow('not_friends')
    await expect(t.call(await t.user(true), `select pwt.request_live($1)`, [n('fede')])).rejects.toThrow('not_registered')
    await expect(t.as(null, `select pwt.live_inbox()`)).rejects.toThrow()
    await expect(t.as(fede, `select * from pwt.live_requests`)).rejects.toThrow()
    await expect(t.as(fede, `select * from pwt.live_endings`)).rejects.toThrow()
    await expect(t.as(fede, `select pwt.is_playing($1)`, [fede.id])).rejects.toThrow()
  })
})
