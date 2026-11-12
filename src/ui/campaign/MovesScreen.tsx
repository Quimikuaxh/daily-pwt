/**
 * Pantalla Movimientos de la campaña (D7, maqueta aprobada el 11/11/2026). Arriba, el Recordador de movimientos (menu_specialized.c):
 * ventana de datos (1,1) 16x12 con el tipo, la potencia y la precisión alineadas a x 106, los PP y la descripción en la fuente estrecha
 * desde y 65; lista (19,1) 10x12 con 6 filas, cursor de flecha y flechas de desplazamiento; mensaje en (4,15) 22x4. La lista termina en
 * SALIR, como la del juego en CANCEL. Abajo, los Datos del POKéMON en su página de movimientos (page_battle_moves): los cuatro equipados
 * con tipo, nombre y PP; EFECTO y DESCRIPCIÓN del señalado. Elegir uno de la lista con los cuatro huecos llenos pide cuál olvidar.
 * La categoría y el origen (nivel o MT/MO) no tienen sitio en el juego: van en el texto accesible.
 */
import { scrollList, wheelRows } from './listScroll'
import { useState, type KeyboardEvent } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { padNumber, textWidth } from '../console/glyphs'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { esCampaign } from '../../i18n/esCampaign'
import { wrapText } from './draftModel'
import { learnMove, type MoveInfo } from './movesModel'

const t = esCampaign.moves
const font = emeraldTheme.font as BitmapFont
const VISIBLE = 6

type MovesScreenProps = {
  mon: { species: string; name: string; level: number; dex: number }
  legal: readonly MoveInfo[]
  equipped: readonly string[]
  /** Cada cambio de los equipados (se guarda en la campaña). */
  onChange: (moves: string[]) => void
  onExit: () => void
  scale?: number
  reservedHeight?: number
}

const sourceLabel = (move: MoveInfo) => ('level' in move.source ? t.level(move.source.level) : move.source.machine)

