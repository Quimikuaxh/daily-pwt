import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConsoleStage } from './ConsoleStage'
import { GameText } from './GameText'
import { GameWindow } from './GameWindow'
import { emeraldTheme } from './themes/emerald'
import { n2b2Theme } from './themes/n2b2'
import { textWidth } from './glyphs'

// DEC-95: lienzo, texto y ventanas de un tema de consola (Esmeralda), sin pantallas de campaña.
describe('lienzo de consola de un tema', () => {
  beforeEach(() => {
    // jsdom no pinta canvas: el texto se comprueba por su caja y su nombre accesible.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  it('apila las pantallas del tema en píxeles del juego, a la escala dada', () => {
    const { container } = render(<ConsoleStage theme={emeraldTheme} scale={3} screens={[<p key="a">arriba</p>, <p key="b">abajo</p>]} />)
    const stage = container.querySelector('.console-stage') as HTMLElement
    expect(stage.dataset.theme).toBe('emerald')
    expect(stage.style.getPropertyValue('--screen-w')).toBe('240px')
    expect(stage.style.getPropertyValue('--screens')).toBe('2')
    expect(stage.style.getPropertyValue('--k')).toBe('3')
    expect(container.querySelectorAll('.console-screen')).toHaveLength(2)
  })

  it('el texto se pinta con su ancho del juego y se lee igual que se ve', () => {
    render(<ConsoleStage theme={emeraldTheme} scale={2} screens={[<GameText key="t" text="GROVYLE {LV}19" x={8} y={4} />]} />)
    const text = screen.getByRole('img', { name: 'GROVYLE Nv19' }) as HTMLCanvasElement
    expect(text.width).toBe(textWidth(emeraldTheme.font as never, 'GROVYLE {LV}19'))
    expect(text.height).toBe(16)
    expect(text.style.left).toBe('8px')
  })

  it('alinea a la derecha y al centro dentro de su hueco, y usa la estrecha si no cabe', () => {
    render(
      <ConsoleStage
        theme={emeraldTheme}
        scale={2}
        screens={[
          <div key="t">
            <GameText text="51" x={0} width={40} align="right" />
            <GameText text="SÍ" x={0} width={40} align="center" />
            <GameText text="CRAWDAUNTCRAWDAUNT" width={60} fit />
          </div>,
        ]}
      />,
    )
    const right = screen.getByRole('img', { name: '51' }) as HTMLCanvasElement
    expect(Number.parseInt(right.style.left, 10) + right.width).toBe(40)
    const center = screen.getByRole('img', { name: 'SÍ' }) as HTMLCanvasElement
    expect(Number.parseInt(center.style.left, 10)).toBe(Math.floor((40 - center.width) / 2))
    const long = screen.getByRole('img', { name: 'CRAWDAUNTCRAWDAUNT' }) as HTMLCanvasElement
    expect(long.width).toBe(textWidth(emeraldTheme.font as never, 'CRAWDAUNTCRAWDAUNT', 'narrow'))
  })

  it('la ventana va en teselas con el marco por fuera; el tema de N2/B2 no pinta texto de mapa de bits', () => {
    const { container } = render(<ConsoleStage theme={emeraldTheme} scale={2} screens={[<GameWindow key="w" x={2} y={15} width={26} height={4} />]} />)
    const win = container.querySelector('.game-window') as HTMLElement
    expect([win.style.left, win.style.top, win.style.width, win.style.height]).toEqual(['8px', '112px', '224px', '48px'])
    expect(n2b2Theme.font.kind).toBe('ttf')
    expect(n2b2Theme.screen).toEqual({ w: 256, h: 192 })
  })
})
