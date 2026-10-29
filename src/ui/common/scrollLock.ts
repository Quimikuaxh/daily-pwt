import { useEffect } from 'react'

let locks = 0

/**
 * Mientras haya una ventana abierta (`Modal`, `Dialog`), la página de detrás no se desplaza: ni con el dedo o la rueda sobre el fondo ni al
 * llegar al final de lo que se desplaza dentro de la ventana. Cuenta las ventanas abiertas a la vez (una de confirmación sobre otra) y
 * suelta el bloqueo al cerrarse la última.
 */
export function useScrollLock() {
  useEffect(() => {
    const root = document.documentElement
    if (locks === 0) root.classList.add('scroll-locked')
    locks += 1
    return () => {
      locks -= 1
      if (locks === 0) root.classList.remove('scroll-locked')
    }
  }, [])
}
