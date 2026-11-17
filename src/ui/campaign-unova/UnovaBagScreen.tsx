/**
 * Mochila de la campaña de Teselia (maqueta aprobada el 14/11/2026), como la de N2/B2. Arriba, el fondo de la Mochila (de la ROM, en el
 * color del protagonista) con a quién se le da y, en una ventana, el icono, el nombre y la descripción del objeto señalado. Abajo, la
 * mochila y sus bolsillos montados como en el juego (el actual, abierto; se cambia tocándolos o con las flechas), la lista de objetos en
 * placas (icono, nombre y unidades) con su barra de desplazamiento y CERRAR MOCHILA al final, y una barra con el bolsillo y CERRAR.
 * Funciona como la de Hoenn: elegir uno se lo da; si ya llevaba otro, pregunta si cambiarlo (SÍ / NO); OBJ. EVOL. y MT/MO, solo para mirar.
 */
import { useState, type KeyboardEvent } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { itemIconUrl } from '../common/spriteUrls'
import { usePreloadImages } from '../campaign/usePreloadImages'
import { esCampaign } from '../../i18n/esCampaign'
import { POCKETS, type BagItem, type Pocket } from '../campaign/bagModel'
import { UnovaListArrows } from './UnovaListArrows'
import { scrollList, wheelRows } from '../campaign/listScroll'
import { wrapText } from '../campaign/draftModel'
import type { Protagonist } from '../campaign/resultModel'
import { n2b2Ui, unovaVars } from './unovaRoute'
import { textWidth13 } from './unovaText'
import './unova.css'

const t = esCampaign.bag
const MAX_VISIBLE = 6
const ROW = { x: 106, y: 10, w: 136, h: 22, step: 24 }
/** Bolsillos de la hoja de bolsas y dónde va cada uno en la pantalla de abajo (a la izquierda de la lista). */
const POCKET_PIECE: Record<Pocket, { piece: string; x: number; y: number }> = {
  items: { piece: 'objetos', x: 0, y: 4 },
  machines: { piece: 'mt', x: 61, y: 18 },
  berries: { piece: 'bayas', x: 6, y: 106 },
  evolution: { piece: 'evol', x: 52, y: 110 },
}

export type UnovaBagScreenProps = {
  protagonist: Protagonist
  member: { species: string; name: string; level: number; hp: number; item: string | null }
  contents: (pocket: Pocket) => BagItem[]
  /** Nombre de un objeto (el que lleva, para la pregunta de cambiarlo). */
  itemName: (id: string) => string
  onGive: (item: string) => void
  onClose: () => void
  scale?: number
  reservedHeight?: number
}

