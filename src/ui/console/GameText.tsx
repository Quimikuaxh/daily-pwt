/**
 * Texto con los glifos originales del juego (DEC-95), pintado en un canvas a la resolución del juego: cada glifo de la máscara de sombra y
 * la de tinta, teñidas con el color con nombre del tema. El nombre accesible es el propio texto (sin las llaves de los símbolos), así que
 * lo que se lee y lo que se ve salen de la misma cadena, que viene de i18n como el resto de textos. Solo para temas con fuente de mapa de
 * bits.
 */
import { useEffect, useRef } from 'react'
import { useConsoleTheme } from './ConsoleStage'
import { accessibleText, glyphCodes, textWidth } from './glyphs'
import { loadImage, tint } from './glyphSheets'
import type { BitmapFont } from './theme'

type GameTextProps = {
  text: string
  /** Posición en píxeles del juego (esquina superior izquierda del hueco). */
  x?: number
  y?: number
  /** Fuente del juego (`normal`, `short`, `small`, `narrow` en Esmeralda). */
  face?: string
  /** Color con nombre del tema. */
  color?: string
  /** Alineación dentro de un hueco de `width` píxeles. */
  align?: 'left' | 'center' | 'right'
  width?: number
  /** Píxeles entre glifos (el juego lo usa en algunos rótulos). */
  spacing?: number
  /** Si no cabe en `width` con su fuente, usa la estrecha, como el juego con los nombres largos. */
  fit?: boolean
  /** Decorativo: sin nombre accesible (lo dice otro elemento). */
  hidden?: boolean
}

export function GameText({ text, x = 0, y = 0, face = 'normal', color = 'ventana', align = 'left', width = 0, spacing = 0, fit = false, hidden = false }: GameTextProps) {
  const theme = useConsoleTheme()
  if (theme.font.kind !== 'bitmap') throw new Error(`GameText necesita una fuente de mapa de bits (${theme.id})`)
  const font: BitmapFont = theme.font
  const ref = useRef(null as HTMLCanvasElement | null)
  const usedFace = fit && width && textWidth(font, text, face, spacing) > width ? 'narrow' : face
  const painted = textWidth(font, text, usedFace, spacing)
  const [ink, shadow] = theme.colors[color] ?? theme.colors.ventana
  const left = align === 'center' ? x + Math.floor((width - painted) / 2) : align === 'right' ? x + width - painted : x

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    let cancelled = false
    void Promise.all([loadImage(font.mask(usedFace, 'ink')), shadow ? loadImage(font.mask(usedFace, 'shadow')) : null]).then(([inkMask, shadowMask]) => {
      if (cancelled) return
      const inkSheet = tint(inkMask, `${theme.id}:${usedFace}:ink:${ink}`, ink)
      const shadowSheet = shadowMask && shadow ? tint(shadowMask, `${theme.id}:${usedFace}:shadow:${shadow}`, shadow) : null
      const { w: cellW, h: cellH, columns } = font.glyph
      g.clearRect(0, 0, canvas.width, canvas.height)
      let pen = 0
      for (const code of glyphCodes(font, text)) {
        const sx = (code % columns) * cellW
        const sy = Math.floor(code / columns) * cellH
        if (shadowSheet) g.drawImage(shadowSheet, sx, sy, cellW, cellH, pen, 0, cellW, cellH)
        if (inkSheet) g.drawImage(inkSheet, sx, sy, cellW, cellH, pen, 0, cellW, cellH)
        pen += (font.widths[usedFace]?.[code] ?? 0) + spacing
      }
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [font, theme.id, text, usedFace, ink, shadow, spacing])

  const label = accessibleText(text)
  return (
    <canvas
      ref={ref}
      className="game-text"
      width={Math.max(1, painted)}
      height={font.glyph.h}
      style={{ left, top: y }}
      {...(hidden || !label ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    />
  )
}
