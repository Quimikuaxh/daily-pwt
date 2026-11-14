/**
 * Texto de Teselia pintado en un canvas (fuente del juego a 13 px, el tamaño al que cae en la rejilla, con los bordes sin suavizar). Se usa
 * en las pantallas que se exportan como imagen (Salón de la Fama, Ficha, compartir): `exportScreens` solo copia imágenes y canvas. Mismo
 * sitio que un `.unova-text` con el mismo `top` (línea base a 13 px). El texto no es accesible: lo da la etiqueta del contenedor.
 */
import { useEffect, useRef } from 'react'

const FONT = '13px Game'
const HEIGHT = 16
const BASELINE = 13

type PixelTextProps = {
  text: string
  left: number
  top: number
  /** Ancho de la caja (por defecto, el del texto) y alineación dentro de ella. */
  width?: number
  align?: 'left' | 'center' | 'right'
  color?: string
  shadow?: string | null
  /** Fondo de la caja (para tapar un rótulo de la pieza). */
  background?: string
}

/** Deja cada píxel opaco o transparente: quita el suavizado del navegador. */
export function crispen(pixels: Uint8ClampedArray): void {
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = pixels[i] >= 128 ? 255 : 0
}

export function PixelText({ text, left, top, width, align = 'left', color = '#f8f8f8', shadow = '#28283c', background }: PixelTextProps) {
  const canvas = useRef(null as HTMLCanvasElement | null)

  useEffect(() => {
    let alive = true
    const draw = () => {
      const element = canvas.current
      const g = element?.getContext('2d')
      if (!element || !g || !alive) return
      g.font = FONT
      const textWidth = Math.ceil(g.measureText(text).width) + (shadow ? 1 : 0)
      const w = width ?? textWidth
      if (element.width !== w) element.width = w
      element.height = HEIGHT
      const x = align === 'center' ? Math.round((w - textWidth) / 2) : align === 'right' ? w - textWidth : 0
      const layer = (fill: string, dx: number, dy: number) => {
        const off = document.createElement('canvas')
        off.width = w
        off.height = HEIGHT
        const o = off.getContext('2d')
        if (!o) return
        o.font = FONT
        o.fillStyle = fill
        o.textBaseline = 'alphabetic'
        o.fillText(text, x + dx, BASELINE + dy)
        const image = o.getImageData(0, 0, w, HEIGHT)
        crispen(image.data)
        o.putImageData(image, 0, 0)
        g.drawImage(off, 0, 0)
      }
      g.clearRect(0, 0, w, HEIGHT)
      if (background) {
        g.fillStyle = background
        g.fillRect(0, 0, w, HEIGHT)
      }
      if (shadow) layer(shadow, 1, 1)
      layer(color, 0, 0)
    }
    if (typeof document !== 'undefined' && document.fonts?.load) void document.fonts.load(FONT).then(draw, draw)
    else draw()
    return () => { alive = false }
  }, [text, width, align, color, shadow, background])

  return <canvas ref={canvas} className="unova-pixel-text" width={width ?? 1} height={HEIGHT} style={{ left, top }} aria-hidden="true" />
}

/** Fondo liso de toda la pantalla en un canvas (un fondo CSS no saldría en la imagen para compartir). */
export function CanvasFill({ color }: { color: string }) {
  const canvas = useRef(null as HTMLCanvasElement | null)
  useEffect(() => {
    const g = canvas.current?.getContext('2d')
    if (!g) return
    g.fillStyle = color
    g.fillRect(0, 0, 256, 192)
  }, [color])
  return <canvas ref={canvas} className="unova-canvas-fill" width={256} height={192} aria-hidden="true" />
}
