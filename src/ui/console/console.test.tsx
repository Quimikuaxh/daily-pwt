import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConsoleStage } from './ConsoleStage'
import { GameText } from './GameText'
import { GameWindow } from './GameWindow'
import { emeraldTheme } from './themes/emerald'
import { n2b2Theme } from './themes/n2b2'
import { textWidth } from './glyphs'
import * as glyphSheets from './glyphSheets'

// DEC-95: lienzo, texto y ventanas de un tema de consola (Esmeralda), sin pantallas de campaña.
describe('lienzo de consola de un tema', () => {
  beforeEach(() => {
    // jsdom no pinta canvas: el texto se comprueba por su caja y su nombre accesible.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([
    { text: 'GROVYLE', hidden: true },
    { text: '{SPACER}', hidden: false },
    { text: '', hidden: false },
  ])('UT-168: oculta del lector el texto decorativo o sin etiqueta: $text', ({ text, hidden }) => {
    const { container } = render(<ConsoleStage theme={emeraldTheme} scale={2}
      screens={[<GameText key="t" text={text} hidden={hidden} />]} />)
    const canvas = container.querySelector('canvas')!
    expect(canvas).toHaveAttribute('aria-hidden', 'true')
    expect(canvas).not.toHaveAttribute('aria-label')
    expect(canvas).not.toHaveAttribute('role')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(canvas.width).toBeGreaterThanOrEqual(1)
  })

  it('UT-168: un símbolo pintable sin etiqueta queda oculto al lector de pantalla', () => {
    if (emeraldTheme.font.kind !== 'bitmap') throw new Error('La prueba necesita la fuente bitmap')
    const theme = { ...emeraldTheme, font: { ...emeraldTheme.font,
      charmap: { ...emeraldTheme.font.charmap, '{SIMBOLO}': emeraldTheme.font.charmap.A } } }
    const { container } = render(<ConsoleStage theme={theme} scale={2}
      screens={[<GameText key="t" text="{SIMBOLO}" />]} />)
    const canvas = container.querySelector('canvas')!
    expect(canvas.width).toBeGreaterThan(1)
    expect(canvas).toHaveAttribute('aria-hidden', 'true')
    expect(canvas).not.toHaveAttribute('aria-label')
  })

  it('UT-169: un color inexistente pinta tinta y sombra con el color de ventana', async () => {
    const context = { clearRect: vi.fn(), drawImage: vi.fn() }
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const mask = document.createElement('img')
    const sheet = document.createElement('canvas')
    vi.spyOn(glyphSheets, 'loadImage').mockResolvedValue(mask)
    const tint = vi.spyOn(glyphSheets, 'tint').mockReturnValue(sheet)
    render(<ConsoleStage theme={emeraldTheme} scale={2}
      screens={[<GameText key="t" text="AB" color="color-inexistente" />]} />)
    await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(4))
    expect(tint).toHaveBeenCalledTimes(2)
    expect(tint).toHaveBeenCalledWith(mask, `emerald:normal:ink:${emeraldTheme.colors.ventana[0]}`, emeraldTheme.colors.ventana[0])
    expect(tint).toHaveBeenCalledWith(mask, `emerald:normal:shadow:${emeraldTheme.colors.ventana[1]}`, emeraldTheme.colors.ventana[1])
  })

  it('UT-170: sin escala fija ajusta las dos pantallas al contenedor y al alto libre, también al redimensionar', () => {
    vi.stubGlobal('innerHeight', 1000)
    const host = document.createElement('div')
    document.body.appendChild(host)
    let width = 960
    Object.defineProperty(host, 'clientWidth', { get: () => width })
    const { container, rerender, unmount } = render(<ConsoleStage theme={emeraldTheme} reservedHeight={360} screens={['a', 'b']} />, { container: host })
    const stage = container.querySelector('.console-stage')!
    try {
      expect(stage).toHaveAttribute('data-scale', '2')
      width = 360
      fireEvent(window, new Event('resize'))
      expect(stage).toHaveAttribute('data-scale', '1.5')
      expect((stage as HTMLElement).style.getPropertyValue('--k')).toBe('1.5')
      width = 960
      rerender(<ConsoleStage theme={emeraldTheme} reservedHeight={0} screens={['a', 'b']} />)
      expect(stage).toHaveAttribute('data-scale', '3')
      rerender(<ConsoleStage theme={emeraldTheme} scale={4} screens={['a', 'b']} />)
      width = 240
      fireEvent(window, new Event('resize'))
      expect(stage).toHaveAttribute('data-scale', '4')
    } finally {
      unmount()
      host.remove()
    }
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
