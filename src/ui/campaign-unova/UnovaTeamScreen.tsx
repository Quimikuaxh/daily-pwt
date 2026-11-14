/**
 * Equipo y PC de la campaña de Teselia (maqueta aprobada el 14/11/2026), como el PC de 5.ª generación. Arriba, la pantalla de datos del
 * diario con el Pokémon señalado (el del menú, el cogido o el que tiene el puntero o el foco). Abajo, el PC de N2/B2: la pantalla de cajas
 * de la ROM con el fondo de caja del juego y su pestaña, el nombre de la caja con sus flechas, la rejilla de 6 x 5, el equipo en seis
 * casillas a la derecha (las que pasan del límite del rival, apagadas) y ACEPTAR y CANCELAR. Cursor: la mano del PC del juego.
 *
 * Mover es lo mismo que en Hoenn (teamModel y teamDrag): arrastrar, o tocar y elegir MOVER y después el destino (también con teclado:
 * Intro, flechas y Esc). El menú del PC: MOVER, MOVIMIENTOS, OBJETO (DAR / QUITAR), EVOLUCIONAR si puede y CANCELAR.
 */
import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { MemberIcon } from '../battle/party/MemberIcon'
import SummaryScreen from '../battle/party/SummaryScreen'
import type { PartyMember } from '../battle/party/partyModel'
import type { GameData } from '../../core/types'
import { esCampaign } from '../../i18n/esCampaign'
import { BOX_SIZE, lineup, monAt, moveMon, partyCount, PARTY_SIZE, samePlace, type MoveNote, type Place, type TeamLayout, type TeamMon } from '../campaign/teamModel'
import { arrowTarget, placeKey, placeOf, useMonDrag } from '../campaign/teamDrag'
import { n2b2Ui, unovaVars } from './unovaRoute'
import '../battle/party/party.css'
import '../battle/party/summary.css'
import './unova.css'

const t = esCampaign.team
const m = esCampaign.pcMenu

/** Rejilla de la caja sobre el fondo (6, 38): 6 x 5 casillas de 26 x 22. */
const boxCell = (i: number) => ({ x: 6 + 26 * (i % 6), y: 40 + 22 * Math.floor(i / 6) })
/** Equipo en la columna gris de la derecha: 2 x 3 casillas de 38 x 36. */
const partyCell = (i: number) => ({ x: 168 + 42 * (i % 2), y: 34 + 40 * Math.floor(i / 2) })

export type UnovaTeamScreenProps = {
  mons: Readonly<Record<string, TeamMon>>
  initial: TeamLayout
  limit: number
  rivalName: string
  itemName: (id: string) => string
  onAccept: (team: string[]) => void
  onCancel: () => void
  onMoves: (id: string) => void
  onGiveItem: (id: string) => void
  onTakeItem: (id: string) => void
  onLayoutChange?: (layout: TeamLayout) => void
  /** Ficha de la pantalla de datos del diario de cada Pokémon. */
  details?: (id: string) => PartyMember | null
  data: GameData
  readOnly?: boolean
  canEvolve?: (id: string) => boolean
  onEvolve?: (id: string) => void
  scale?: number
  reservedHeight?: number
}

