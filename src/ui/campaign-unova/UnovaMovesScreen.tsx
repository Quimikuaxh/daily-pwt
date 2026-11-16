/**
 * Movimientos de la campaña de Teselia (maqueta aprobada el 14/11/2026): la página de movimientos de la pantalla de datos del diario
 * tal cual. Arriba, el detalle del movimiento señalado (categoría física, especial o de estado de Gen 5, potencia, precisión y
 * descripción); abajo, las placas de los cuatro que lleva y, donde el diario pone el sprite, la lista de lo que puede aprender (a su nivel
 * y con las MT conseguidas) con desplazamiento, que acaba en SALIR. Funciona como en Hoenn (movesModel.learnMove): elegir de la lista lo
 * aprende; con cuatro, se toca la placa que olvida; Esc anula o sale.
 */
import { useState, type KeyboardEvent } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import SummaryScreen from '../battle/party/SummaryScreen'
import { partyMove, type PartyMember } from '../battle/party/partyModel'
import type { GameData } from '../../core/types'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import { learnMove, type MoveInfo } from '../campaign/movesModel'
import { scrollList, wheelRows } from '../campaign/listScroll'
import { unovaVars } from './unovaRoute'
import '../battle/party/party.css'
import '../battle/party/summary.css'
import './unova.css'

const t = esCampaign.moves
const u = esUnova
const MAX_VISIBLE = 6
/** Lista sobre el sprite de la pantalla de abajo (en píxeles de la pantalla de datos: la de abajo empieza en y 192). */
const LIST = { x: 142, y: 194, w: 112, h: 152, rowY: 20, rowH: 18, step: 19 }

export type UnovaMovesScreenProps = {
  mon: { species: string; name: string; level: number; dex: number }
  legal: readonly MoveInfo[]
  equipped: readonly string[]
  onChange: (moves: string[]) => void
  onExit: () => void
  /** El Pokémon en la pantalla de datos del diario, con los movimientos que lleva. */
  member: PartyMember | null
  data: GameData
  scale?: number
  reservedHeight?: number
}

