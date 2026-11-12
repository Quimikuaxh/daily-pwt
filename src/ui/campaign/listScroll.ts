/**
 * Desplazamiento de las listas de la campaña (Movimientos, Mochila, Tienda): la rueda del ratón mueve una fila y las flechas, una
 * página (Jose, 12/11/2026: costaba acertar con las flechas y no había rueda). Devuelve la primera fila visible y el cursor, que se
 * queda dentro de lo visible.
 */
export function scrollList(scroll: number, cursor: number, rows: number, visible: number, by: number): { scroll: number; cursor: number } {
  const top = Math.max(0, Math.min(Math.max(0, rows - visible), scroll + by))
  return { scroll: top, cursor: Math.max(top, Math.min(top + visible - 1, cursor)) }
}

/** Filas que mueve la rueda: una por gesto, hacia donde gire. */
export const wheelRows = (deltaY: number): number => (deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0)
