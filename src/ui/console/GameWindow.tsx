/**
 * Ventana del juego con su marco (DEC-95). Posición y tamaño en teselas, como las plantillas de ventana del juego (`WindowTemplate`): el
 * marco va por fuera, una tesela a cada lado.
 */
import type { ReactNode } from 'react'
import { useConsoleTheme } from './ConsoleStage'

type GameWindowProps = { x: number; y: number; width: number; height: number; children?: ReactNode }

export function GameWindow({ x, y, width, height, children }: GameWindowProps) {
  const theme = useConsoleTheme()
  if (!theme.frame) throw new Error(`El tema ${theme.id} no tiene marco de ventana`)
  const t = theme.frame.tile
  return (
    <div className="game-window" style={{ left: x * t - t, top: y * t - t, width: width * t + 2 * t, height: height * t + 2 * t }}>
      {children}
    </div>
  )
}
