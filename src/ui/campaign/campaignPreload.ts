/**
 * Precarga de la campaña (Jose, 12/11/2026: al entrar, no conforme se necesita): toda la interfaz de Esmeralda (`ui-assets.json`, unos
 * 870 KB) y los sprites de lo que puede salir pronto: el equipo (frente, espalda e icono), el rival del tramo y la oferta del draft.
 * Los demás sprites (386 especies) no: se cargan al verlos, como en el reto diario (CLAUDE.md, «Sprites»).
 */
import uiAssets from '../../generated/emerald/ui-assets.json'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'

type Preloadable = { members: readonly { species: string; fainted?: boolean }[]; offer: readonly string[] }
type ImageFactory = () => { src: string }

const requested = new Set<string>()

export function campaignPreloadUrls(state: Preloadable | null, rivalSpecies: readonly string[]): string[] {
  const team = (state?.members ?? []).filter((member) => !member.fainted).map((member) => member.species)
  return [
    ...(uiAssets as string[]).map((name) => emeraldTheme.asset(name)),
    ...team.flatMap((species) => [emeraldSprite('front', species), emeraldSprite('back', species), emeraldSprite('icon', species)]),
    ...rivalSpecies.map((species) => emeraldSprite('front', species)),
    ...(state?.offer ?? []).map((species) => emeraldSprite('front', species)),
  ]
}

/** Pide al navegador lo que aún no se haya pedido (cada URL, una vez por página). */
export function preloadCampaign(state: Preloadable | null, rivalSpecies: readonly string[], createImage: ImageFactory = () => new Image()): number {
  let count = 0
  for (const url of campaignPreloadUrls(state, rivalSpecies)) {
    if (requested.has(url)) continue
    requested.add(url)
    createImage().src = url
    count++
  }
  return count
}
