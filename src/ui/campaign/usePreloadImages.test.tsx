import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { usePreloadImages } from './usePreloadImages'

const imagesReady = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('../battle/preloadAssets', () => ({ imagesReady }))

function Probe({ urls }: { urls: string[] }) {
  usePreloadImages(urls)
  return null
}

// Jose, 13/11/2026: al cambiar de ciudad, de Pokémon o de página, todo sale a la vez; las imágenes se piden al abrir la pantalla.
describe('precarga de imágenes de la campaña', () => {
  it('pide cada imagen una vez al montar y no vuelve a pedirlas si la lista no cambia', () => {
    const { rerender } = render(<Probe urls={['a.png', 'b.png', 'a.png']} />)
    expect(imagesReady).toHaveBeenCalledTimes(1)
    expect(imagesReady).toHaveBeenLastCalledWith(['a.png', 'b.png'], 10_000)
    rerender(<Probe urls={['a.png', 'b.png']} />)
    expect(imagesReady).toHaveBeenCalledTimes(1)
    rerender(<Probe urls={['c.png']} />)
    expect(imagesReady).toHaveBeenLastCalledWith(['c.png'], 10_000)
    render(<Probe urls={[]} />)
    expect(imagesReady).toHaveBeenCalledTimes(2)
  })
})
