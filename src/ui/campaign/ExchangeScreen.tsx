/**
 * Canje de Puntos Batalla de la campaña (D7, maqueta aprobada el 11/11/2026): el mostrador de intercambio del Frente Batalla de Esmeralda
 * (field_specials.c, ScrollableMultichoice con icono y descripción). Arriba, sobre el fondo de la Fábrica atenuado: los PB en la ventana
 * (1,1), la lista con precios en la ventana (13,1), que se desplaza con sus flechas y termina en SALIR, el icono del objeto en la ventana
 * (1,5) y la descripción en dos líneas en la ventana (1,15). Elegir pide confirmación (SÍ/NO); lo canjeado va a la Mochila. Abajo, el equipo.
 */
import { useState, type KeyboardEvent } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { esCampaign } from '../../i18n/esCampaign'
import { wrapText } from './draftModel'
import { itemName, itemText } from './bagModel'
import { exchangeScroll, EXCHANGE_ROWS } from './exchangeModel'

const t = esCampaign.exchange
const font = emeraldTheme.font as BitmapFont

type ExchangeScreenProps = {
  points: number
  offers: readonly { item: string; price: number }[]
  onBuy: (item: string) => void
  onExit: () => void
  scale?: number
  reservedHeight?: number
}

export function ExchangeScreen({ points, offers, onBuy, onExit, scale, reservedHeight }: ExchangeScreenProps) {
  const [cursor, setCursor] = useState(0)
  const [scroll, setScroll] = useState(0)
  const [asking, setAsking] = useState(null as string | null)
  const [note, setNote] = useState(null as string | null)
  const rows = offers.length + 1
  const selected = offers[cursor] ?? null
  const message = note ?? (asking ? t.confirm(itemName(asking), offers.find((offer) => { return offer.item === asking })?.price ?? 0) : null)
  const description = message ?? (selected ? itemText(selected.item).replace(/\n/g, ' ') : t.choose)
  const lines = wrapText(description, 208, (line) => textWidth(font, line)).slice(0, 2)

  const point = (i: number, focus = false) => {
    const next = Math.max(0, Math.min(rows - 1, i))
    setCursor(next)
    setScroll(exchangeScroll(next, scroll, rows))
    setNote(null)
    if (focus) requestAnimationFrame(() => (document.querySelector(`[data-exchange-row="${next}"]`) as HTMLElement | null)?.focus())
  }
  const pick = (i: number) => {
    if (i === offers.length) { onExit(); return }
    point(i)
    const offer = offers[i]
    if (points < offer.price) { setNote(t.notEnough); return }
    setAsking(offer.item)
  }
  const confirm = (yes: boolean) => {
    const item = asking
    setAsking(null)
    if (yes && item) { onBuy(item); setNote(t.bought(itemName(item))) }
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (asking) { if (event.key === 'Escape') { event.preventDefault(); setAsking(null) } return }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); point(cursor + (event.key === 'ArrowDown' ? 1 : -1), true) }
    if (event.key === 'Escape') { event.preventDefault(); onExit() }
  }

  return (
    <div className="exchange-screen" onKeyDown={onKeyDown}>
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="exchange" className="exchange-top">
          <img className="exchange-bg" src={emeraldTheme.asset('fabrica-fondo')} alt="" style={{ left: 0, top: 0 }} />
          <GameWindow x={1} y={1} width={8} height={2}>
            <GameText text={t.points} y={1} hidden />
            <GameText text={String(points)} x={24} y={1} width={40} align="right" hidden />
          </GameWindow>
          {selected && (
            <GameWindow x={1} y={5} width={3} height={3}>
              <img src={emeraldTheme.asset(`objeto-${selected.item}`)} alt="" style={{ left: 0, top: 0 }} />
            </GameWindow>
          )}
          <GameWindow x={13} y={1} width={16} height={12}>
            {Array.from({ length: Math.min(EXCHANGE_ROWS, rows - scroll) }, (_, k) => {
              const i = scroll + k
              const offer = offers[i]
              return (
                <button key={i} type="button" className="moves-row" data-exchange-row={i} style={{ left: 0, top: 16 * k, width: 128, height: 16 }}
                  aria-current={i === cursor || undefined} autoFocus={i === 0 && scroll === 0}
                  aria-label={offer ? t.itemLabel(itemName(offer.item), offer.price, points >= offer.price) : t.exitLabel}
                  onClick={() => pick(i)} onFocus={() => { if (i !== cursor) point(i) }} onPointerEnter={() => { if (!asking) point(i) }}>
                  {i === cursor && <GameText text={'▶'} y={1} hidden />}
                  <GameText text={offer ? itemName(offer.item) : t.exit} x={8} y={1} width={80} fit hidden />
                  {offer && <GameText text={t.price(offer.price)} x={88} y={1} width={40} align="right" hidden />}
                </button>
              )
            })}
          </GameWindow>
          {scroll > 0 && (
            <button type="button" className="moves-scroll" style={{ left: 160, top: 0, width: 24, height: 8 }} aria-label={esCampaign.bag.scroll(false)} onClick={() => point(scroll - 1)}>
              <img className="blink-a" src={emeraldTheme.asset('lista-arriba')} alt="" style={{ left: 4, top: -6 }} />
            </button>
          )}
          {scroll + EXCHANGE_ROWS < rows && (
            <button type="button" className="moves-scroll" style={{ left: 160, top: 104, width: 24, height: 8 }} aria-label={esCampaign.bag.scroll(true)} onClick={() => point(scroll + EXCHANGE_ROWS)}>
              <img className="blink-a" src={emeraldTheme.asset('lista-abajo')} alt="" style={{ left: 4, top: -2 }} />
            </button>
          )}
          <GameWindow x={1} y={15} width={28} height={4}>
            {lines.map((line, i) => <GameText key={i} text={line} y={1 + 16 * i} hidden />)}
          </GameWindow>
          {asking && (
            <GameWindow x={8} y={10} width={4} height={4}>
              {([[esCampaign.bag.yes, true], [esCampaign.bag.no, false]] as const).map(([label, yes], i) => (
                <button key={label} type="button" className="team-menu-item" style={{ left: 0, top: i * 16, width: 32, height: 16 }}
                  aria-label={yes ? t.yesLabel : t.noLabel} autoFocus={i === 0} onPointerEnter={(event) => event.currentTarget.focus()} onClick={() => confirm(yes)}>
                  <GameText text={'▶'} y={1} hidden />
                  <GameText text={label} x={8} y={1} hidden />
                </button>
              ))}
            </GameWindow>
          )}
          <p className="sr-only" role="status">{`${message ?? (selected ? `${itemName(selected.item)}. ${description}` : t.choose)} ${t.status(points)}`}</p>
        </div>
      ), (
        <div key="info" className="exchange-bottom">
          <img src={emeraldTheme.asset('equipo-fondo')} alt="" style={{ left: 0, top: 0 }} />
          <GameWindow x={1} y={17} width={21} height={2}>
            <GameText text={t.status(points)} y={1} width={168} fit hidden />
          </GameWindow>
        </div>
      )]} />
    </div>
  )
}
