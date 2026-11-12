/**
 * Mochila de la campaña (D7, maqueta aprobada el 11/11/2026; item_menu.c). Arriba, la Mochila de Esmeralda: fondo y mochila del
 * protagonista (en (68,66), un fotograma por bolsillo), nombre del bolsillo en negro en la ventana (4,1), lista en la ventana (14,2) con 8
 * filas que se desplazan con sus flechas y terminan en CERRAR MOCHILA, icono del objeto en (8,72) y descripción en la ventana (0,13).
 * Abajo, el miembro que recibe el objeto. Elegir uno se lo da; si ya llevaba otro, pregunta si cambiarlo (SÍ/NO).
 */
import { scrollList, wheelRows } from './listScroll'
import { useState, type KeyboardEvent } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import { PartySlot } from './PartySlot'
import { messagePages } from './emeraldBattleModel'
import { itemName, POCKETS, scrollFor, VISIBLE_ROWS, type BagItem, type Pocket } from './bagModel'
import type { Protagonist } from './resultModel'

const t = esCampaign.bag
/** Fotograma de la mochila de cada bolsillo (bag_male/female.png): 1 objetos, 2 objetos clave, 4 MT/MO, 5 bayas. */
const BAG_FRAME: Record<Pocket, number> = { items: 1, evolution: 2, machines: 4, berries: 5 }

type BagScreenProps = {
  protagonist: Protagonist
  member: { species: string; name: string; level: number; hp: number; item: string | null }
  contents: (pocket: Pocket) => BagItem[]
  onGive: (item: string) => void
  onClose: () => void
  scale?: number
  reservedHeight?: number
}

