/**
 * Lienzo de consola de un tema (DEC-95): las pantallas del juego apiladas en píxeles lógicos y escaladas con la regla del reto diario
 * (`consoleScale`: entera desde x2, fraccionaria por debajo). Da el tema a GameText y GameWindow por contexto. Lo de dentro se coloca en
 * píxeles del juego con `position: absolute` (console.css).
 */
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { consoleScale } from '../battle/useStageScale'
import type { ConsoleTheme } from './theme'
import './console.css'

const ThemeContext = createContext(null as ConsoleTheme | null)

export function useConsoleTheme(): ConsoleTheme {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('useConsoleTheme fuera de ConsoleStage')
  return theme
}

type ConsoleStageProps = {
  theme: ConsoleTheme
  /** Una pantalla por elemento, de arriba abajo (tantas como `theme.screens`). */
  screens: readonly ReactNode[]
  /** Alto que no puede usar el lienzo (cabecera, barra del portal…), en píxeles de la ventana. */
  reservedHeight?: number
  /** Escala fija (capturas y tests); si no, la que quepa en el contenedor y la ventana. */
  scale?: number
}

export function ConsoleStage({ theme, screens, reservedHeight = 0, scale: fixedScale }: ConsoleStageProps) {
  const ref = useRef(null as HTMLDivElement | null)
  const [fitted, setFitted] = useState(2)
  const { w, h } = theme.screen
  const totalHeight = h * theme.screens

  useEffect(() => {
    if (fixedScale) return
    const update = () => {
      const width = ref.current?.parentElement?.clientWidth ?? window.innerWidth
      setFitted(consoleScale(width, window.innerHeight - reservedHeight, w, totalHeight))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [fixedScale, reservedHeight, w, totalHeight])

  const scale = fixedScale ?? fitted
  const style = {
    '--screen-w': `${w}px`,
    '--screen-h': `${h}px`,
    '--screens': theme.screens,
    '--k': scale,
    // URL absoluta: con `base: './'`, una relativa en una variable CSS se resuelve contra la hoja de estilos (assets/) y el marco no carga.
    ...(theme.frame && { '--frame': `url("${new URL(theme.frame.image, document.baseURI).href}")`, '--frame-px': `${theme.frame.tile}px`, '--frame-slice': theme.frame.slice }),
  } as CSSProperties

  return (
    <ThemeContext.Provider value={theme}>
      <div ref={ref} className="console-stage" data-theme={theme.id} data-scale={scale} style={style}>
        <div className="console-canvas">
          {screens.map((content, i) => (
            <section key={i} className="console-screen">
              {content}
            </section>
          ))}
        </div>
      </div>
    </ThemeContext.Provider>
  )
}
