type Props = {
  x: number
  y: number
  width: number
  scroll: number
  visible: number
  total: number
  blocked?: boolean
  label: (down: boolean) => string
  onScroll: (delta: number) => void
}

/** Deja una fila para las dos direcciones y conserva la misma zona táctil en las listas de Teselia. */
export function UnovaListArrows({ x, y, width, scroll, visible, total, blocked, label, onScroll }: Props) {
  if (total <= visible) return null
  const gap = 4
  const arrowWidth = (width - gap) / 2
  return [false, true].map((down) => (
    <button key={String(down)} type="button" className="unova-list-arrow" data-direction={down ? 'down' : 'up'}
      style={{ left: down ? x + arrowWidth + gap : x, top: y, width: arrowWidth, height: 32 }}
      aria-label={label(down)} onClick={() => onScroll(down ? 1 : -1)}
      disabled={blocked || (down ? scroll + visible >= total : scroll === 0)} />
  ))
}
