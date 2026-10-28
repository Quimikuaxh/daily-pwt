import { describe, expect, it } from 'vitest'
import type { EngineEnd } from '../battle/protocol'
import type { NewOfficial } from '../storage/gameStore'
import { accountStorageKey, LocalStorageStore } from '../storage/localStorageStore'
import { cloudDay, fakeApi, fakeAuth, fakeCloud, networkError, serverError } from '../test-utils/cloud'
import { MemoryStorage } from '../test-utils/memoryStorage'
import { Account, ACCOUNT_SESSION_KEY, GUEST_CLAIM_KEY } from './account'
import { cloudConfig } from './config'

// UT-98 · F4 (RF-93 a RF-99, RF-104b; DEC-63): sesión, almacén de cada modo y réplica del oficial.
const TODAY = '2026-10-27'
const entry: NewOfficial = { date: TODAY, challengeNumber: 4, trainerId: 'misty', variantId: 'misty-1', dataVersion: 'v1', startedAt: 'x', battle: { seed: 's1', ai: 'heuristic', leadIndex: 0 } }
const WIN: EngineEnd = { result: 'win', reason: 'faint', turns: 3, playerAlive: 6, rivalFainted: 6, playerFainted: [false, false, false, false, false, false] }
const GOOGLE = { userId: 'g1', anonymous: false }
const CREDENTIAL = { token: 'id-token', nonce: 'nonce' }

function setup(cloud: ReturnType<typeof fakeCloud> | null) {
  const storage = new MemoryStorage()
  const local = new LocalStorageStore(storage)
  const account = new Account(cloud ? Promise.resolve(cloud) : null, storage, local)
  return { storage, local, account }
}

