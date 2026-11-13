/**
 * Pantalla Equipo y PC de la campaña (D7, maqueta aprobada el 11/11/2026). Arriba, el PC en modo «Mover POKéMON»
 * (pokemon_storage_system.c): panel de datos a la izquierda (ventana (0,11): nombre en (6,0), especie en (6,15), nivel en (10,29) y
 * objeto en (6,43)), botones EQUIPO y CERRAR, caja con su título y flechas, iconos en (100 + 24·col, 44 + 24·fila) y la mano del cursor.
 * Dos cajas: CAJA 1 con los reclutados que no van y BAJAS con los debilitados, que no se mueven. Abajo, la pantalla de equipo
 * (party_menu.c) con el límite del rival: los huecos de más quedan vacíos. Mensaje en (1,17) y botones ACEPTAR y CANCELAR.
 * Mover: arrastrar a otro hueco, o tocar el Pokémon y después el destino (también con teclado: Intro, flechas y Esc). Soltar sobre otro
 * Pokémon los intercambia. El equipo nunca se queda vacío ni pasa del límite. Sin género: la campaña no lo guarda.
 */
import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { usePreloadImages } from './usePreloadImages'
import { esCampaign } from '../../i18n/esCampaign'
import { PartySlot } from './PartySlot'
import { SummaryPages } from './SummaryPages'
import type { SummaryData } from './EmeraldBattle'
import { slotBox } from './partySlotModel'
import { BOX_SIZE, lineup, monAt, moveMon, partyCount, PARTY_SIZE, samePlace, type MoveNote, type Place, type TeamLayout, type TeamMon } from './teamModel'
import { arrowTarget, pcMenuWindow, placeKey, placeOf, useMonDrag } from './teamDrag'

const t = esCampaign.team
const m = esCampaign.pcMenu

type TeamScreenProps = {
  mons: Readonly<Record<string, TeamMon>>
  initial: TeamLayout
  limit: number
  rivalName: string
  itemName: (id: string) => string
  onAccept: (team: string[]) => void
  onCancel: () => void
  /** MOVIMIENTOS en el menú del PC: abre la pantalla Movimientos de ese Pokémon. */
  onMoves: (id: string) => void
  /** OBJETO → DAR: abre la Mochila para ese Pokémon. */
  onGiveItem: (id: string) => void
  /** OBJETO → QUITAR: guarda en la Mochila el objeto que lleva. */
  onTakeItem: (id: string) => void
  /** Cada cambio de colocación, para conservarla al ir a Movimientos y volver. */
  onLayoutChange?: (layout: TeamLayout) => void
  /** DATOS en el menú del PC (Jose, 12/11/2026): la ficha del Pokémon en la pantalla de abajo. */
  summaryOf?: (id: string) => SummaryData | null
  /** Solo para mirar (desde OTROS en el draft; Jose, 12/11/2026): sin mover, sin menú y sin ACEPTAR; CANCELAR vuelve. */
  readOnly?: boolean
  /** EVOLUCIONAR en el menú del PC: si ese Pokémon puede evolucionar ahora (objeto, intercambio, amistad o belleza). */
  canEvolve?: (id: string) => boolean
  onEvolve?: (id: string) => void
  scale?: number
  reservedHeight?: number
}

/** Las píldoras moradas de equipo-fondo van de x 189 a 236 (48 px): el texto se centra ahí, no en el botón de 56 (medido; con x 8 quedaba
    3 px a la derecha). En vertical, las mayúsculas quedan 0,5 px por debajo del centro de la píldora (y 130–141). */
const PILL_X = 5

const boxCell = (i: number) => ({ x: 100 + 24 * (i % 6), y: 44 + 24 * Math.floor(i / 6) })

