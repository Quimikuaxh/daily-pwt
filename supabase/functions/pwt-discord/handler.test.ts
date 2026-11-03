// UT-141 · Edge Function `pwt-discord` (RF-115, RF-117, RF-118, DEC-77) con Discord y PostgREST simulados.
import { describe, expect, it, vi } from 'vitest'
import { createHandler, DISCORD_API, MESSAGES, type DiscordEnv } from './handler'

const ENV: DiscordEnv = {
  SUPABASE_URL: 'https://proyecto.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  DISCORD_CLIENT_ID: 'cliente',
  DISCORD_CLIENT_SECRET: 'secreto',
  DISCORD_BOT_TOKEN: 'bot',
  DISCORD_GUILD_ID: '900',
  PWT_DISCORD_CRON_SECRET: 'cron',
  PWT_SITE_URL: 'https://quimikuaxh.github.io/daily-pwt/',
}
const FUNCTION_URL = `${ENV.SUPABASE_URL}/functions/v1/pwt-discord`

type Call = { url: string; method: string; body: string | undefined; headers: Record<string, string> }
type Route = (call: Call) => Response | undefined

/** `fetch` falso: cada ruta responde a lo suyo; lo que no reconoce, 404. Guarda todas las llamadas. */
function fakeFetch(...routes: Route[]) {
  const calls: Call[] = []
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const call = { url, method: init.method ?? 'GET', body: init.body as string | undefined, headers: (init.headers ?? {}) as Record<string, string> }
    calls.push(call)
    for (const route of routes) {
      const response = route(call)
      if (response) return response
    }
    return new Response('not found', { status: 404 })
  })
  return { fetcher, calls }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const on = (method: string, url: string, response: () => Response): Route => (call) => (call.method === method && call.url === url ? response() : undefined)
const rpcUrl = (name: string) => `${ENV.SUPABASE_URL}/rest/v1/rpc/${name}`

const discordOk: Route[] = [
  on('POST', `${DISCORD_API}/oauth2/token`, () => json({ access_token: 'acceso' })),
  on('GET', `${DISCORD_API}/users/@me`, () => json({ id: '42', username: 'jose', global_name: 'Jose' })),
  on('PUT', `${DISCORD_API}/guilds/900/members/42`, () => new Response(null, { status: 201 })),
  on('POST', `${DISCORD_API}/users/@me/channels`, () => json({ id: 'dm-1' })),
  on('POST', `${DISCORD_API}/channels/dm-1/messages`, () => json({ id: 'm' })),
]
const rpcOk: Route[] = [
  on('POST', rpcUrl('discord_link_finish'), () => json('user-1')),
  on('POST', rpcUrl('discord_report'), () => new Response(null, { status: 204 })),
]

const get = (query: string) => new Request(`${FUNCTION_URL}?${query}`)
const bodyOf = (calls: Call[], url: string) => calls.filter((call) => call.url === url).map((call) => JSON.parse(call.body ?? 'null'))

