/**
 * Ruta de la campaña de Teselia (maqueta A3 aprobada el 13/11/2026): cada gimnasio y la Liga en su círculo del mapa de N2/B2
 * (`public/ui/n2b2/mapa-teselia.png`, 256 x 168), en píxeles del mapa (el centro del círculo).
 *
 * Los centros salen del color de relleno de los círculos (33, 132, 165) y cada ciudad se identificó con el mapa del juego que publica
 * WikiDex en la ficha de cada lugar (p. ej. «Ciudad_Marga_mapa.png», con el cursor sobre Marga): Engobe abajo a la izquierda, Hormigón al
 * final de las rutas 19 y 20, Porcelana la ciudad del puerto, Mayólica el cruce del centro, Fayenza al otro lado del puente, Loza al
 * noroeste, Caolín al nordeste del centro, Marga en la costa del nordeste y la Liga en lo alto, al final de la Calle Victoria.
 */
import type { CSSProperties } from 'react'
import type { PlaceSpec } from '../campaign/hoennRoute'

export const UNOVA_PLACES: readonly PlaceSpec[] = [
  { id: 'cheren', x: 8, y: 148 },
  { id: 'hiedra', x: 66, y: 124 },
  { id: 'camus', x: 132, y: 130 },
  { id: 'camila', x: 132, y: 90 },
  { id: 'yakon', x: 74, y: 90 },
  { id: 'gerania', x: 40, y: 66 },
  { id: 'lirio', x: 190, y: 42 },
  { id: 'ciprian', x: 232, y: 32 },
  { id: 'iris', x: 170, y: 14 },
]

/** Alto de la barra del título sobre el mapa, en la pantalla de arriba. */
export const MAP_TOP = 24

const BASE = import.meta.env.BASE_URL

/** Pieza de interfaz de la locke de N2/B2 (`npm run gen:n2b2-ui`, scripts/rom/n2b2_ui.py). */
export const n2b2Ui = (name: string): string => `${BASE}ui/n2b2/${name}.png`

/**
 * Variables CSS con las piezas de los menús (unova.css), en URL absoluta: con `base: './'`, una relativa en la hoja de estilos se resolvería
 * contra assets/ y no cargaría. Van en el elemento raíz de cada pantalla.
 */
export function unovaVars(): CSSProperties {
  const url = (name: string) => `url("${new URL(n2b2Ui(name), document.baseURI).href}")`
  return { '--unova-panel': url('panel'), '--unova-bar': url('barra'), '--unova-bar-off': url('barra-off'),
    '--unova-franja': url('franja'), '--unova-pestana': url('franja-pestana') } as CSSProperties
}