export function UnovaMovesScreen({ mon, legal, equipped, onChange, onExit, member, data, scale, reservedHeight }: UnovaMovesScreenProps) {
  const [cursor, setCursor] = useState(0)
  const [showEquipped, setShowEquipped] = useState(false)
  const [scroll, setScroll] = useState(0)
  const [learning, setLearning] = useState(null as string | null)
  const [note, setNote] = useState(null as string | null)
  const items = legal.length + 1 // la última fila es SALIR
  // En las listas largas, deja una fila libre para dos botones táctiles de 32 px de alto.
  const visible = items > MAX_VISIBLE ? MAX_VISIBLE - 1 : MAX_VISIBLE
  // El nombre como lo escribe N2/B2 (el de la pantalla de datos), no en mayúsculas como Esmeralda.
  const name = member?.name ?? mon.name
  const nameOf = (id: string) => partyMove(id, data, undefined).name
  const detailId = learning ?? (showEquipped ? undefined : legal[cursor]?.id)
  const detail = detailId ? partyMove(detailId, data, undefined) : null

  const moveCursor = (i: number) => {
    const next = Math.max(0, Math.min(items - 1, i))
    setShowEquipped(false)
    setCursor(next)
    if (next < scroll) setScroll(next)
    if (next >= scroll + visible) setScroll(next - visible + 1)
  }
  const pick = (i: number) => {
    if (i === legal.length) { onExit(); return }
    const move = legal[i]
    moveCursor(i)
    if (equipped.includes(move.id)) { setNote(t.known(name, nameOf(move.id))); return }
    const added = learnMove(equipped, move.id)
    if (added) { onChange(added); setNote(t.learned(name, nameOf(move.id))); return }
    setLearning(move.id)
    setNote(null)
  }
  const pickEquipped = (i: number) => {
    if (!learning) { setShowEquipped(true); return }
    const next = learnMove(equipped, learning, i)
    if (next) { onChange(next); setNote(t.swapped(name, nameOf(equipped[i]), nameOf(learning))) }
    setLearning(null)
  }
  const scrollBy = (rows: number) => {
    const next = scrollList(scroll, cursor, items, visible, rows)
    setShowEquipped(false)
    setScroll(next.scroll)
    setCursor(next.cursor)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && learning) { event.preventDefault(); event.stopPropagation(); setLearning(null); return }
    const row = (event.target as HTMLElement).dataset.row
    if (row === undefined || learning || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    event.stopPropagation()
    const next = Number(row) + (event.key === 'ArrowDown' ? 1 : -1)
    moveCursor(next)
    requestAnimationFrame(() => (document.querySelector(`[data-row="${Math.max(0, Math.min(items - 1, next))}"]`) as HTMLElement | null)?.focus())
  }

  const message = learning ? t.forget(name) : note ?? t.learn(name)
  const thumb = items > visible ? { top: (scroll / items) * (visible * LIST.step), height: (visible / items) * (visible * LIST.step) } : null

  // Bloque con llaves: la guarda de literales (literals.test.ts) tomaba el código entre dos JSX por texto.
  const aside = (() => { return (
    <div className="unova-moves-aside" style={unovaVars()} onKeyDown={onKeyDown} onWheel={(event) => { if (!learning) scrollBy(wheelRows(event.deltaY)) }}>
      <span className="unova-panel" style={{ left: LIST.x, top: LIST.y, width: LIST.w, height: LIST.h }} />
      <span className="unova-text unova-soft" style={{ left: LIST.x + 8, top: LIST.y + 6 }}>{u.canLearn}</span>
      {Array.from({ length: Math.min(visible, items - scroll) }, (_, k) => {
        const i = scroll + k
        const move = legal[i]
        const current = !showEquipped && i === cursor
        return (
          <button key={i} type="button" className={`unova-moves-row ${current ? 'unova-bar' : 'unova-bar-off'}`} data-row={i}
            style={{ left: LIST.x + 6, top: LIST.y + LIST.rowY + k * LIST.step, width: 100, height: LIST.rowH }}
            aria-current={current ? true : undefined}
            aria-label={move ? t.rowLabel(nameOf(move.id), partyMove(move.id, data, undefined).typeLabel ?? '', u.categoryNames[partyMove(move.id, data, undefined).category ?? 'Status'],
              'level' in move.source ? t.level(move.source.level) : move.source.machine, equipped.includes(move.id)) : t.exitLabel}
            onClick={() => pick(i)} onFocus={() => { if (!learning) moveCursor(i) }} onPointerEnter={() => { if (!learning) moveCursor(i) }}>
            <span className="unova-text" style={{ left: 0, top: -3 }}>{move ? nameOf(move.id) : t.exit}</span>
          </button>
        )
      })}
      {thumb && (
        <>
          <span className="unova-moves-track" style={{ left: LIST.x + 108, top: LIST.y + LIST.rowY, height: visible * LIST.step - 2 }} />
          <span className="unova-moves-thumb" style={{ left: LIST.x + 108, top: LIST.y + LIST.rowY + thumb.top, height: Math.max(6, thumb.height - 2) }} />
          {[false, true].map((down) => (
            <button key={String(down)} type="button" className="unova-moves-scroll" data-direction={down ? 'down' : 'up'}
              style={{ left: LIST.x + (down ? 58 : 6), top: LIST.y + LIST.h - 36, width: 48, height: 32 }}
              aria-label={t.scroll(down)} onClick={() => scrollBy(down ? 1 : -1)}
              disabled={learning !== null || (down ? scroll + visible >= items : scroll === 0)} />
          ))}
        </>
      )}
      <span className="unova-bar-off unova-moves-message" style={{ left: 0, top: 170, width: 256, height: 22 }}>
        <span className="unova-text" style={{ left: 2, top: -2 }} role="status">{message}</span>
      </span>
    </div>
  ) })()

  return (
    <div className="moves-screen">
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} screens={[]} whole={(
        <div className="unova-draft-summary">
          {member && (
            <SummaryScreen members={[member]} initialSlot={1} initialPage={2} data={data} onClose={onExit}
              detailMove={detail} onMovePick={pickEquipped} aside={aside} />
          )}
        </div>
      )} />
    </div>
  )
}