describe('Edge Function pwt-discord (UT-141)', () => {
  it('?start lleva a Discord a autorizar con su state, identify y guilds.join, y vuelta a la función', async () => {
    const { fetcher } = fakeFetch()
    const response = await createHandler(ENV, fetcher)(get('start=abc'))
    expect(response.status).toBe(302)
    const target = new URL(response.headers.get('Location')!)
    expect(target.origin + target.pathname).toBe('https://discord.com/oauth2/authorize')
    expect(Object.fromEntries(target.searchParams)).toMatchObject({ client_id: 'cliente', state: 'abc', scope: 'identify guilds.join', redirect_uri: FUNCTION_URL, response_type: 'code' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('a la vuelta vincula con el state, mete al jugador en el servidor, le da la bienvenida por privado y vuelve a la web', async () => {
    const { fetcher, calls } = fakeFetch(...discordOk, ...rpcOk)
    const response = await createHandler(ENV, fetcher)(get('code=c0de&state=abc'))
    expect(response.headers.get('Location')).toBe(`${ENV.PWT_SITE_URL}?discord=ok`)
    expect(new URLSearchParams(calls[0].body).get('redirect_uri')).toBe(FUNCTION_URL)
    expect(bodyOf(calls, rpcUrl('discord_link_finish'))).toEqual([{ p_state: 'abc', p_discord_id: '42', p_discord_name: 'Jose' }])
    expect(bodyOf(calls, `${DISCORD_API}/guilds/900/members/42`)).toEqual([{ access_token: 'acceso' }])
    expect(bodyOf(calls, `${DISCORD_API}/channels/dm-1/messages`)).toEqual([{ content: MESSAGES.welcome(ENV.PWT_SITE_URL) }])
    expect(bodyOf(calls, rpcUrl('discord_report'))).toEqual([{ p_user_id: 'user-1', p_delivered: true }])
    expect(calls.find((call) => call.url.startsWith(ENV.SUPABASE_URL))?.headers).toMatchObject({ 'Content-Profile': 'pwt', Authorization: 'Bearer service' })
  })

  it('cancelar en Discord vuelve con cancelled; un state que no vale, con error y sin tocar el servidor de Discord', async () => {
    const cancelled = await createHandler(ENV, fakeFetch().fetcher)(get('error=access_denied&state=abc'))
    expect(cancelled.headers.get('Location')).toBe(`${ENV.PWT_SITE_URL}?discord=cancelled`)

    const { fetcher, calls } = fakeFetch(on('POST', rpcUrl('discord_link_finish'), () => json({ message: 'invalid_state' }, 400)), ...discordOk)
    const response = await createHandler(ENV, fetcher)(get('code=c0de&state=viejo'))
    expect(response.headers.get('Location')).toBe(`${ENV.PWT_SITE_URL}?discord=error`)
    expect(calls.some((call) => call.url.includes('/guilds/'))).toBe(false)
  })

  it('si no puede escribirle (privados cerrados), vincula igual y lo apunta', async () => {
    const { fetcher, calls } = fakeFetch(on('POST', `${DISCORD_API}/channels/dm-1/messages`, () => json({ code: 50007 }, 403)), ...discordOk, ...rpcOk)
    const response = await createHandler(ENV, fetcher)(get('code=c0de&state=abc'))
    expect(response.headers.get('Location')).toBe(`${ENV.PWT_SITE_URL}?discord=ok`)
    expect(bodyOf(calls, rpcUrl('discord_report'))).toEqual([{ p_user_id: 'user-1', p_delivered: false }])
  })

  it('la tarea manda un privado a cada aviso que toca y apunta cuáles llegaron; sin el secreto, nada', async () => {
    const due = on('POST', rpcUrl('discord_due_reminders'), () => json([{ user_id: 'u1', discord_id: '1' }, { user_id: 'u2', discord_id: '2' }]))
    const channels: Route = (call) => {
      if (call.url !== `${DISCORD_API}/users/@me/channels`) return undefined
      const { recipient_id: id } = JSON.parse(call.body!)
      return id === '1' ? json({ id: 'dm-1' }) : json({ code: 50007 }, 403)
    }
    const { fetcher, calls } = fakeFetch(due, channels, ...discordOk, ...rpcOk)
    const handler = createHandler(ENV, fetcher)

    expect((await handler(new Request(FUNCTION_URL, { method: 'POST' }))).status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()

    const response = await handler(new Request(FUNCTION_URL, { method: 'POST', headers: { 'x-pwt-cron': 'cron' } }))
    expect(await response.json()).toEqual({ sent: 1, failed: 1 })
    expect(bodyOf(calls, `${DISCORD_API}/channels/dm-1/messages`)).toEqual([{ content: MESSAGES.reminder(ENV.PWT_SITE_URL) }])
    expect(bodyOf(calls, rpcUrl('discord_report'))).toEqual([{ p_user_id: 'u1', p_delivered: true }, { p_user_id: 'u2', p_delivered: false }])
  })

  it('con 429 espera lo que pide Discord y lo intenta otra vez', async () => {
    let first = true
    const limited: Route = (call) => {
      if (call.url !== `${DISCORD_API}/channels/dm-1/messages` || !first) return undefined
      first = false
      return json({ retry_after: 0.5 }, 429)
    }
    const { fetcher, calls } = fakeFetch(on('POST', rpcUrl('discord_due_reminders'), () => json([{ user_id: 'u1', discord_id: '1' }])), limited, ...discordOk, ...rpcOk)
    const wait = vi.fn(async () => undefined)
    const response = await createHandler(ENV, fetcher, wait)(new Request(FUNCTION_URL, { method: 'POST', headers: { 'x-pwt-cron': 'cron' } }))
    expect(await response.json()).toEqual({ sent: 1, failed: 0 })
    expect(wait).toHaveBeenCalledWith(500)
    expect(calls.filter((call) => call.url === `${DISCORD_API}/channels/dm-1/messages`)).toHaveLength(2)
  })
})
