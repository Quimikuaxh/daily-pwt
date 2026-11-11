/** Geometría y gráficos de los huecos del equipo de Esmeralda (party_menu.c: sPartyBoxInfoRects, sHPBar*PalIds). */
export type SlotState = 'normal' | 'activa' | 'vacia'

/** Posición y tamaño del hueco `i` en la pantalla de equipo. */
export const slotBox = (i: number) => i === 0 ? { x: 8, y: 24, w: 80, h: 56 } : { x: 96, y: 8 + 24 * (i - 1), w: 144, h: 24 }

/** Rectángulos de texto y barra dentro del hueco, e y del icono. */
export const slotRect = (i: number) => i === 0
  ? { name: [24, 11], lv: [32, 20], hp: [38, 37], max: [53, 37], bar: [24, 35], icon: 0 }
  : { name: [22, 3], lv: [30, 12], hp: [102, 12], max: [117, 12], bar: [88, 10], icon: -6 }

/** Placa del hueco: principal o ancha; vacía si no hay Pokémon. */
export const slotImage = (i: number, filled: boolean, state: SlotState): string =>
  `equipo-hueco-${i === 0 ? 'main' : filled ? 'wide' : 'wide-empty'}-${filled ? state : 'vacia'}`

/** Barra de PS: verde por encima de la mitad, amarilla hasta un quinto y roja por debajo (oscuro arriba, claro debajo). */
export function hpBarColors(ratio: number): [string, string] {
  if (ratio <= 0.2) return ['#c53900', '#ff7331']
  if (ratio <= 0.5) return ['#cdac08', '#ffe639']
  return ['#5ad583', '#73ffac']
}
