/**
 * Luces del estadio del PWT (como en N2/B2): haces de los focos del techo y focos de colores que giran sobre el suelo,
 * manchas difuminadas rosas, turquesas,
 * amarillas y blancas repartidas en un anillo que gira despacio en el plano del suelo. Es solo decoración: va debajo
 * de los Pokémon, no recibe clics, los lectores la ignoran y con las animaciones desactivadas se queda quieta.
 */
import { useEffect, useRef, type CSSProperties } from 'react'

type Spot = { angle: number; radius: number; color: string; size: number }

const COLORS = ['#ff9ec8', '#86e4d4', '#f4e8a2', '#f4f4ff'] as const

/** Reparto fijo (no aleatorio) para que el campo se vea igual en cada combate y en las capturas. */
export const FIELD_SPOTS: readonly Spot[] = Array.from({ length: 40 }, (_, i) => ({
  angle: (i * 137.5) % 360,
  radius: 30 + ((i * 53) % 190),
  color: COLORS[i % COLORS.length],
  size: 30 + ((i * 7) % 14),
}))

/** Haces de los focos del techo: barren en diagonal la parte alta del estadio, cada uno a su ritmo. */
export const SPOTLIGHT_BEAMS = [
  { x: 40, delay: 0 },
  { x: 120, delay: -2.6 },
  { x: 205, delay: -5.1 },
] as const

/** Fotogramas por segundo del giro de las luces. */
export const LIGHTS_FPS = 12
const FLOOR_TURN_MS = 48_000
const BEAM_PERIOD_MS = 16_000

/** Giro del plano de los focos del suelo a los `ms` (una vuelta cada 48 s). */
export const floorAngle = (ms: number): number => ((ms / FLOOR_TURN_MS) * 360) % 360

/** Inclinación de un haz a los `ms`: oscila entre 28° y 48° cada 16 s, desfasado por su `delay` (en segundos). */
export const beamAngle = (ms: number, delay: number): number => 38 - 10 * Math.cos((2 * Math.PI * (ms / 1000 + -delay)) / (BEAM_PERIOD_MS / 1000))

/** La raíz del combate resuelve Ajustes y prefers-reduced-motion en data-reduced-motion. */
const reducedMotion = (el: Element): boolean => el.closest('[data-reduced-motion="true"]') !== null

/**
 * El giro va por JS a LIGHTS_FPS y no con animaciones CSS: en WebKit sin aceleración, cualquier animación CSS continua
 * del campo (también con steps()) lo repintaba entero en cada fotograma, y E2E-05 pasaba de 2,9 min en `main` a más
 * de 5. A 12 fps vuelve a 3,1 min y el giro, lento, no se nota a saltos.
 */
function useLightsMotion() {
  const plane = useRef(null as HTMLDivElement | null)
  const beams = useRef(null as HTMLDivElement | null)
  useEffect(() => {
    const start = performance.now()
    const tick = () => {
      const floor = plane.current
      if (!floor) return
      const ms = reducedMotion(floor) ? 0 : performance.now() - start
      floor.style.transform = `scaleY(0.3) rotate(${floorAngle(ms).toFixed(2)}deg)`
      beams.current?.querySelectorAll<HTMLElement>('i').forEach((beam, i) => {
        beam.style.transform = `rotate(${(ms === 0 ? 38 : beamAngle(ms, SPOTLIGHT_BEAMS[i].delay)).toFixed(2)}deg)`
      })
    }
    tick()
    const id = setInterval(tick, 1000 / LIGHTS_FPS)
    return () => clearInterval(id)
  }, [])
  return { plane, beams }
}

export function FieldLights() {
  const { plane, beams } = useLightsMotion()
  return (
    <>
    <div className="bt-spotlights" aria-hidden="true" data-testid="spotlights" ref={beams}>
      {SPOTLIGHT_BEAMS.map((beam, i) => (
        <i key={i} style={{ '--x': `${beam.x}px`, '--d': `${beam.delay}s` } as CSSProperties} />
      ))}
    </div>
    <div className="bt-floor-lights" aria-hidden="true" data-testid="floor-lights">
      <div className="bt-floor-lights-plane" ref={plane}>
        {FIELD_SPOTS.map((spot, i) => (
          <i
            key={i}
            style={{ '--a': `${spot.angle}deg`, '--r': `${spot.radius}px`, '--c': spot.color, '--s': `${spot.size}px` } as CSSProperties}
          />
        ))}
      </div>
    </div>
    </>
  )
}