export function UnovaBagScreen({ protagonist, member, contents, itemName, onGive, onClose, scale, reservedHeight }: UnovaBagScreenProps) {
  const who = protagonist === 'may' ? 'chica' : 'chico'
  const [pocket, setPocket] = useState('items' as Pocket)
  const [cursor, setCursor] = useState(0)
  const [scroll, setScroll] = useState(0)
  const [asking, setAsking] = useState(null as string | null)
  const items = contents(pocket)
  usePreloadImages(POCKETS.flatMap((each) => contents(each).map((item) => itemIconUrl(item.id))))
  const rows = items.length + 1 // la última fila es CERRAR MOCHILA
  const visible = rows > MAX_VISIBLE ? 5 : MAX_VISIBLE
  const selected = items[cursor] ?? null
  const message = asking && member.item ? t.swap(member.name, itemName(member.item)) : t.give(member.name)

  const point = (i: number, focus = false) => {
    const next = Math.max(0, Math.min(rows - 1, i))
    setCursor(next)
    if (next < scroll) setScroll(next)
    if (next >= scroll + visible) setScroll(next - visible + 1)
    if (focus) requestAnimationFrame(() => (document.querySelector(`[data-bag-row="${next}"]`) as HTMLElement | null)?.focus())
  }
  const scrollBy = (by: number) => {
    const next = scrollList(scroll, cursor, rows, visible, by)
    setScroll(next.scroll)
    setCursor(next.cursor)
  }
  const choosePocket = (next: Pocket) => {
    setPocket(next)
    setCursor(0)
    setScroll(0)
    setAsking(null)
  }
  const changePocket = (step: number) => choosePocket(POCKETS[(POCKETS.indexOf(pocket) + step + POCKETS.length) % POCKETS.length])
  const pick = (i: number) => {
    if (i === items.length) { onClose(); return }
    point(i)
    const item = items[i]
    if (item.view) return
    if (member.item && member.item !== item.id) { setAsking(item.id); return }
    onGive(item.id)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (asking) { if (event.key === 'Escape') { event.preventDefault(); setAsking(null) } return }
    const moves: Record<string, () => void> = {
      ArrowUp: () => point(cursor - 1, true), ArrowDown: () => point(cursor + 1, true), ArrowLeft: () => changePocket(-1), ArrowRight: () => changePocket(1), Escape: onClose,
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    move()
  }
  const description = selected ? wrapText(selected.text, 222, textWidth13).slice(0, 3) : items.length ? [] : [t.empty]
  const trackHeight = visible * ROW.step - 2
  const thumb = rows > visible ? { top: (scroll / rows) * trackHeight, height: (visible / rows) * trackHeight } : null

  return (
    <div className="bag-screen" onKeyDown={onKeyDown}>
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="info" className="unova-screen" style={unovaVars()}>
          <img src={n2b2Ui(`mochila-fondo-${who}`)} alt="" style={{ left: 0, top: 0 }} />
          <span className="unova-bar-off" style={{ left: 8, top: 14, width: 240, height: 22 }}>
            <span className="unova-text" style={{ left: 2, top: -2 }}>{message}</span>
          </span>
          <span className="unova-panel" style={{ left: 8, top: 104, width: 240, height: 80 }} />
          {selected && <img src={itemIconUrl(selected.id)} alt="" style={{ left: 16, top: 110 }} />}
          {selected && <span className="unova-text" style={{ left: 50, top: 118 }}>{selected.name}</span>}
          {description.map((line, i) => <span key={i} className="unova-text unova-soft" style={{ left: 17, top: 144 + i * 13 }}>{line}</span>)}
          {asking && (
            <span className="unova-pc-menu" role="menu" aria-label={message} style={{ left: 184, top: 40, width: 64, height: 44 }}>
              {([[t.yes, true], [t.no, false]] as const).map(([label, yes], i) => (
                <button key={label} type="button" role="menuitem" className="unova-pc-menu-item" style={{ left: 0, top: i * 16, width: 52, height: 16 }}
                  aria-label={yes ? t.yesLabel : t.noLabel} autoFocus={i === 0} onClick={() => { const item = asking; setAsking(null); if (yes) onGive(item) }}>
                  <span className="unova-text unova-pc-menu-cursor" style={{ left: 0, top: 1 }}>▶</span>
                  <span className="unova-text" style={{ left: 9, top: 1 }}>{label}</span>
                </button>
              ))}
            </span>
          )}
          <section className="sr-only" aria-label={t.screen}>
            <p>{t.holding(member.name, member.item ? itemName(member.item) : null)}</p>
            {selected && <p>{`${selected.name}. ${selected.text}`}</p>}
            <p role="status">{message}</p>
          </section>
        </div>
      ), (
        <div key="bag" className="unova-screen" style={unovaVars()} onWheel={(event) => { if (!asking) scrollBy(wheelRows(event.deltaY)) }}>
          <img src={n2b2Ui(`mochila-fondo-${who}`)} alt="" style={{ left: 0, top: 0 }} />
          {POCKETS.map((each) => (
            <button key={each} type="button" className="unova-bag-pocket" style={{ left: POCKET_PIECE[each].x, top: POCKET_PIECE[each].y }}
              aria-pressed={each === pocket} aria-label={t.pockets[each]} onClick={() => choosePocket(each)}>
              <img src={n2b2Ui(`mochila-${who}-${POCKET_PIECE[each].piece}-${each === pocket ? 2 : 0}`)} alt="" style={{ left: 0, top: 0 }} />
            </button>
          ))}
          {Array.from({ length: Math.min(visible, rows - scroll) }, (_, k) => {
            const i = scroll + k
            const item = items[i]
            const count = item && pocket === 'items' && Number.isFinite(item.free) ? t.count(item.free) : ''
            return (
              <button key={i} type="button" className={`unova-row ${i === cursor ? 'unova-bar' : 'unova-bar-off'}`} data-bag-row={i}
                style={{ left: ROW.x, top: ROW.y + k * ROW.step, width: ROW.w, height: ROW.h }}
                aria-current={i === cursor || undefined} aria-label={item ? t.itemLabel(item.name, count) : t.closeLabel}
                onClick={() => pick(i)} onFocus={() => { if (i !== cursor) point(i) }} onPointerEnter={() => { if (!asking) point(i) }}>
                {item && <span className="unova-bag-icon"><img src={itemIconUrl(item.id)} alt="" style={{ left: -4, top: -4 }} /></span>}
                <span className="unova-text" style={{ left: item ? 18 : 2, top: -3 }}>{item ? item.name : t.close}</span>
                {count && <span className="unova-text" style={{ right: 0, top: -3 }}>{count}</span>}
              </button>
            )
          })}
          <UnovaListArrows x={ROW.x} y={132} width={ROW.w} scroll={scroll} visible={visible} total={rows}
            blocked={asking !== null} label={t.scroll} onScroll={scrollBy} />
          {thumb && <span className="unova-moves-thumb" style={{ left: 246, top: ROW.y + thumb.top, height: Math.max(6, thumb.height) }} />}
          <span className="unova-bar-off" style={{ left: 0, top: 168, width: 256, height: 24 }} />
          {([[-1, '‹', 6], [1, '›', 106]] as const).map(([step, arrow, x]) => (
            <button key={arrow} type="button" className="unova-text unova-arrow" style={{ left: x, top: 172 }}
              aria-label={t.pocketLabel(step > 0, t.pockets[POCKETS[(POCKETS.indexOf(pocket) + step + POCKETS.length) % POCKETS.length]])}
              onClick={() => changePocket(step)}>{arrow}</button>
          ))}
          <span className="unova-text" style={{ left: 18, top: 174, width: 88, textAlign: 'center' }}>{t.pockets[pocket]}</span>
          <button type="button" className="unova-text" style={{ right: 10, top: 172, height: 16 }} aria-label={t.cancelLabel} onClick={onClose}>{t.cancel}</button>
        </div>
      )]} />
    </div>
  )
}
