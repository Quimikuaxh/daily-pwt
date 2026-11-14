/**
 * Tienda de la campaña de Teselia (canje de Puntos Batalla; maqueta aprobada el 14/11/2026). Abajo, la pantalla de tienda de 5.ª
 * generación de la ROM: los PB y cuántos tienes del señalado arriba a la izquierda, el objeto debajo, la lista con precios en PB (que
 * acaba en SALIR) a la derecha y la descripción al pie. Arriba, el objeto señalado en grande con su precio y los PB que quedarían, y el
 * equipo con lo que lleva cada uno. Elegir pide confirmación (SÍ / NO); lo canjeado va a la Mochila.
 */
import { useState, type KeyboardEvent } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { MemberIcon } from '../battle/party/MemberIcon'
import { itemIconUrl } from '../common/spriteUrls'
import { usePreloadImages } from '../campaign/usePreloadImages'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import { scrollList, wheelRows } from '../campaign/listScroll'
import { wrapText } from '../campaign/draftModel'
import { n2b2Ui, unovaVars } from './unovaRoute'
import { textWidth13 } from './unovaText'
import { UnovaTitle } from './UnovaTitle'
import '../battle/party/party.css'
import './unova.css'

const t = esCampaign.exchange
const u = esUnova
const VISIBLE = 7
const ROW = { x: 96, y: 9, w: 152, h: 17 }

export type UnovaExchangeScreenProps = {
  points: number
  offers: readonly { item: string; price: number }[]
  onBuy: (item: string) => void
  onExit: () => void
  itemName: (id: string) => string
  itemText: (id: string) => string
  /** Unidades que ya tienes de un objeto (las de la Mochila y las que llevan). */
  owned: (id: string) => number
  /** El equipo, con lo que lleva cada uno. */
  team: readonly { species: string; name: string; item: string | null }[]
  scale?: number
  reservedHeight?: number
}

