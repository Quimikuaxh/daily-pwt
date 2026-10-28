import { madridInstant } from '../core/date'
import type { GameStore } from '../storage/gameStore'
import { DEFAULT_SETTINGS } from '../storage/settings'
import type { MenuContext } from '../ui/menu/AppMenu'
import { act } from '@testing-library/react'
import { vi } from 'vitest'

/** Avanza los temporizadores falsos lo suficiente para que terminen animaciones y turnos automáticos. */
export async function settle(ms = 30_000): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Fija el reloj del sistema a la hora de Madrid indicada del día YYYY-MM-DD (el reto va por la hora de Madrid, RF-01). */
export function setMadridTime(date: string, h = 12, mi = 0, s = 0): void {
  vi.setSystemTime(madridInstant(date, h, mi, s))
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

/** Menú de cabecera (Estadísticas, Ayuda, Ajustes) para pantallas montadas sueltas en los tests. */
export const testMenu = (store: GameStore, over: Partial<MenuContext> = {}): MenuContext => ({
  store,
  settings: DEFAULT_SETTINGS,
  onSettingsChange: () => {},
  onClearData: () => {},
  ...over,
})
