import { useEffect } from 'react'
import { imagesReady } from '../battle/preloadAssets'

/**
 * Pide y decodifica de antemano las imágenes que una pantalla de la campaña puede enseñar al interactuar (otra ciudad, otro Pokémon,
 * otra página, otro objeto), para que al cambiar salga todo a la vez y no la ventana primero y los sprites unos milisegundos después
 * (Jose, 13/11/2026). Solo las de esa pantalla: nunca el catálogo entero de especies u objetos.
 */
export function usePreloadImages(urls: readonly string[]): void {
  const key = [...new Set(urls)].join('|')
  useEffect(() => {
    if (key) void imagesReady(key.split('|'), 10_000)
  }, [key])
}