export function UnovaExchangeScreen({ points, offers, onBuy, onExit, itemName, itemText, owned, team, scale, reservedHeight }: UnovaExchangeScreenProps) {
  const [cursor, setCursor] = useState(0)
  const [scroll, setScroll] = useState(0)
  const [asking, setAsking] = useState(null as string | null)
  const [note, setNote] = useState(null as string | null)
  const rows = offers.length + 1 // la última fila es SALIR
  usePreloadImages(offers.map((offer) => itemIconUrl(offer.item)))
  const selected = offers[cursor] ?? null
  const message = note ?? (asking ? t.confirm(itemName(asking), offers.find((offer) => { return offer.item === asking })?.price ?? 0) : null)
  const description = wrapText(message ?? (selected ? itemText(selected.item) : t.choose), 244, textWidth13).slice(0, 3)

  const point = (i: number, focus = false) => {
    const next = Math.max(0, Math.min(rows - 1, i))
    setCursor(next)
    if (next < scroll) setScroll(next)
    if (next >= scroll + VISIBLE) setScroll(next - VISIBLE + 1)
    setNote(null)
    if (focus) requestAnimationFrame(() => (document.querySelector(`[data-exchange-row="${next}"]`) as HTMLElement | null)?.focus())
  }
  const scrollBy = (by: number) => {
    const next = scrollList(scroll, cursor, rows, VISIBLE, by)
    setScroll(next.scroll)
    setCursor(next.cursor)
    setNote(null)
  }
  const pick = (i: number) => {
    if (i === offers.length) { onExit(); return }
    point(i)
    if (offers[i].price > points) { setNote(t.notEnough); return }
    setAsking(offers[i].item)
  }
  const confirm = (yes: boolean) => {
    const item = asking
    setAsking(null)
    if (!yes || !item) return
    onBuy(item)
    setNote(t.bought(itemName(item)))
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (asking) { if (event.key === 'Escape') { event.preventDefault(); setAsking(null) } return }
    const moves: Record<string, () => void> = { ArrowUp: () => point(cursor - 1, true), ArrowDown: () => point(cursor + 1, true), Escape: onExit }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    move()
  }

  return (
    <div className="exchange-screen" onKeyDown={onKeyDown}>
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="preview" className="unova-screen" style={unovaVars()}>
          <span className="unova-panel" style={{ left: 4, top: 4, width: 248, height: 184 }} />
          <UnovaTitle x={7} y={8} width={242} title={u.shopTitle} />
          {selected && (
            <>
              <img className="unova-shop-big" src={itemIconUrl(selected.item)} alt="" style={{ left: 14, top: 36 }} />
              <span className="unova-text" style={{ left: 82, top: 40 }}>{itemName(selected.item)}</span>
              <span className="unova-text unova-gold" style={{ left: 82, top: 58 }}>{t.price(selected.price)}</span>
              <span className="unova-text unova-soft" style={{ left: 82, top: 76 }}>
                {selected.price <= points ? u.shopLeft(points - selected.price) : u.shopMissing(selected.price - points)}
              </span>
            </>
          )}
          <span className="unova-text unova-soft" style={{ left: 14, top: 104 }}>{u.shopTeam}</span>
          {team.slice(0, 6).map((mon, i) => (
            <span key={i} className="unova-bar-off" style={{ left: 10 + (i % 2) * 120, top: 118 + Math.floor(i / 2) * 22, width: 116, height: 20 }}>
              <span className="unova-shop-mon"><MemberIcon spriteId={mon.species} /></span>
              <span className="unova-text" style={{ left: 18, top: -2 }}>{mon.item ? itemName(mon.item) : '—'}</span>
            </span>
          ))}
        </div>
      ), (
        <div key="mart" className="unova-screen" style={unovaVars()} onWheel={(event) => { if (!asking) scrollBy(wheelRows(event.deltaY)) }}>
          <img src={n2b2Ui('tienda-fondo')} alt="" style={{ left: 0, top: 0 }} />
          <span className="unova-text" style={{ left: 6, top: 8 }}>{t.points}</span>
          <span className="unova-text" style={{ right: 176, top: 8 }}>{points}</span>
          <span className="unova-text unova-soft" style={{ left: 6, top: 24 }}>{u.shopOwned}</span>
          <span className="unova-text unova-soft" style={{ right: 176, top: 24 }}>{selected ? owned(selected.item) : ''}</span>
          {selected && <img className="unova-shop-big" src={itemIconUrl(selected.item)} alt="" style={{ left: 12, top: 60 }} />}
          {Array.from({ length: Math.min(VISIBLE, rows - scroll) }, (_, k) => {
            const i = scroll + k
            const offer = offers[i]
            return (
              <button key={i} type="button" className="unova-shop-row" data-exchange-row={i} style={{ left: ROW.x, top: ROW.y + k * ROW.h, width: ROW.w, height: ROW.h }}
                aria-current={i === cursor || undefined}
                aria-label={offer ? t.itemLabel(itemName(offer.item), offer.price, offer.price <= points) : t.exitLabel}
                onClick={() => pick(i)} onFocus={() => { if (i !== cursor) point(i) }} onPointerEnter={() => { if (!asking) point(i) }}>
                <span className="unova-shop-text" style={{ left: 4, top: 2 }}>{offer ? itemName(offer.item) : t.exit}</span>
                {offer && <span className="unova-shop-text" style={{ right: 4, top: 2 }}>{t.price(offer.price)}</span>}
              </button>
            )
          })}
          {description.map((line, i) => <span key={i} className="unova-text" style={{ left: 6, top: 142 + i * 15 }}>{line}</span>)}
          {asking && (
            <span className="unova-pc-menu" role="menu" aria-label={message ?? ''} style={{ left: 188, top: 92, width: 64, height: 44 }}>
              {([[esCampaign.bag.yes, true], [esCampaign.bag.no, false]] as const).map(([label, yes], i) => (
                <button key={label} type="button" role="menuitem" className="unova-pc-menu-item" style={{ left: 0, top: i * 16, width: 52, height: 16 }}
                  aria-label={yes ? t.yesLabel : t.noLabel} autoFocus={i === 0} onClick={() => confirm(yes)}>
                  <span className="unova-text unova-pc-menu-cursor" style={{ left: 0, top: 1 }}>▶</span>
                  <span className="unova-text" style={{ left: 9, top: 1 }}>{label}</span>
                </button>
              ))}
            </span>
          )}
          <p className="sr-only" role="status">{message ?? t.status(points)}</p>
        </div>
      )]} />
    </div>
  )
}
