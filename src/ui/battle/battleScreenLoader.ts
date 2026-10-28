import { useEffect, useState } from 'react'
import type { BattleScreen as BattleScreenComponent } from './BattleScreen'

type BattleScreenType = typeof BattleScreenComponent

/**
 * La pantalla de combate no hace falta para pintar Hoy, así que va en un fichero aparte (E2E-21: ruta crítica < 230 KB) y `main.tsx` la
 * trae en reposo. Con `React.lazy` cada combate pasaría por un render en blanco aunque ya estuviera descargada; con este cargador, si ya
 * está, se pinta al momento (los tests la cargan de antemano en `vitest.setup.ts`).
 */
let loaded: BattleScreenType | null = null
let pending: Promise<BattleScreenType> | null = null

export function loadBattleScreen(): Promise<BattleScreenType> {
  pending ??= import('./BattleScreen').then((module) => (loaded = module.BattleScreen))
  return pending
}

/** El componente si ya está descargado; si no, `null` y lo descarga (se vuelve a pintar al llegar). */
export function useBattleScreen(): BattleScreenType | null {
  const [component, setComponent] = useState(() => loaded)
  useEffect(() => {
    if (component) return
    let active = true
    loadBattleScreen().then((ready) => active && setComponent(() => ready))
    return () => {
      active = false
    }
  }, [component])
  return component
}
