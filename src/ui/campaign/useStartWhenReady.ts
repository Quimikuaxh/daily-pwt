import { useEffect } from 'react'

/**
 * Crea algo (la sesión de combate) cuando el almacén lo permita, una sola vez: con `active` y mientras no exista, escucha el almacén y
 * lo comprueba también al suscribirse. Si el guardado terminó entre el render y este efecto, no llega otro aviso y, sin la comprobación
 * inicial, la pantalla se quedaba en negro (Jose, 14/11/2026, al entrar contra Sixto con la cuenta).
 */
export function useStartWhenReady(active: boolean, subscribe: ((listener: () => void) => () => void) | undefined, canStart: () => boolean, start: () => void): void {
  useEffect(() => {
    if (!active || !subscribe) return
    let started = false
    const tryStart = () => {
      if (started || !canStart()) return
      started = true
      start()
    }
    const unsubscribe = subscribe(tryStart)
    tryStart()
    return unsubscribe
  }, [active, subscribe, canStart, start])
}
