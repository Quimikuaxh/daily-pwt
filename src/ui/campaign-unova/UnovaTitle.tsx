/**
 * Franja de título de los menús de N2/B2 (Ruta, paneles…): la franja oscura entera y encima la pestaña clara a la medida del título, que
 * lleva el texto invisible solo para tomar su ancho; el título visible va encima. Lo que se pase como hijos va en la parte oscura.
 */
import type { ReactNode } from 'react'

export function UnovaTitle({ x, y, width, title, children }: { x: number; y: number; width: number; title: string; children?: ReactNode }) {
  return (
    <>
      <span className="unova-band" style={{ left: x, top: y, width }} />
      <span className="unova-text unova-band-tab" style={{ left: x, top: y }} aria-hidden="true">{title}</span>
      <span className="unova-text" style={{ left: x + 7, top: y + 5 }}>{title}</span>
      {children}
    </>
  )
}
