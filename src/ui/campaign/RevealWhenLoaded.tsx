import { useRef, type ReactNode } from 'react'
import { useImagesLoadedIn, useImagesReady } from '../battle/preloadAssets'
import { SCREEN_BACKGROUNDS } from './campaignPreload'

/**
 * Enseña su contenido cuando todas sus `<img>` han cargado y los fondos de todas las pantallas están decodificados (como mucho, 1,5 s
 * cada cosa), nunca a medio cargar: la primera vez que se abría una pantalla, su fondo llegaba después que los textos, y los que cambian
 * dentro de una pantalla (DATOS, cajas del combate, la Ficha) también (Jose, 13/11/2026). Con `display: contents` no cambia la
 * maquetación; la visibilidad se hereda. Se monta con una `key` por pantalla para que cada una espere a las suyas.
 */
export function RevealWhenLoaded({ children }: { children: ReactNode }) {
  const ref = useRef(null as HTMLDivElement | null)
  const own = useImagesLoadedIn(ref)
  const backgrounds = useImagesReady(SCREEN_BACKGROUNDS, true)
  const loaded = own && backgrounds
  return <div ref={ref} className="campaign-reveal" style={{ display: 'contents', visibility: loaded ? undefined : 'hidden' }}>{children}</div>
}