export function TeamScreen({ readOnly = false, canEvolve, onEvolve, mons, initial, limit, rivalName, itemName, onAccept, onCancel, onMoves, onGiveItem, onTakeItem, onLayoutChange, summaryOf, scale, reservedHeight }: TeamScreenProps) {
  const [layout, setLayout] = useState(initial)
  // DATOS cambia de Pokémon al pasar el puntero, y los iconos, de caja en caja: los de todos, listos de antemano.
  usePreloadImages(Object.values(mons).flatMap((mon) => [emeraldSprite('front', mon.species), emeraldSprite('icon', mon.species)]))
  const [box, setBox] = useState(0)
  const [held, setHeld] = useState(null as Place | null)
  const [summaryId, setSummaryId] = useState(null as string | null)
  const [summaryPage, setSummaryPage] = useState(0)
  const [hover, setHover] = useState(null as Place | null)
  const [note, setNote] = useState(null as MoveNote | null)
  // Menú del PC (MOVER / MOVIMIENTOS / CANCELAR) del Pokémon tocado, como al pulsar A en el juego.
  const [menu, setMenu] = useState(null as Place | null)
  const [itemMenu, setItemMenu] = useState(false)

  const focusPlace = (place: Place) => requestAnimationFrame(() => (document.querySelector(`[data-place="${placeKey(place)}"]`) as HTMLElement | null)?.focus())
  const tryMove = (from: Place, to: Place) => {
    const result = moveMon(layout, from, to, limit)
    setLayout(result.layout)
    onLayoutChange?.(result.layout)
    setNote(result.note)
    setHeld(null)
    focusPlace(result.note ? from : to)
  }
  const act = (place: Place) => {
    if (readOnly) return
    if (place.area === 'box' && layout.boxes[place.box].ko) { setNote('fainted'); return }
    if (place.area === 'party' && place.i >= limit) { setNote('limit'); return }
    if (!held) {
      if (!monAt(layout, place)) return
      setMenu(place)
      setNote(null)
      return
    }
    tryMove(held, place)
  }
  const drag = useMonDrag({ box, canDrag: (place) => !readOnly && !!monAt(layout, place) && !(place.area === 'box' && layout.boxes[place.box].ko) && !(place.area === 'party' && place.i >= limit), onDrop: tryMove, onTap: act })

  // Con el menú abierto, los datos son los del Pokémon del menú: pasar el puntero por otro no los cambia (Jose, 12/11/2026).
  const shown = (held && monAt(layout, held)) || (menu && monAt(layout, menu)) || (hover && monAt(layout, hover)) || layout.party[0]
  const info = shown ? mons[shown] : null
  const noteText = note === 'limit' ? t.notes.limit(rivalName, limit) : note ? t.notes[note] : null
  const menuId = menu ? monAt(layout, menu) : null
  const message = readOnly ? t.viewOnly : held ? t.where : menuId ? m.prompt(mons[menuId].name) : t.choose
  const heldId = held ? monAt(layout, held) : null
  const cursorAt = hover?.area === 'box' && hover.box === box ? hover : held?.area === 'box' && held.box === box ? held : null
  const lossNames = layout.boxes[1].mons.filter((id): id is string => !!id).map((id) => mons[id]?.name ?? id).join(', ')
  const draggingId = drag.dragging ? monAt(layout, drag.dragging.from) : null

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    const place = placeOf(target.dataset.place, box)
    if (event.key === 'Escape' && menu) {
      event.preventDefault()
      setItemMenu(false)
      setMenu(null)
      focusPlace(menu)
      return
    }
    if (event.key === 'Escape' && held) {
      event.preventDefault()
      setHeld(null)
      setNote(null)
      focusPlace(held)
      return
    }
    const next = place && arrowTarget(place, event.key)
    if (next) {
      event.preventDefault()
      focusPlace(next)
    }
  }

  const slotLabel = (place: Place, id: string | null) => {
    const mon = id ? mons[id] : null
    const described = mon ? t.monLabel(mon.name, mon.level, mon.hp) : null
    return place.area === 'party'
      ? t.partySlot(place.i + 1, described, place.i >= limit, samePlace(held, place))
      : t.boxSlot(t.boxes[place.box], place.i + 1, described, layout.boxes[place.box].ko, samePlace(held, place))
  }

  return (
    <div className="team-screen" onKeyDown={onKeyDown}>
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="pc" className="team-pc">
          <img src={emeraldTheme.asset('pc-fondo')} alt="" style={{ left: 0, top: 0 }} />
          <GameText text={t.data} x={14} y={1} width={52} align="center" face="small" color="pc-rotulo" hidden />
          <button type="button" className="team-button" style={{ left: 80, top: 0, width: 72, height: 16 }} aria-label={t.partyLabel}
            onClick={() => focusPlace({ area: 'party', i: 0 })}>
            <GameText text={t.party} width={72} align="center" face="small" color="pc-verde" hidden />
          </button>
          <button type="button" className="team-button" style={{ left: 168, top: 0, width: 72, height: 16 }} aria-label={t.closeLabel} onClick={onCancel}>
            {/* La píldora azul de pc-fondo va de x 173 a 238 y de y 3 a 13 (medido): el texto se centra en ella, no en el botón. */}
            <GameText text={t.close} x={5} y={1} width={66} align="center" face="small" color="pc-azul" hidden />
          </button>
          <GameText text={t.boxes[box]} x={80} y={20} width={160} align="center" color="pc-caja" />
          {([['izda', -1, 88], ['dcha', 1, 224]] as const).map(([side, step, x]) => (
            <button key={side} type="button" className="team-button" style={{ left: x, top: 20, width: 8, height: 16 }}
              aria-label={t.boxArrow(step > 0, t.boxes[(box + step + layout.boxes.length) % layout.boxes.length])}
              onClick={() => { setBox((box + step + layout.boxes.length) % layout.boxes.length); setNote(null) }}>
              <img src={emeraldTheme.asset(`pc-flecha-${side}`)} alt="" style={{ left: 0, top: 0 }} />
            </button>
          ))}
          {/* La sombra de la mano va por debajo de los iconos, como en el juego (encima tapaba al Pokémon; Jose, 11/11/2026). */}
          {cursorAt && !drag.dragging && (
            <img className="team-hand-shadow" src={emeraldTheme.asset('pc-mano-sombra')} alt="" style={{ left: boxCell(cursorAt.i).x - 8, top: boxCell(cursorAt.i).y }} />
          )}
          {layout.boxes[box].mons.slice(0, BOX_SIZE).map((id, i) => {
            const place: Place = { area: 'box', box, i }
            const cell = boxCell(i)
            const hidden = samePlace(held, place) || id === draggingId
            return (
              <button key={i} type="button" className="team-cell" data-place={placeKey(place)} style={{ left: cell.x - 12, top: cell.y - 12, width: 24, height: 24 }}
                aria-label={slotLabel(place, id)} {...drag.handlers(place)}
                onPointerEnter={() => { if (!menu) setHover(place) }} onFocus={() => { if (!menu) setHover(place) }}>
                {id && !hidden && <img className="mon-icon" src={emeraldSprite('icon', mons[id].species)} alt="" style={{ left: -4, top: -4 }} />}
              </button>
            )
          })}
          {cursorAt && !drag.dragging && (
            <div className="team-hand" aria-hidden="true">
              {heldId && <img className="mon-icon" src={emeraldSprite('icon', mons[heldId].species)} alt="" style={{ left: boxCell(cursorAt.i).x - 16, top: boxCell(cursorAt.i).y - 24 }} />}
              <img className={heldId ? undefined : 'blink-a'} src={emeraldTheme.asset(heldId ? 'pc-mano-cogiendo' : 'pc-mano-abierta')} alt="" style={{ left: boxCell(cursorAt.i).x - 16, top: boxCell(cursorAt.i).y - 28 }} />
              {!heldId && <img className="blink-b" src={emeraldTheme.asset('pc-mano-rebote')} alt="" style={{ left: boxCell(cursorAt.i).x - 16, top: boxCell(cursorAt.i).y - 28 }} />}
            </div>
          )}
          {menu && menuId && (
            <PcMenu
              label={itemMenu ? m.itemLabel(mons[menuId].name) : m.label(mons[menuId].name)}
              options={itemMenu ? [
                [m.give, m.giveLabel(mons[menuId].name), () => { setMenu(null); setItemMenu(false); onGiveItem(menuId) }],
                [m.take, m.takeLabel(mons[menuId].name), () => { setMenu(null); setItemMenu(false); onTakeItem(menuId); focusPlace(menu) }],
                [m.cancel, m.cancelLabel, () => { setItemMenu(false) }],
              ] : [
                [m.move, m.moveLabel(mons[menuId].name), () => { setHeld(menu); setMenu(null) }],
                [m.moves, m.movesLabel(mons[menuId].name), () => { setMenu(null); onMoves(menuId) }],
                ...(summaryOf ? [[m.summary, m.summaryLabel(mons[menuId].name), () => { setMenu(null); setSummaryId(menuId); setSummaryPage(0) }] as const] : []),
                // OBJETO: sin objeto, la Mochila directamente; con objeto, DAR / QUITAR como el menú de equipo del juego.
                [m.item, m.itemLabel(mons[menuId].name), () => { if (mons[menuId].item) setItemMenu(true); else { setMenu(null); onGiveItem(menuId) } }],
                ...(canEvolve?.(menuId) && onEvolve ? [[m.evolve, m.evolveLabel(mons[menuId].name), () => { setMenu(null); onEvolve(menuId) }] as const] : []),
                [m.cancel, m.cancelLabel, () => { setMenu(null); focusPlace(menu) }],
              ]}
            />
          )}
          {info && (
            <div className="team-info" aria-hidden="true">
              <img className="mon-front" src={emeraldSprite('front', info.species)} alt="" style={{ left: 8, top: 16 }} />
              <GameText text={info.name} x={6} y={88} color="pc-datos" hidden />
              <GameText text={`/${info.name}`} x={6} y={103} face="short" color="pc-datos" hidden />
              <GameText text={` {LV_2}${info.level}`} x={10} y={117} face="short" color="pc-nivel" hidden />
              {info.item && <GameText text={itemName(info.item)} x={6} y={131} face="short" color="pc-datos" hidden />}
            </div>
          )}
        </div>
      ), (() => { return summaryId && summaryOf?.(summaryId) ? (
        <SummaryPages key="summary" mon={summaryOf(summaryId)!.mon} level={summaryOf(summaryId)!.level} item={summaryOf(summaryId)!.item}
          page={summaryPage} onPage={setSummaryPage} profile={esCampaign.draft.trainedProfile(summaryOf(summaryId)!.level)}
          heading={m.summaryLabel(mons[summaryId].name)} onExit={() => { setSummaryId(null) }} />
      ) : (
        <div key="party" className="team-party">
          <img src={emeraldTheme.asset('equipo-fondo')} alt="" style={{ left: 0, top: 0 }} />
          {Array.from({ length: PARTY_SIZE }, (_, i) => {
            const place: Place = { area: 'party', i }
            const id = layout.party[i]
            const mon = id ? mons[id] : null
            const r = slotBox(i)
            const active = samePlace(held, place) || samePlace(hover, place)
            return (
              <button key={i} type="button" className="team-cell" data-place={placeKey(place)} style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                aria-label={slotLabel(place, id)} aria-disabled={i >= limit || undefined} {...drag.handlers(place)}
                onPointerEnter={() => { if (!menu) setHover(place) }} onFocus={() => { if (!menu) setHover(place) }}>
                {/* Cogido con un toque o arrastrándolo, la placa sigue con sus datos hasta soltarlo: el equipo no tiene mano que lo lleve y vaciarla
                    al empezar el arrastre parecía que el Pokémon ya se había movido (Jose, 12 y 13/11/2026). */}
                <PartySlot i={i} mon={mon && { ...mon, maxHp: mon.hp }} state={active ? 'activa' : 'normal'} bounce={active} />
              </button>
            )
          })}
          <GameWindow x={1} y={17} width={21} height={2}>
            <GameText text={message} y={1} width={168} fit hidden />
          </GameWindow>
          {!readOnly && (
            <button type="button" className="team-button" style={{ left: 184, top: 128, width: 56, height: 16 }} aria-label={t.acceptLabel}
              onClick={() => onAccept(lineup(layout))}>
              <GameText text={t.accept} x={PILL_X} y={1} width={48} align="center" face="small" color="equipo" hidden />
            </button>
          )}
          <button type="button" className="team-button" style={{ left: 184, top: 144, width: 56, height: 16 }} aria-label={readOnly ? t.backToDraft : t.cancelLabel} onClick={onCancel}>
            <GameText text={t.cancel} x={PILL_X} y={1} width={48} align="center" face="small" color="equipo" hidden />
          </button>
          <section className="sr-only" aria-label={t.screen}>
            <h3>{t.heading(rivalName)}</h3>
            <ol>
              {lineup(layout).map((id) => <li key={id}>{t.monLabel(mons[id].name, mons[id].level, mons[id].hp)}</li>)}
            </ol>
            <p>{t.losses(lossNames)}</p>
            <p role="status">{`${message} ${noteText ?? t.status(partyCount(layout), limit)}${heldId ? ` ${t.moving(mons[heldId].name)}` : ''}`}</p>
          </section>
        </div>
      ) })()]} />
      {drag.dragging && draggingId && createPortal(
        <div className="team-drag" aria-hidden="true" style={{ left: drag.dragging.x, top: drag.dragging.y, '--k': drag.dragging.scale } as CSSProperties}>
          <img className="mon-icon" src={emeraldSprite('icon', mons[draggingId].species)} alt="" style={{ left: -16, top: -12 }} />
          <img src={emeraldTheme.asset('pc-mano-cogiendo')} alt="" style={{ left: -16, top: -16 }} />
        </div>,
        document.body,
      )}
    </div>
  )
}

/** Ventana de menú del PC (AddMenu de pokemon_storage_system.c) con su cursor ▶ en la opción con el foco. */
function PcMenu({ label, options }: { label: string; options: readonly (readonly [string, string, () => void])[] }) {
  const window = pcMenuWindow(options.map(([text]) => { return text }))
  return (
    <GameWindow {...window}>
      <div role="menu" aria-label={label}>
        {options.map(([text, name, action], i) => (
          <button key={text} type="button" role="menuitem" className="team-menu-item" style={{ left: 0, top: i * 16, width: window.width * 8, height: 16 }}
            aria-label={name} autoFocus={i === 0} onClick={action} onPointerEnter={(event) => event.currentTarget.focus()}>
            <GameText text={'\u25b6'} y={1} hidden />
            <GameText text={text} x={8} y={1} hidden />
          </button>
        ))}
      </div>
    </GameWindow>
  )
}
