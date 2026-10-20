import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { getDailyChallenge } from '../core/challenge'
import type { GameData } from './types'

/** Avanza los temporizadores falsos lo suficiente para que terminen animaciones y turnos automáticos. */
export async function settle(ms = 30_000): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Primera fecha a partir de `from` cuyo rival del día es `trainerId`. */
export function dateForTrainer(trainerId: string, data: GameData, from = '2026-10-17'): string {
  const [y, m, d] = from.split('-').map(Number)
  for (let i = 0; i < 400; i++) {
    const date = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10)
    if (getDailyChallenge(date, data).trainer.id === trainerId) return date
  }
  throw new Error('sin fecha para ' + trainerId)
}

/** Fija el reloj del sistema a una fecha local YYYY-MM-DD a la hora indicada. */
export function setLocalTime(date: string, h = 12, mi = 0, s = 0): void {
  const [y, m, d] = date.split('-').map(Number)
  vi.setSystemTime(new Date(y, m - 1, d, h, mi, s))
}

export function mockMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matches && /reduce/.test(query),
      media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  })
}
