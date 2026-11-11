/** Lista del canje de Puntos Batalla (D7): 6 filas a la vista en su ventana, que se desplazan para que el cursor se vea. */
export const EXCHANGE_ROWS = 6

export function exchangeScroll(cursor: number, scroll: number, rows: number): number {
  if (cursor < scroll) return cursor
  if (cursor >= scroll + EXCHANGE_ROWS) return Math.min(rows - EXCHANGE_ROWS, cursor - EXCHANGE_ROWS + 1)
  return scroll
}
