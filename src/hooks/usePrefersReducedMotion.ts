import { useEffect, useState } from 'react'
import type { AnimationMode } from '../storage/settings'

const QUERY = '(prefers-reduced-motion: reduce)'

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(QUERY)
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

/** Sin animaciones en el combate: «Nunca», o «Según el sistema» con «reducir movimiento» activado (con «Siempre», nunca). */
export function useReducedMotion(mode: AnimationMode): boolean {
  const systemReduced = usePrefersReducedMotion()
  return mode === 'never' || (mode === 'system' && systemReduced)
}
