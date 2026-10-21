import { useEffect, useRef, useState } from 'react'

type AnimatedValueOptions = {
  /** Misma duración que tenía la transición CSS de la barra (700 ms a x1); lineal, como la barra del juego. */
  durationMs: number
  /** Sin animación (prefers-reduced-motion): el valor final directo. */
  enabled: boolean
  /** Cuando cambia (otro Pokémon activo), el valor salta al destino en vez de contar desde el del anterior. */
  resetKey: string
}

/**
 * Valor que va hacia `target` de forma lineal en `durationMs`. De él derivan a la vez la anchura de la barra de PS y el número, así que
 * van siempre a la par. Devuelve un decimal: quien lo pinta redondea (el número a entero, la barra a píxel).
 */
export function useAnimatedValue(target: number, { durationMs, enabled, resetKey }: AnimatedValueOptions): number {
  const [value, setValue] = useState(target)
  const currentRef = useRef(target)
  const keyRef = useRef(resetKey)

  useEffect(() => {
    let frame = 0
    const settle = (next: number) => {
      currentRef.current = next
      setValue(next)
    }
    if (!enabled || keyRef.current !== resetKey || durationMs <= 0 || currentRef.current === target) {
      keyRef.current = resetKey
      settle(target)
      return
    }
    const from = currentRef.current
    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      settle(progress >= 1 ? target : from + (target - from) * progress)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, enabled, resetKey])

  return value
}