export function UnovaTeamScreen({ readOnly = false, canEvolve, onEvolve, mons, initial, limit, rivalName, onAccept, onCancel, onMoves, onGiveItem, onTakeItem, onLayoutChange, details, data, scale, reservedHeight }: UnovaTeamScreenProps) {
  const [layout, setLayout] = useState(initial)
  const [box, setBox] = useState(0)
  const [held, setHeld] = useState(null as Place | null)
  const [hover, setHover] = useState(null as Place | null)
  const [note, setNote] = useState(null as MoveNote | null)
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

  const shown = (held && monAt(layout, held)) || (menu && monAt(layout, menu)) || (hover && monAt(layout, hover)) || layout.party[0]
  const member = shown && details ? details(shown) : null
  const noteText = note === 'limit' ? t.notes.limit(rivalName, limit) : note ? t.notes[note] : null
  const menuId = menu ? monAt(layout, menu) : null
  const message = readOnly ? t.viewOnly : held ? t.where : menuId ? m.prompt(mons[menuId].name) : t.choose
  const heldId = held ? monAt(layout, held) : null
  const cursorAt = hover?.area === 'box' && hover.box === box ? hover : held?.area === 'box' && held.box === box ? held : null
  const lossNames = layout.boxes[1].mons.filter((id): id is string => !!id).map((id) => mons[id]?.name ?? id).join(', ')
  const draggingId = drag.dragging ? monAt(layout, drag.dragging.from) : null
  const boxCount = layout.boxes.length
  const stepBox = (step: number) => { setBox((box + step + boxCount) % boxCount); setNote(null) }

  const onKeyDown = (event: KeyboardEvent) => {
    const place = placeOf((event.target as HTMLElement).dataset.place, box)
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
  const hoverHandlers = (place: Place) => ({ onPointerEnter: () => { if (!menu) setHover(place) }, onFocus: () => { if (!menu) setHover(place) } })

  const menuOptions: readonly (readonly [string, string, () => void])[] = !menu || !menuId ? [] : itemMenu ? [
    [m.give, m.giveLabel(mons[menuId].name), () => { setMenu(null); setItemMenu(false); onGiveItem(menuId) }],
    [m.take, m.takeLabel(mons[menuId].name), () => { setMenu(null); setItemMenu(false); onTakeItem(menuId); focusPlace(menu) }],
    [m.cancel, m.cancelLabel, () => { setItemMenu(false) }],
  ] : [
    [m.move, m.moveLabel(mons[menuId].name), () => { setHeld(menu); setMenu(null) }],
    [m.moves, m.movesLabel(mons[menuId].name), () => { setMenu(null); onMoves(menuId) }],
    [m.item, m.itemLabel(mons[menuId].name), () => { if (mons[menuId].item) setItemMenu(true); else { setMenu(null); onGiveItem(menuId) } }],
    ...(canEvolve?.(menuId) && onEvolve ? [[m.evolve, m.evolveLabel(mons[menuId].name), () => { setMenu(null); onEvolve(menuId) }] as const] : []),
    [m.cancel, m.cancelLabel, () => { setMenu(null); focusPlace(menu) }],
  ]

  return (
    <div className="team-screen" onKeyDown={onKeyDown}>
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} freeScreens={[0]} screens={[(
        <div key="summary" className="unova-draft-summary">
          {member && <SummaryScreen key={shown ?? ''} members={[member]} initialSlot={1} initialPage={1} data={data} onClose={() => undefined} />}
        </div>
      ), (
        <div key="pc" className="unova-pc" style={unovaVars()}>
          <img src={n2b2Ui('pc-marco')} alt="" style={{ left: 0, top: 0 }} />
          <img src={n2b2Ui(`caja-${box + 1}-titulo`)} alt="" style={{ left: 28, top: 11 }} />
          <img src={n2b2Ui(`caja-${box + 1}`)} alt="" style={{ left: 6, top: 38 }} />
          <span className="unova-text unova-pc-box-name" style={{ left: 28, top: 14, width: 112 }}>{t.boxes[box]}</span>
          {([['izda', -1, 6], ['dcha', 1, 142]] as const).map(([side, step, x]) => (
            <button key={side} type="button" style={{ left: x, top: 11, width: 21, height: 19 }}
              aria-label={t.boxArrow(step > 0, t.boxes[(box + step + boxCount) % boxCount])} onClick={() => stepBox(step)}>
              <img src={n2b2Ui(`pc-flecha-${side}`)} alt="" style={{ left: 0, top: 0 }} />
            </button>
          ))}
          {layout.boxes[box].mons.slice(0, BOX_SIZE).map((id, i) => {
            const place: Place = { area: 'box', box, i }
            const cell = boxCell(i)
            const hidden = samePlace(held, place) || id === draggingId
            return (
              <button key={i} type="button" className="team-cell" data-place={placeKey(place)} style={{ left: cell.x, top: cell.y, width: 26, height: 22 }}
                aria-label={slotLabel(place, id)} {...drag.handlers(place)} {...hoverHandlers(place)}>
                {id && !hidden && <span className="unova-pc-icon"><MemberIcon spriteId={mons[id].species} dimmed={layout.boxes[box].ko} /></span>}
              </button>
            )
          })}
          <span className="unova-text unova-pc-party-title" style={{ left: 166, top: 15, width: 84 }}>{`${t.party} ${partyCount(layout)}/${limit}`}</span>
          {Array.from({ length: PARTY_SIZE }, (_, i) => {
            const place: Place = { area: 'party', i }
            const id = layout.party[i]
            const cell = partyCell(i)
            const active = samePlace(held, place) || samePlace(hover, place)
            const hidden = id === draggingId
            return (
              <button key={i} type="button" className={`team-cell ${active ? 'unova-bar' : 'unova-bar-off'}${i >= limit ? ' unova-pc-locked' : ''}`}
                data-place={placeKey(place)} style={{ left: cell.x, top: cell.y, width: 38, height: 36 }}
                aria-label={slotLabel(place, id)} aria-disabled={i >= limit || undefined} {...drag.handlers(place)} {...hoverHandlers(place)}>
                {id && !hidden && <span className="unova-pc-party-icon"><MemberIcon spriteId={mons[id].species} /></span>}
              </button>
            )
          })}
          {cursorAt && !drag.dragging && (
            <span className="unova-pc-hand" aria-hidden="true" style={{ left: boxCell(cursorAt.i).x + 6, top: boxCell(cursorAt.i).y - 22 }}>
              {heldId && <span className="unova-pc-held"><MemberIcon spriteId={mons[heldId].species} /></span>}
              <img src={n2b2Ui('pc-mano')} alt="" style={{ left: 0, top: 0 }} />
            </span>
          )}
          {(held || noteText) && (
            <span className="unova-bar-off" style={{ left: 6, top: 132, width: 156, height: 20 }}>
              <span className="unova-text" style={{ left: 2, top: -2 }}>{noteText ?? t.where}</span>
            </span>
          )}
          {menu && menuId && (
            <span className="unova-pc-menu" role="menu" aria-label={itemMenu ? m.itemLabel(mons[menuId].name) : m.label(mons[menuId].name)}
              style={{ left: 164, top: 166 - 12 - menuOptions.length * 16, width: 90, height: 12 + menuOptions.length * 16 }}>
              {menuOptions.map(([text, name, action], i) => (
                <button key={text} type="button" role="menuitem" className="unova-pc-menu-item" style={{ left: 0, top: i * 16, width: 78, height: 16 }}
                  aria-label={name} autoFocus={i === 0} onClick={action} onPointerEnter={(event) => event.currentTarget.focus()}>
                  <span className="unova-text unova-pc-menu-cursor" style={{ left: 0, top: 1 }}>▶</span>
                  <span className="unova-text" style={{ left: 9, top: 1 }}>{text}</span>
                </button>
              ))}
            </span>
          )}
          <span className="unova-pc-bar" />
          {!readOnly && (
            <button type="button" className="unova-bar unova-button" style={{ left: 4, top: 169, width: 122, height: 22 }} aria-label={t.acceptLabel}
              onClick={() => onAccept(lineup(layout))}>
              <span className="unova-text" style={{ left: 6, top: -3 }}>{`▶ ${t.accept}`}</span>
            </button>
          )}
          <button type="button" className="unova-bar-off unova-button" style={{ left: readOnly ? 4 : 130, top: 169, width: readOnly ? 248 : 122, height: 22 }}
            aria-label={readOnly ? t.backToDraft : t.cancelLabel} onClick={onCancel}>
            <span className="unova-text" style={{ left: 4, top: -3 }}>{t.cancel}</span>
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
      )]} />
      {drag.dragging && draggingId && createPortal(
        <div className="team-drag" aria-hidden="true" style={{ left: drag.dragging.x, top: drag.dragging.y, '--k': drag.dragging.scale } as CSSProperties}>
          <span className="unova-pc-held unova-pc-drag-icon"><MemberIcon spriteId={mons[draggingId].species} /></span>
          <img src={n2b2Ui('pc-mano')} alt="" style={{ left: -6, top: -24 }} />
        </div>,
        document.body,
      )}
    </div>
  )
}
