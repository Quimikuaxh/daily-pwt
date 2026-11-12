import { describe, expect, it } from 'vitest'
import uiAssets from '../../generated/emerald/ui-assets.json'
import { campaignPreloadUrls, preloadCampaign } from './campaignPreload'

// UT-197 · Precarga de la campaña (Jose, 12/11/2026): la interfaz entera al entrar y los sprites que pueden salir pronto, una vez.
describe('precarga de la campaña', () => {
  it('toda la interfaz de Esmeralda, el equipo vivo (frente, espalda e icono), el rival y la oferta', () => {
    const urls = campaignPreloadUrls({ members: [{ species: 'treecko' }, { species: 'ralts', fainted: true }], offer: ['zigzagoon'] }, ['geodude'])
    expect(urls).toHaveLength((uiAssets as string[]).length + 3 + 1 + 1)
    expect(urls.some((url) => url.endsWith('/ui/emerald/fabrica-fondo.png'))).toBe(true)
    expect(urls.filter((url) => url.includes('/treecko.png'))).toHaveLength(3)
    expect(urls.some((url) => url.includes('/ralts.png'))).toBe(false)
    expect(urls.some((url) => url.endsWith('/front/geodude.png'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/front/zigzagoon.png'))).toBe(true)
  })

  it('cada URL se pide una sola vez', () => {
    const asked: string[] = []
    const factory = () => { const image = { src: '' }; return new Proxy(image, { set: (target, key, value) => { if (key === 'src') asked.push(value); return Reflect.set(target, key, value) } }) }
    const first = preloadCampaign({ members: [{ species: 'mudkip' }], offer: [] }, ['nosepass'], factory)
    expect(first).toBe(asked.length)
    expect(preloadCampaign({ members: [{ species: 'mudkip' }], offer: [] }, ['nosepass'], factory)).toBe(0)
  })
})