describe('Account (UT-98)', () => {
  it('sin Supabase configurado, desactivada: todo en local', async () => {
    const { account, local } = setup(null)
    await account.start()
    expect(account.getState()).toEqual({ status: 'disabled' })
    expect(account.store).toBe(local)
    expect(account.api).toBeNull()
    expect(cloudConfig({})).toBeNull()
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'https://x.supabase.co', key: 'k' })
  })

  it('sin sesión abre una anónima con nickname: juega con el historial local y su oficial se envía (RF-104b, RF-112)', async () => {
    const cloud = fakeCloud(null, fakeApi({ ensureProfile: async () => ({ nickname: 'entrenador_12345', created: true, registered: false }) }))
    const { account, local } = setup(cloud)
    await account.start()
    expect(account.getState()).toMatchObject({ status: 'guest', userId: 'anon-1', nickname: 'entrenador_12345' })
    await account.setNickname('Invitado')
    expect(account.getState()).toMatchObject({ status: 'guest', nickname: 'Invitado' })
    expect(account.store).toBe(local)
    account.officialStarted(entry, { player: 6, rival: 6 })
    account.officialFinished(TODAY, WIN, [{ type: 'move', slot: 0 }])
    await account.refresh()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cloud.api.startOfficial).toHaveBeenCalled()
    expect(cloud.api.finishOfficial).toHaveBeenCalled()
    expect(cloud.api.importDays).not.toHaveBeenCalled()
  })

  it('si el servicio no responde, se juega en local y se avisa (RF-93)', async () => {
    const cloud = fakeCloud(null, fakeApi(), fakeAuth(null, { signInAnonymously: async () => Promise.reject(networkError()) }))
    const { account, local } = setup(cloud)
    await account.start()
    expect(account.getState()).toEqual({ status: 'offline' })
    expect(account.store).toBe(local)
    account.officialStarted(entry, { player: 6, rival: 6 })
    expect(cloud.api.startOfficial).not.toHaveBeenCalled()
  })

  it('con Google: perfil, sube el historial terminado del navegador, baja el de la cuenta y usa su caché (RF-97, RF-99)', async () => {
    const api = fakeApi({
      myDays: async () => [cloudDay({ date: '2026-10-20' }), cloudDay({ date: '2026-10-21', status: 'lost', survivors: 0 })],
      mySummary: async () => ({ nickname: 'Jose', registered: true, points: [{ date: '2026-10-20', points: 4.5, provisional: false }], incomingRequests: 2 }),
    })
    const { account, local, storage } = setup(fakeCloud(GOOGLE, api))
    local.startOfficial({ ...entry, date: '2026-10-19' })
    local.finishOfficial('2026-10-19', WIN, 'y')
    local.startOfficial(entry)
    await account.start()

    expect(api.ensureProfile).toHaveBeenCalled()
    expect(api.importDays.mock.calls[0][0].map((day: { date: string }) => day.date)).toEqual(['2026-10-19'])
    expect(account.getState()).toMatchObject({ status: 'signedIn', userId: 'g1', nickname: 'Jose', summary: { incomingRequests: 2 } })
    expect(account.store).not.toBe(local)
    expect(account.store.listDays().map((day) => [day.date, day.status])).toEqual([['2026-10-20', 'won'], ['2026-10-21', 'lost']])
    expect(storage.getItem(accountStorageKey('g1'))).not.toBeNull()
    // El historial del navegador no se toca.
    expect(local.listDays()).toHaveLength(2)
  })

  it('cerrar sesión vuelve al historial del navegador con una sesión anónima nueva, sin borrar nada (RF-96)', async () => {
    const cloud = fakeCloud(GOOGLE)
    const { account, local } = setup(cloud)
    await account.start()
    await account.signOut()
    expect(cloud.auth.signOut).toHaveBeenCalled()
    expect(account.getState()).toMatchObject({ status: 'guest', userId: 'anon-1' })
    expect(account.store).toBe(local)
  })

  it('sin cuenta, si no se puede pedir el perfil, se juega igual sin nombre', async () => {
    const cloud = fakeCloud(null, fakeApi({ ensureProfile: async () => Promise.reject(networkError()) }))
    const { account } = setup(cloud)
    await account.start()
    expect(account.getState()).toMatchObject({ status: 'guest', nickname: null })
  })

  it('RF-98: el oficial de hoy ya empezado en otro dispositivo pasa a la caché y se avisa', async () => {
    const theirs = cloudDay({ date: TODAY, status: 'inProgress', battle: { seed: 'otra', ai: 'heuristic', leadIndex: 2, decisions: [{ type: 'move', slot: 1 }], checkpoint: { decisions: 1, turn: 1, playerRemaining: 6, rivalRemaining: 6 } } })
    const api = fakeApi({ startOfficial: async () => ({ created: false, day: theirs }) })
    const { account } = setup(fakeCloud(GOOGLE, api))
    await account.start()
    const conflicts: string[] = []
    account.onConflict((date) => conflicts.push(date))
    account.store.startOfficial(entry)
    account.officialStarted(entry, { player: 6, rival: 6 })
    await account.refresh()
    expect(conflicts).toEqual([TODAY])
    expect(account.store.getDay(TODAY)?.battle).toMatchObject({ seed: 'otra', leadIndex: 2 })
  })

  it('cambiar el nickname actualiza el estado; si está cogido, lanza y no cambia', async () => {
    const api = fakeApi({ setNickname: async (nickname: string) => (nickname === 'Cogido' ? Promise.reject(new Error('nickname_taken')) : nickname) })
    const { account } = setup(fakeCloud(GOOGLE, api))
    await account.start()
    await account.setNickname('Nuevo')
    expect(account.getState()).toMatchObject({ nickname: 'Nuevo' })
    await expect(account.setNickname('Cogido')).rejects.toThrow()
    expect(account.getState()).toMatchObject({ nickname: 'Nuevo' })
  })

  it('iniciar sesión sin cuenta (DEC-70): envía lo pendiente, pide el código, abre la sesión con la credencial y canjea el código sin recargar', async () => {
    const cloud = fakeCloud(null)
    const { account, storage } = setup(cloud)
    await account.start()
    await account.signIn(CREDENTIAL)
    expect(cloud.api.createGuestClaim).toHaveBeenCalled()
    expect(cloud.auth.signInWithGoogle).toHaveBeenCalledWith(CREDENTIAL)
    expect(cloud.api.claimGuest).toHaveBeenCalledWith('codigo-1')
    expect(storage.getItem(GUEST_CLAIM_KEY)).toBeNull()
    expect(cloud.api.createGuestClaim.mock.invocationCallOrder[0]).toBeLessThan(cloud.auth.signInWithGoogle.mock.invocationCallOrder[0])
    expect(account.getState()).toMatchObject({ status: 'signedIn', userId: 'g1' })
    expect(storage.getItem(ACCOUNT_SESSION_KEY)).toBe('g1')
  })

  it('si no se puede pedir el código, se inicia sesión igual', async () => {
    const cloud = fakeCloud(null, fakeApi({ createGuestClaim: async () => Promise.reject(networkError()) }))
    const { account } = setup(cloud)
    await account.start()
    await account.signIn(CREDENTIAL)
    expect(cloud.api.claimGuest).not.toHaveBeenCalled()
    expect(account.getState()).toMatchObject({ status: 'signedIn' })
  })

  it('si Google o Supabase rechazan la credencial, lanza, borra el código y se sigue sin cuenta', async () => {
    const cloud = fakeCloud(null, fakeApi(), fakeAuth(null, { signInWithGoogle: async () => Promise.reject(serverError('invalid_credentials')) }))
    const { account, storage } = setup(cloud)
    await account.start()
    await expect(account.signIn(CREDENTIAL)).rejects.toThrow()
    expect(storage.getItem(GUEST_CLAIM_KEY)).toBeNull()
    expect(account.getState()).toMatchObject({ status: 'guest' })
  })

  it('al volver con la cuenta canjea el código una vez y, si la cuenta es nueva, se queda con el nombre del navegador', async () => {
    const api = fakeApi({ claimGuest: async () => ({ days: 3, nickname: 'Invitado' }) })
    const { account, storage } = setup(fakeCloud(GOOGLE, api))
    storage.setItem(GUEST_CLAIM_KEY, 'codigo-9')
    await account.start()
    expect(api.claimGuest).toHaveBeenCalledWith('codigo-9')
    expect(storage.getItem(GUEST_CLAIM_KEY)).toBeNull()
    expect(account.getState()).toMatchObject({ status: 'signedIn', nickname: 'Invitado' })
    // El canje va antes de bajar el historial, para que los días traspasados ya estén.
    expect(api.claimGuest.mock.invocationCallOrder[0]).toBeLessThan(api.myDays.mock.invocationCallOrder[0])
  })

  it('un código que el servidor rechaza no impide entrar', async () => {
    const api = fakeApi({ claimGuest: async () => Promise.reject(new Error('invalid_claim')) })
    const { account, storage } = setup(fakeCloud(GOOGLE, api))
    storage.setItem(GUEST_CLAIM_KEY, 'caducado')
    await account.start()
    expect(account.getState()).toMatchObject({ status: 'signedIn' })
    expect(storage.getItem(GUEST_CLAIM_KEY)).toBeNull()
  })

  it('RF-96b: un fallo de red al renovar la sesión no la sustituye por una anónima (se sigue en local)', async () => {
    const cloud = fakeCloud(GOOGLE, fakeApi(), fakeAuth(GOOGLE, { getSession: async () => Promise.reject(networkError()) }))
    const { account } = setup(cloud)
    await account.start()
    expect(account.getState()).toEqual({ status: 'offline' })
    expect(cloud.auth.signInAnonymously).not.toHaveBeenCalled()
    expect(account.sessionLost).toBe(false)
  })

  it('RF-96b: con cuenta queda la marca; si al volver la sesión ya no vale, se avisa y se juega sin cuenta; cerrar sesión no avisa', async () => {
    const { account, storage, local } = setup(fakeCloud(GOOGLE))
    await account.start()
    expect(storage.getItem(ACCOUNT_SESSION_KEY)).toBe('g1')

    const rejected = fakeCloud(null, fakeApi(), fakeAuth(null, { getSession: async () => Promise.reject(serverError('refresh_token_not_found')) }))
    const reopened = new Account(Promise.resolve(rejected), storage, local)
    await reopened.start()
    expect(reopened.sessionLost).toBe(true)
    expect(reopened.getState()).toMatchObject({ status: 'guest' })
    expect(storage.getItem(ACCOUNT_SESSION_KEY)).toBeNull()

    // Sin la marca (nunca hubo cuenta aquí, o se cerró sesión a propósito), no hay aviso.
    const again = new Account(Promise.resolve(fakeCloud(null)), storage, local)
    await again.start()
    expect(again.sessionLost).toBe(false)
    const signedIn = new Account(Promise.resolve(fakeCloud(GOOGLE)), storage, local)
    await signedIn.start()
    await signedIn.signOut()
    expect(storage.getItem(ACCOUNT_SESSION_KEY)).toBeNull()
  })
})
