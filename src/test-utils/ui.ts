import { act } from '@testing-library/react'
import { vi } from 'vitest'

/** Avanza los temporizadores falsos lo suficiente para que terminen animaciones y turnos automáticos. */
export async function settle(ms = 30_000): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
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