export function BagScreen({ protagonist, member, contents, onGive, onClose, scale, reservedHeight }: BagScreenProps) {
  const [pocket, setPocket] = useState('items' as Pocket)
  const [cursor, setCursor] = useState(0)
  const [scroll, setScroll] = useState(0)
  const [asking, setAsking] = useState(null as string | null)
  const items = contents(pocket)
  const rows = items.length + 1
  const selected = items[cursor] ?? null
  const message = asking && member.item ? t.swap(member.name, itemName(member.item)) : t.give(member.name)

  const point = (i: number, focus = false) => {
    const next = Math.max(0, Math.min(rows - 1, i))
    setCursor(next)
    setScroll(scrollFor(next, scroll, rows))
    // Con el teclado el foco sigue al cursor (la fila puede no estar montada hasta desplazar la lista).
    if (focus) requestAnimationFrame(() => (document.querySelector(`[data-bag-row="${next}"]`) as HTMLElement | null)?.focus())
  }
  const scrollBy = (by: number) => {
    const next = scrollList(scroll, cursor, rows, VISIBLE_ROWS, by)
    setScroll(next.scroll)
    setCursor(next.cursor)
  }
  const changePocket = (step: number) => {
    setPocket(POCKETS[(POCKETS.indexOf(pocket) + step + POCKETS.length) % POCKETS.length])
    setCursor(0)
    setScroll(0)
    setAsking(null)
  }
  const pick = (i: number) => {
    if (i === items.length) { onClose(); return }
    point(i)
    const item = items[i]
    // OBJ. EVOL. y MT/MO: solo para mirar.
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

  return (
    <div className="bag-screen" onKeyDown={onKeyDown}>
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="bag" className="bag-top" onWheel={(event) => { if (!asking) scrollBy(wheelRows(event.deltaY)) }}>
          <img src={emeraldTheme.asset(`mochila-fondo-${protagonist}`)} alt="" style={{ left: 0, top: 0 }} />
          <div className="bag-sprite" style={{ left: 36, top: 34, width: 64, height: 64 }}>
            <img src={emeraldTheme.asset(`mochila-${protagonist}`)} alt="" style={{ left: 0, top: -64 * BAG_FRAME[pocket] }} />
          </div>
          <GameText text={t.pockets[pocket]} x={32} y={9} width={64} align="center" color="mochila-bolsillo" />
          {([[-1, 'izda', 18], [1, 'dcha', 104]] as const).map(([step, side, x]) => (
            <button key={side} type="button" className="team-button" style={{ left: x, top: 56, width: 8, height: 16 }}
              aria-label={t.pocketLabel(step > 0, t.pockets[POCKETS[(POCKETS.indexOf(pocket) + step + POCKETS.length) % POCKETS.length]])} onClick={() => changePocket(step)}>
              <img src={emeraldTheme.asset(`pc-flecha-${side}`)} alt="" style={{ left: 0, top: 0 }} />
            </button>
          ))}
          {Array.from({ length: Math.min(VISIBLE_ROWS, rows - scroll) }, (_, k) => {
            const i = scroll + k
            const item = items[i]
            const count = item && pocket === 'items' ? t.count(item.free) : ''
            return (
              <button key={i} type="button" className="moves-row" data-bag-row={i} style={{ left: 112, top: 16 + 16 * k, width: 120, height: 16 }}
                aria-current={i === cursor || undefined} aria-label={item ? t.itemLabel(item.name, count) : t.closeLabel} autoFocus={i === 0 && scroll === 0}
                onClick={() => pick(i)} onFocus={() => { if (i !== cursor) point(i) }} onPointerEnter={() => { if (!asking) point(i) }}>
                {i === cursor && <GameText text={'▶'} y={1} hidden />}
                <GameText text={item ? item.name : t.close} x={8} y={1} width={84} fit hidden />
                {count && <GameText text={count} x={92} y={1} width={24} align="right" face="narrow" hidden />}
              </button>
            )
          })}
          {scroll > 0 && (
            <button type="button" className="moves-scroll" style={{ left: 112, top: 4, width: 120, height: 12 }} aria-label={t.scroll(false)} onClick={() => scrollBy(-VISIBLE_ROWS)}>
              {/* Flechas de la lista centradas en (172,12) y (172,148), como AddScrollIndicatorArrowPair de item_menu.c. */}
              <img className="blink-a" src={emeraldTheme.asset('lista-arriba')} alt="" style={{ left: 52, top: 0 }} />
            </button>
          )}
          {scroll + VISIBLE_ROWS < rows && (
            <button type="button" className="moves-scroll" style={{ left: 112, top: 145, width: 120, height: 12 }} aria-label={t.scroll(true)} onClick={() => scrollBy(VISIBLE_ROWS)}>
              <img className="blink-a" src={emeraldTheme.asset('lista-abajo')} alt="" style={{ left: 52, top: -5 }} />
            </button>
          )}
          {/* Icono: sprite de 32 x 32 centrado en (24,88) con el dibujo de 24 x 24 arriba a la izquierda (AddBagItemIconSprite), así que el
              dibujo va en (8,72), centrado en el recuadro blanco del fondo (x 5–34, y 71–96). */}
          {selected && <img src={emeraldTheme.asset(`objeto-${selected.id}`)} alt="" style={{ left: 8, top: 72 }} />}
          {(selected ? selected.text.split('\n') : items.length ? [] : messagePages(t.empty)[0] ?? []).map((line, i) => (
            <GameText key={i} text={line} x={4} y={105 + 16 * i} hidden />
          ))}
          {asking && (
            <GameWindow x={24} y={7} width={4} height={4}>
              {([[t.yes, true], [t.no, false]] as const).map(([label, yes], i) => (
                <button key={label} type="button" className="team-menu-item" style={{ left: 0, top: i * 16, width: 32, height: 16 }}
                  aria-label={yes ? t.yesLabel : t.noLabel} autoFocus={i === 0} onClick={() => { const item = asking; setAsking(null); if (yes) onGive(item) }}>
                  <GameText text={'▶'} y={1} hidden />
                  <GameText text={label} x={8} y={1} hidden />
                </button>
              ))}
            </GameWindow>
          )}
          <section className="sr-only" aria-label={t.screen}>
            <p>{t.holding(member.name, member.item ? itemName(member.item) : null)}</p>
            {selected && <p>{`${selected.name}. ${selected.text.replace(/\n/g, ' ')}`}</p>}
          </section>
        </div>
      ), (
        <div key="party" className="bag-party">
          <img src={emeraldTheme.asset('equipo-fondo')} alt="" style={{ left: 0, top: 0 }} />
          <div style={{ left: 8, top: 24, width: 80, height: 56 }} aria-hidden="true">
            <PartySlot i={0} mon={{ ...member, maxHp: member.hp }} state="activa" bounce />
          </div>
          <GameWindow x={1} y={17} width={21} height={2}>
            <GameText text={message} y={1} width={168} fit />
          </GameWindow>
          {/* CANCELAR en la píldora de abajo, como la pantalla de equipo: sin bajar hasta CERRAR MOCHILA (Jose, 12/11/2026). */}
          <button type="button" className="team-button" style={{ left: 184, top: 144, width: 56, height: 16 }} aria-label={t.cancelLabel} onClick={onClose}>
            <GameText text={t.cancel} x={5} y={1} width={48} align="center" face="small" color="equipo" hidden />
          </button>
          <p className="sr-only" role="status">{message}</p>
        </div>
      )]} />
    </div>
  )
}
