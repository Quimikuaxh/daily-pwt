/**
 * Precarga de la campaña (Jose, 12/11/2026: al entrar, no conforme se necesita): toda la interfaz de Esmeralda (`ui-assets.json`, unos
 * 870 KB) y los sprites de lo que puede salir pronto: el equipo (frente, espalda e icono), el rival del tramo y la oferta del draft.
 * Los demás sprites (386 especies) no: se cargan al verlos, como en el reto diario (CLAUDE.md, «Sprites»).
 */
import uiAssets from '../../generated/emerald/ui-assets.json'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'

type Preloadable = { members: readonly { species: string; fainted?: boolean }[]; offer: readonly string[] }
type ImageFactory = () => { src: string; decode?: () => Promise<void> }

const requested = new Set<string>()
const BACKGROUND = /fondo|escenario|ficha|mapa|combate-caja|datos-|resultado|^mochila-(brendan|may)$/
/**
 * Fondos de todas las pantallas de la campaña, también los que cambian dentro de una (páginas de DATOS, cajas del combate, la Ficha
 * del resultado, la Mochila de cada bolsillo): unos 260 KB. Se piden los primeros y cada pantalla espera a tenerlos (`RevealWhenLoaded`),
 * para que ninguno llegue tarde la primera vez (Jose, 13/11/2026).
 */
export const SCREEN_BACKGROUNDS: readonly string[] = (uiAssets as string[]).filter((name) => BACKGROUND.test(name)).map((name) => emeraldTheme.asset(name))

export function campaignPreloadUrls(state: Preloadable | null, rivalSpecies: readonly string[]): string[] {
  const team = (state?.members ?? []).filter((member) => !member.fainted).map((member) => member.species)
  return [
    // Primero los fondos de cada pantalla: si se entra enseguida en una, es lo que más se nota que falta (Jose, 13/11/2026).
    ...[...(uiAssets as string[])].sort((a, b) => Number(!BACKGROUND.test(a)) - Number(!BACKGROUND.test(b))).map((name) => emeraldTheme.asset(name)),
    ...team.flatMap((species) => [emeraldSprite('front', species), emeraldSprite('back', species), emeraldSprite('icon', species)]),
    ...rivalSpecies.map((species) => emeraldSprite('front', species)),
    ...(state?.offer ?? []).map((species) => emeraldSprite('front', species)),
  ]
}

/** Pide al navegador lo que aún no se haya pedido (cada URL, una vez por página). */
/** Imágenes precargadas, retenidas para que el navegador no descarte su decodificación. */
const decoded: ReturnType<ImageFactory>[] = []

export function preloadCampaign(state: Preloadable | null, rivalSpecies: readonly string[], createImage: ImageFactory = () => new Image()): number {
  let count = 0
  for (const url of campaignPreloadUrls(state, rivalSpecies)) {
    if (requested.has(url)) continue
    requested.add(url)
    const image = createImage()
    image.src = url
    // Decodificada y retenida: al montar una pantalla, el fondo se pinta en el primer fotograma (sin esto, al pasar de una pantalla a
    // otra salía un fotograma en negro con solo los textos; Jose, 12/11/2026).
    void image.decode?.().catch(() => undefined)
    decoded.push(image)
    count++
  }
  return count
}
