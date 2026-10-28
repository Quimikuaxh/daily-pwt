import type { SupabaseClient } from '@supabase/supabase-js'
import { CloudError, type CloudApi, type CloudDay, type PlayerRow, type PointsRow, type RankingPage, type StreakRow, type Summary } from './api'
import type { Cloud } from './account'
import { cloudConfig } from './config'
import type { CloudAuth, Session } from './auth'

/** Error de PostgREST: con código (SQLSTATE o `PGRST…`) lo rechazó el servidor; sin él, falló la red. */
function toCloudError(error: { message?: string; code?: string } | null | undefined): CloudError {
  const code = error?.code ?? ''
  const permanent = code !== ''
  return new CloudError(permanent && code === 'P0001' ? (error?.message ?? code) : code || (error?.message ?? 'network'), permanent)
}

/** La página a la que vuelve Google: la misma, sin parámetros (funciona en Pages, `/daily-pwt/`, y en desarrollo). */
const returnUrl = () => `${window.location.origin}${window.location.pathname}`

/** Google ya tenía cuenta: `linkIdentity` no puede enlazarlo a la sesión anónima y vuelve con este error. */
const IDENTITY_TAKEN = 'identity_already_exists'

function supabaseApi(client: SupabaseClient): CloudApi {
  async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    let result
    try {
      result = await client.rpc(name, args)
    } catch (error) {
      throw new CloudError(error instanceof Error ? error.message : 'network', false)
    }
    if (result.error) throw toCloudError(result.error)
    return result.data as T
  }
  const numeric = <T extends Record<string, unknown>>(rows: T[], key: keyof T) => rows.map((row) => ({ ...row, [key]: Number(row[key]) }))

  return {
    ensureProfile: () => rpc('ensure_profile'),
    setNickname: (nickname) => rpc('set_nickname', { p_nickname: nickname }),
    startOfficial: (entry, sizes) =>
      rpc('start_official', {
        p_date: entry.date,
        p_challenge_number: entry.challengeNumber,
        p_trainer_id: entry.trainerId,
        p_variant_id: entry.variantId,
        p_data_version: entry.dataVersion,
        p_seed: entry.battle.seed,
        p_ai: entry.battle.ai,
        p_lead_index: entry.battle.leadIndex,
        p_player_size: sizes.player,
        p_rival_size: sizes.rival,
      }),
    saveTurn: (date, decisions, state) =>
      rpc('save_turn', { p_date: date, p_decisions: decisions, p_turn: state.turn, p_player_remaining: state.playerRemaining, p_rival_remaining: state.rivalRemaining }),
    finishOfficial: (date, ended, decisions) =>
      rpc('finish_official', {
        p_date: date,
        p_result: ended.result,
        p_reason: ended.reason,
        p_turns: ended.turns,
        p_survivors: ended.playerAlive,
        p_player_fainted: ended.playerFainted,
        p_rival_fainted: ended.rivalFainted,
        p_decisions: decisions,
      }),
    voidOfficial: (date, reason) => rpc('void_official', { p_date: date, p_reason: reason }),
    // Solo días terminados: sin `battle` (es null), con los nombres de `DayRecord` que lee `import_days`.
    importDays: (days) => rpc('import_days', { p_days: days.map((day) => ({ ...day, battle: null })) }),
    myDays: () => rpc<CloudDay[]>('my_days'),
    mySummary: async () => {
      const summary = await rpc<Summary>('my_summary')
      return { ...summary, points: summary.points.map((day) => ({ ...day, points: Number(day.points) })) }
    },
    pointsRanking: async (month, scope, page) => {
      const result = await rpc<RankingPage<PointsRow>>('points_ranking_page', { p_month: month, p_scope: scope, p_page: page })
      return { ...result, rows: numeric(result.rows, 'points') }
    },
    streakRanking: (scope, page) => rpc<RankingPage<StreakRow>>('streak_ranking_page', { p_scope: scope, p_page: page }),
    searchPlayers: (query) => rpc<PlayerRow[]>('search_players', { p_query: query }),
    sendFriendRequest: (nickname) => rpc('send_friend_request', { p_nickname: nickname }),
    respondFriendRequest: (nickname, accept) => rpc('respond_friend_request', { p_nickname: nickname, p_accept: accept }),
    cancelFriendRequest: (nickname) => rpc('cancel_friend_request', { p_nickname: nickname }),
    removeFriend: (nickname) => rpc('remove_friend', { p_nickname: nickname }),
    listFriends: () => rpc<PlayerRow[]>('list_friends'),
  }
}

function supabaseAuth(client: SupabaseClient): CloudAuth {
  const toSession = (user: { id: string; is_anonymous?: boolean } | null | undefined): Session | null =>
    user ? { userId: user.id, anonymous: user.is_anonymous ?? false } : null
  const google = () => ({ provider: 'google' as const, options: { redirectTo: returnUrl() } })

  return {
    async getSession() {
      const params = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`)
      if (params.get('error_code') === IDENTITY_TAKEN) {
        // Ese Google ya era una cuenta: se entra en ella (la sesión anónima de este navegador se queda como estaba).
        window.history.replaceState(null, '', returnUrl())
        await client.auth.signInWithOAuth(google())
        return null
      }
      const { data } = await client.auth.getSession()
      return toSession(data.session?.user)
    },
    async signInAnonymously() {
      const { data, error } = await client.auth.signInAnonymously()
      const session = toSession(data.user)
      if (error || !session) throw toCloudError(error)
      return session
    },
    async signInWithGoogle() {
      const { data } = await client.auth.getSession()
      const { error } = data.session?.user.is_anonymous ? await client.auth.linkIdentity(google()) : await client.auth.signInWithOAuth(google())
      if (error) throw toCloudError(error)
    },
    async signOut() {
      await client.auth.signOut()
    },
  }
}

/** Carga `supabase-js` aparte (no entra en la ruta crítica) y crea el cliente sobre el esquema `pwt`. `null` sin configuración. */
export async function loadCloud(config = cloudConfig()): Promise<Cloud | null> {
  if (!config) return null
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(config.url, config.key, {
    db: { schema: 'pwt' },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'daily-pwt:auth' },
  }) as unknown as SupabaseClient
  return { api: supabaseApi(client), auth: supabaseAuth(client) }
}
