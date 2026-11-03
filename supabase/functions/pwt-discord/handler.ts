/**
 * Edge Function `pwt-discord` (RF-115 a RF-119, DEC-77). Sin dependencias de Deno, para probarla con Vitest (`handler.test.ts`); el
 * punto de entrada es `index.ts`.
 *
 * - `GET ?start=<state>`: el botón «Conectar Discord» de Cuenta trae aquí al jugador con el `state` de `pwt.discord_link_start`; se le
 *   manda a Discord a autorizar (`identify` y `guilds.join`).
 * - `GET ?code=…&state=…`: vuelve de Discord. Se lee su usuario, se termina la vinculación (`pwt.discord_link_finish`), se le mete en el
 *   servidor del juego (el bot solo puede escribir por privado a quien comparte servidor con él) y se le manda un mensaje de bienvenida.
 *   Acaba volviendo a la web con `?discord=ok|cancelled|error`.
 * - `POST` con la cabecera `x-pwt-cron`: lo llama `pg_cron` cada 15 minutos (`pwt.discord_ping`); manda los avisos que tocan.
 */

export type DiscordEnv = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  DISCORD_BOT_TOKEN: string
  DISCORD_GUILD_ID: string
  PWT_DISCORD_CRON_SECRET: string
  /** Web a la que se vuelve y que enlazan los mensajes. */
  PWT_SITE_URL: string
}

export const REQUIRED_ENV: Array<keyof DiscordEnv> = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID',
  'PWT_DISCORD_CRON_SECRET', 'PWT_SITE_URL',
]

export const DISCORD_API = 'https://discord.com/api/v10'
export const FUNCTION_NAME = 'pwt-discord'

export const MESSAGES = {
  welcome: (site: string) =>
    `¡Listo! Te escribiré por aquí los días que aún no hayas jugado el Daily PWT a la hora que elegiste. Puedes cambiarla o quitar el aviso en ${site} (Cuenta).`,
  reminder: (site: string) => `Aún no has jugado el Daily PWT de hoy. El reto cambia a medianoche (hora de Madrid): ${site}`,
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export type LinkResult = 'ok' | 'cancelled' | 'error'

export function createHandler(env: DiscordEnv, fetcher: Fetch = fetch, wait: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms))) {
  const redirectUri = `${env.SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`
  const back = (result: LinkResult) => Response.redirect(`${env.PWT_SITE_URL}?discord=${result}`, 302)

  /** Función del esquema `pwt` con la clave `service_role` (PostgREST). */
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const response = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'pwt',
      },
      body: JSON.stringify(args),
    })
    if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`)
    const text = await response.text()
    return (text ? JSON.parse(text) : null) as T
  }

  /** Llamada a Discord como el bot; con 429 espera lo que diga Discord y lo intenta una vez más. */
  async function bot(path: string, init: { method: string; body?: unknown }, retried = false): Promise<Response> {
    const response = await fetcher(`${DISCORD_API}${path}`, {
      method: init.method,
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    if (response.status === 429 && !retried) {
      const { retry_after: seconds = 1 } = (await response.json().catch(() => ({}))) as { retry_after?: number }
      await wait(Math.min(seconds, 10) * 1000)
      return bot(path, init, true)
    }
    return response
  }

  /** Mensaje privado; `true` si llegó. */
  async function sendPrivate(discordId: string, content: string): Promise<boolean> {
    const channel = await bot('/users/@me/channels', { method: 'POST', body: { recipient_id: discordId } })
    if (!channel.ok) return false
    const { id } = (await channel.json()) as { id: string }
    const message = await bot(`/channels/${id}/messages`, { method: 'POST', body: { content } })
    return message.ok
  }

  async function finishLink(code: string, state: string): Promise<LinkResult> {
    const token = await fetcher(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
      }).toString(),
    })
    if (!token.ok) return 'error'
    const { access_token: accessToken } = (await token.json()) as { access_token: string }
    const me = await fetcher(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!me.ok) return 'error'
    const user = (await me.json()) as { id: string; username: string; global_name?: string | null }
    // Primero el state: si no vale (caducado, repetido), no se toca nada en Discord.
    const userId = await rpc<string>('discord_link_finish', { p_state: state, p_discord_id: user.id, p_discord_name: user.global_name || user.username })
    const joined = await bot(`/guilds/${env.DISCORD_GUILD_ID}/members/${user.id}`, { method: 'PUT', body: { access_token: accessToken } })
    const delivered = joined.ok && (await sendPrivate(user.id, MESSAGES.welcome(env.PWT_SITE_URL)))
    await rpc('discord_report', { p_user_id: userId, p_delivered: delivered })
    return 'ok'
  }

  async function sendReminders(): Promise<{ sent: number; failed: number }> {
    const due = await rpc<Array<{ user_id: string; discord_id: string }>>('discord_due_reminders', {})
    let sent = 0
    for (const { user_id: userId, discord_id: discordId } of due) {
      const delivered = await sendPrivate(discordId, MESSAGES.reminder(env.PWT_SITE_URL))
      await rpc('discord_report', { p_user_id: userId, p_delivered: delivered })
      if (delivered) sent += 1
    }
    return { sent, failed: due.length - sent }
  }

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST') {
      if (!env.PWT_DISCORD_CRON_SECRET || request.headers.get('x-pwt-cron') !== env.PWT_DISCORD_CRON_SECRET) return new Response('forbidden', { status: 403 })
      return Response.json(await sendReminders())
    }
    if (request.method !== 'GET') return new Response('method not allowed', { status: 405 })

    const start = url.searchParams.get('start')
    if (start) {
      const authorize = new URL('https://discord.com/oauth2/authorize')
      authorize.search = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID, response_type: 'code', redirect_uri: redirectUri, scope: 'identify guilds.join', state: start, prompt: 'none',
      }).toString()
      return Response.redirect(authorize.toString(), 302)
    }
    // Cancelar en Discord vuelve con `error=access_denied`.
    if (url.searchParams.get('error')) return back('cancelled')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return back('error')
    try {
      return back(await finishLink(code, state))
    } catch {
      return back('error')
    }
  }
}
