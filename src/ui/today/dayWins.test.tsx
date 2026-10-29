import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Account } from '../../cloud/account'
import { LocalStorageStore } from '../../storage/localStorageStore'
import { fakeApi, fakeCloud } from '../../test-utils/cloud'
import { makeGameData } from '../../test-utils/fixtures'
import { LAUNCH } from '../../test-utils/dates'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { setMadridTime, testMenu } from '../../test-utils/ui'
import { TodayScreen } from './TodayScreen'

// UT-120 · «Victorias: X/Y» de hoy bajo el rival (decisión de Jose, 29/10/2026).
const data = makeGameData()

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

async function mountToday(api = fakeApi(), withCloud = true) {
  setMadridTime(LAUNCH, 12, 0, 0)
  const storage = new MemoryStorage()
  const local = new LocalStorageStore(storage)
  if (!withCloud) {
    render(<TodayScreen data={data} onStart={vi.fn()} menu={testMenu(local)} />)
    return api
  }
  const account = new Account(Promise.resolve(fakeCloud({ userId: 'anon-1', anonymous: true }, api)), storage, local)
  await account.start()
  render(<TodayScreen data={data} onStart={vi.fn()} menu={testMenu(account.store, { account, accountState: account.getState() })} />)
  return api
}

describe('victorias del día bajo el rival (UT-120)', () => {
  it('pide las de hoy y las enseña como «Victorias: ganadas/terminados»', async () => {
    const api = await mountToday(fakeApi({ dayWins: async () => ({ wins: 12, players: 30 }) }))
    expect(await screen.findByText('Victorias: 12/30')).toBeInTheDocument()
    expect(api.dayWins).toHaveBeenCalledWith(LAUNCH)
  })

  it('mientras carga, la línea ya ocupa su sitio', async () => {
    await mountToday(fakeApi({ dayWins: () => new Promise(() => undefined) }))
    await waitFor(() => expect(screen.getByTestId('day-wins')).toHaveTextContent('Victorias: …'))
  })

  it('sin cuenta configurada no sale', async () => {
    await mountToday(fakeApi(), false)
    expect(screen.queryByTestId('day-wins')).toBeNull()
  })
})
