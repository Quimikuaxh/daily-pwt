import { vi } from 'vitest'
import type { Cloud } from '../cloud/account'
import { CloudError, type CloudApi, type CloudDay } from '../cloud/api'
import type { CloudAuth, Session } from '../cloud/auth'

/** Rechazo del servidor (`raise exception` de una función) y fallo de red, como los da `supabaseCloud.ts`. */
export const serverError = (code: string) => new CloudError(code, true)
export const networkError = () => new CloudError('Failed to fetch', false)

/** `CloudApi` falsa: todo responde bien y vacío; cada método es un `vi.fn` que los tests cambian. */
export function fakeApi(over: Partial<CloudApi> = {}): CloudApi & { [K in keyof CloudApi]: ReturnType<typeof vi.fn> } {
  const api: CloudApi = {
    ensureProfile: async () => ({ nickname: 'entrenador_00001', created: true, registered: true }),
    setNickname: async (nickname) => nickname,
    startOfficial: async (entry) => ({ created: true, day: cloudDay({ date: entry.date, battle: { ...entry.battle, decisions: [], checkpoint: null } }) }),
    saveTurn: async () => undefined,
    finishOfficial: async () => ({ validated: true }),
    voidOfficial: async () => undefined,
    importDays: async (days) => days.length,
    myDays: async () => [],
    mySummary: async () => ({ nickname: null, registered: false, points: [], incomingRequests: 0 }),
    pointsRanking: async () => [],
    streakRanking: async () => [],
    searchPlayers: async () => [],
    sendFriendRequest: async () => 'outgoing',
    respondFriendRequest: async () => undefined,
    cancelFriendRequest: async () => undefined,
    removeFriend: async () => undefined,
    listFriends: async () => [],
    ...over,
  }
  return Object.fromEntries(Object.entries(api).map(([name, method]) => [name, vi.fn(method)])) as never
}

export function fakeAuth(session: Session | null, over: Partial<CloudAuth> = {}): CloudAuth & { [K in keyof CloudAuth]: ReturnType<typeof vi.fn> } {
  let anonymous = 0
  const auth: CloudAuth = {
    getSession: async () => session,
    signInAnonymously: async () => ({ userId: `anon-${++anonymous}`, anonymous: true }),
    signInWithGoogle: async () => undefined,
    signOut: async () => undefined,
    ...over,
  }
  return Object.fromEntries(Object.entries(auth).map(([name, method]) => [name, vi.fn(method)])) as never
}

export const fakeCloud = (session: Session | null, api = fakeApi(), auth = fakeAuth(session)): Cloud & { api: typeof api; auth: typeof auth } => ({ api, auth })

/** Día de la cuenta terminado, con lo que devuelve `my_days`. */
export function cloudDay(over: Partial<CloudDay> = {}): CloudDay {
  return {
    date: '2026-10-20', challengeNumber: 1, trainerId: 'misty', variantId: 'misty-1', dataVersion: 'v1', status: 'won',
    startedAt: '2026-10-20T10:00:00.000Z', finishedAt: '2026-10-20T10:10:00.000Z', turns: 10, survivors: 3,
    playerFainted: [true, true, true, false, false, false], rivalFainted: 6, endReason: 'faint', voidReason: null, battle: null,
    imported: false, validated: true, ...over,
  }
}