export function MovesScreen({ mon, legal, equipped, onChange, onExit, scale, reservedHeight }: MovesScreenProps) {
  const [cursor, setCursor] = useState(0)
  const [scroll, setScroll] = useState(0)
  const [learning, setLearning] = useState(null as string | null)
  const [slot, setSlot] = useState(null as number | null)
  const [note, setNote] = useState(null as string | null)
  const byId = Object.fromEntries(legal.map((move) => [move.id, move]))
  const items = legal.length + 1 // la última fila es SALIR
  const selected = learning ? byId[learning] : slot !== null ? byId[equipped[slot]] : byId[legal[cursor]?.id]

  const moveCursor = (i: number) => {
    const next = Math.max(0, Math.min(items - 1, i))
    setCursor(next)
    setSlot(null)
    if (next < scroll) setScroll(next)
    if (next >= scroll + VISIBLE) setScroll(next - VISIBLE + 1)
  }
  const pick = (i: number) => {
    if (i === legal.length) { onExit(); return }
    const move = legal[i]
    moveCursor(i)
    if (equipped.includes(move.id)) { setNote(t.known(mon.name, move.name)); return }
    const added = learnMove(equipped, move.id)
    if (added) { onChange(added); setNote(t.learned(mon.name, move.name)); return }
    setLearning(move.id)
    setNote(null)
  }
  const forget = (i: number) => {
    if (!learning) { setSlot(i); setNote(null); return }
    const next = learnMove(equipped, learning, i)
    if (next) { onChange(next); setNote(t.swapped(mon.name, byId[equipped[i]]?.name ?? equipped[i], byId[learning].name)) }
    setLearning(null)
  }
  const scrollBy = (rows: number) => {
    const next = scrollList(scroll, cursor, items, VISIBLE, rows)
    setScroll(next.scroll)
    setCursor(next.cursor)
    setSlot(null)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && learning) { event.preventDefault(); setLearning(null); return }
    // Salida rápida sin bajar hasta SALIR (Jose, 12/11/2026).
    if (event.key === 'Escape') { event.preventDefault(); onExit(); return }
    const row = (event.target as HTMLElement).dataset.row
    if (row === undefined || learning || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    const next = Number(row) + (event.key === 'ArrowDown' ? 1 : -1)
    moveCursor(next)
    requestAnimationFrame(() => (document.querySelector(`[data-row="${Math.max(0, Math.min(items - 1, next))}"]`) as HTMLElement | null)?.focus())
  }

  const message = learning ? t.forget(mon.name) : note ?? t.learn(mon.name)
  const messageLines = wrapText(message, 176, (line) => textWidth(font, line)).slice(0, 2)
  const describe = (move: MoveInfo) => {
    return t.details(move.name, move.typeName, t.categories[move.category], move.power, move.accuracy, move.pp, move.text)
  }

  return (
    <div className="moves-screen" onKeyDown={onKeyDown}>
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="relearner" className="moves-top">
          <div className="moves-black" />
          <GameWindow x={1} y={1} width={16} height={12}>
            <div aria-hidden="true">
              <GameText text={t.title} y={1} width={128} align="center" hidden />
              <GameText text={t.power} y={25} width={106} align="right" hidden />
              <GameText text={t.pp} x={4} y={41} hidden />
              <GameText text={t.accuracy} y={41} width={106} align="right" hidden />
              {selected && (
                <>
                  <GameText text={selected.typeName} x={4} y={25} width={54} fit hidden />
                  <GameText text={String(selected.pp)} x={4 + textWidth(font, t.pp)} y={41} hidden />
                  <GameText text={selected.power ? String(selected.power) : t.none} x={106} y={25} hidden />
                  <GameText text={selected.accuracy ? String(selected.accuracy) : t.none} x={106} y={41} hidden />
                  {selected.text.split('\n').map((line, i) => <GameText key={i} text={line} y={65 + i * 16} width={128} face="narrow" hidden />)}
                </>
              )}
            </div>
          </GameWindow>
          <GameWindow x={19} y={1} width={10} height={12}>
            <div className="moves-list" style={{ left: 0, top: 0, width: 80, height: 96 }} onWheel={(event) => { if (!learning) scrollBy(wheelRows(event.deltaY)) }}>
            {Array.from({ length: Math.min(VISIBLE, items - scroll) }, (_, k) => {
              const i = scroll + k
              const move = legal[i]
              return (
                <button key={i} type="button" className="moves-row" data-row={i} style={{ left: 0, top: k * 16, width: 80, height: 16 }}
                  aria-current={i === cursor && slot === null ? true : undefined}
                  aria-label={move ? t.rowLabel(move.name, move.typeName, t.categories[move.category], sourceLabel(move), equipped.includes(move.id)) : t.exitLabel}
                  onClick={() => pick(i)} onFocus={() => { if (!learning) moveCursor(i) }} onPointerEnter={() => { if (!learning) moveCursor(i) }}>
                  {i === cursor && slot === null && <GameText text="▶" y={1} hidden />}
                  <GameText text={move ? move.name : t.exit} x={8} y={1} width={72} fit hidden />
                </button>
              )
            })}
            </div>
          </GameWindow>
          {/* Flechas con más superficie (todo el ancho de la lista) y que pasan una página (Jose, 12/11/2026: costaba acertar). */}
          {scroll > 0 && (
            <button type="button" className="moves-scroll" style={{ left: 152, top: 0, width: 88, height: 12 }} aria-label={t.scroll(false)} onClick={() => scrollBy(-VISIBLE)}>
              <img className="blink-a" src={emeraldTheme.asset('lista-arriba')} alt="" style={{ left: 32, top: 0 }} />
            </button>
          )}
          {scroll + VISIBLE < items && (
            <button type="button" className="moves-scroll" style={{ left: 152, top: 100, width: 88, height: 16 }} aria-label={t.scroll(true)} onClick={() => scrollBy(VISIBLE)}>
              <img className="blink-a" src={emeraldTheme.asset('lista-abajo')} alt="" style={{ left: 32, top: -4 }} />
            </button>
          )}
          <GameWindow x={4} y={15} width={22} height={4}>
            <p className="sr-only" role="status">{message}</p>
            {messageLines.map((line, i) => <GameText key={i} text={line} y={1 + i * 16} width={176} hidden />)}
          </GameWindow>
        </div>
      ), (
        <div key="summary" className="moves-summary">
          <img src={emeraldTheme.asset('datos-movimientos')} alt="" style={{ left: 0, top: 0 }} />
          <div aria-hidden="true">
            <GameText text={t.page} x={2} y={1} width={88} color="datos-rotulo" hidden />
            <GameText text={`{NO}${String(mon.dex).padStart(3, '0')}`} x={8} y={17} color="datos-rotulo" hidden />
            <img className="mon-front" src={emeraldSprite('front', mon.species)} alt="" style={{ left: 8, top: 32 }} />
            <GameText text={mon.name} x={8} y={97} color="datos-rotulo" hidden />
            <GameText text={t.page} x={98} y={20} face="small" color="tira" hidden />
            <GameText text={t.effect} x={18} y={108} face="small" color="tira" hidden />
            <GameText text={t.description} x={98} y={108} face="small" color="tira" hidden />
          </div>
          {Array.from({ length: 4 }, (_, i) => {
            const move = byId[equipped[i]]
            return (
              <button key={i} type="button" className="moves-slot" style={{ left: 84, top: 32 + 16 * i, width: 154, height: 16 }}
                aria-current={slot === i || (learning !== null && i === 0) ? true : undefined}
                aria-label={t.slotLabel(learning !== null, move?.name ?? null, move?.typeName ?? '', move?.pp ?? 0, i + 1)}
                onClick={() => forget(i)} onFocus={() => { if (!learning) setSlot(i) }} onPointerEnter={() => { if (!learning) setSlot(i) }}>
                {move ? (
                  <>
                    <img src={emeraldTheme.asset(`tipo-${move.type}`)} alt="" style={{ left: 1, top: 0 }} />
                    <GameText text={move.name} x={36} y={1} width={72} fit color="datos-rotulo" hidden />
                    <GameText text={`{PP}${padNumber(font, move.pp, 2)}/${padNumber(font, move.pp, 2)}`} x={108} y={1} width={44} align="right" color="datos-pp" hidden />
                  </>
                ) : (
                  <>
                    <GameText text="-" x={36} y={1} color="datos-rotulo" hidden />
                    <GameText text="--" x={108} y={1} width={44} align="center" color="datos" hidden />
                  </>
                )}
              </button>
            )
          })}
          {selected && (
            <div aria-hidden="true">
              <GameText text={t.powerLabel} x={8} y={121} width={52} fit color="datos-rotulo" hidden />
              <GameText text={t.accuracyLabel} x={8} y={137} width={52} fit color="datos-rotulo" hidden />
              <GameText text={selected.power ? padNumber(font, selected.power, 3) : t.none} x={61} y={121} color="datos" hidden />
              <GameText text={selected.accuracy ? padNumber(font, selected.accuracy, 3) : t.none} x={61} y={137} color="datos" hidden />
              {selected.text.split('\n').map((line, i) => <GameText key={i} text={line} x={86} y={121 + i * 16} width={148} color="datos" hidden />)}
            </div>
          )}
          {/* SALIR fijo, sin bajar hasta el final de la lista (Jose, 12/11/2026); como ACEPTAR y CANCELAR del equipo. */}
          <button type="button" className="team-button" style={{ left: 184, top: 0, width: 56, height: 16 }} aria-label={t.quickExitLabel} onClick={onExit}>
            <img src={emeraldTheme.asset('boton-pildora')} alt="" style={{ left: 0, top: 0 }} />
            <GameText text={t.exit} x={5} y={1} width={48} align="center" face="small" color="equipo" hidden />
          </button>
          <section className="sr-only" aria-label={t.screen}>
            <h3>{t.heading(mon.name, mon.level)}</h3>
            <ol>{equipped.map((id) => <li key={id}>{byId[id]?.name ?? id}</li>)}</ol>
            {selected && <p>{describe(selected)}</p>}
          </section>
        </div>
      )]} />
    </div>
  )
}
