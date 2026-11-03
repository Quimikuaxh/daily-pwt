import { useLayoutEffect, useRef, useState } from 'react'
import type { BattleView } from '../../battle/protocol'
import { emptyActive, type ActiveState, type FieldEffect } from '../../battle/fieldState'
import type { NamesEs } from '../../core/types'
import { es } from '../../i18n/es'
import { uiAsset } from './introAssets'
import { boostEntries, cardNote, COMPACT_ARROWS, effectLabel, isCompact, rowNote } from './fieldText'

const text = es.battle.fieldStatus
const WEATHER_LABELS: { [id: string]: string | undefined } = es.battle.weather
const weatherLabel = (weather: string): string => WEATHER_LABELS[weather] ?? es.battle.weatherUnknown

/** Reloj en píxel: los turnos que le quedan a algo. */
export function Clock({ className = 'bt-clock' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 7 7" width="7" height="7" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M2 0h3v1H2zM1 1h1v1H1zM3 1h1v1H3zM5 1h1v1H5zM0 2h1v1H0zM3 2h1v1H3zM6 2h1v1H6zM0 3h1v1H0zM3 3h2v1H3zM6 3h1v1H6zM0 4h1v1H0zM6 4h1v1H6zM1 5h1v1H1zM5 5h1v1H5zM2 6h3v1H2z" fill="currentColor" />
    </svg>
  )
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg className={`bt-arrow ${up ? 'bt-arrow-up' : 'bt-arrow-down'}`} viewBox="0 0 7 5" width="7" height="5" aria-hidden="true" shapeRendering="crispEdges">
      <path d={up ? 'M3 0h1v1H3zM2 1h3v1H2zM1 2h5v1H1zM0 3h7v1H0zM2 4h3v1H2z' : 'M2 0h3v1H2zM0 1h7v1H0zM1 2h5v1H1zM2 3h3v1H2zM3 4h1v1H3z'} fill="currentColor" />
    </svg>
  )
}

type PillProps = { weather: string | null; weatherTurns: number | null; enabled: boolean; onOpen: () => void }

/**
 * Pastilla de arriba de la pantalla táctil (RF-44b): con clima, su color, su nombre y sus turnos, como antes; sin él, gris clarito con
 * «Estado». Al pulsarla se abre la pantalla «Estado».
 */
export function FieldPill({ weather, weatherTurns, enabled, onOpen }: PillProps) {
  return (
    <button type="button" data-testid="weather" className="bt-touch-weather" data-weather={weather ?? 'none'} disabled={!enabled} onClick={onOpen}>
      <span className="bt-touch-weather-shape" aria-hidden="true" />
      <span className="bt-touch-weather-label">
        <span>{weather ? weatherLabel(weather) : text.pill}</span>
        {weather && weatherTurns ? (
          <>
            <span className="bt-touch-weather-sep" aria-hidden="true">·</span>
            <Clock className="bt-touch-weather-clock" />
            <span aria-hidden="true">{weatherTurns}</span>
            <span className="sr-only">{es.battle.weatherTurnsLeft(weatherTurns)}</span>
          </>
        ) : null}
        <span className="sr-only">{`. ${text.open}`}</span>
      </span>
    </button>
  )
}

type PanelProps = {
  view: BattleView
  names: NamesEs
  /** Texto para la caja de mensajes al pulsar una ficha o una franja. */
  onNote: (note: string) => void
  onBack: () => void
}

/** Pantalla «Estado» (RF-44b, DEC-78), en la pantalla táctil: una ficha por Pokémon en combate y las franjas del campo y de cada lado. */
export function FieldPanel({ view, names, onNote, onBack }: PanelProps) {
  const field = view.field
  const nameOf = (side: 'player' | 'rival') => {
    const sideView = view[side]
    const mon = sideView.active === null ? undefined : sideView.team[sideView.active]
    return mon && !mon.fainted ? (names.species[mon.species] ?? mon.species) : text.noActive
  }
  return (
    <div className="bt-status" role="region" aria-label={text.title}>
      {(['player', 'rival'] as const).map((side) => (
        <MonCard key={side} side={side} name={nameOf(side)} active={field?.[side === 'player' ? 'playerActive' : 'rivalActive'] ?? emptyActive()} names={names} onNote={onNote} />
      ))}
      <div className="bt-status-rows">
        {(['field', 'player', 'rival'] as const).map((row) => (
          <FieldRow key={row} kind={row} effects={field?.[row] ?? []} names={names} onNote={onNote} />
        ))}
      </div>
      <button type="button" className="bt-back" onClick={onBack}>
        <img src={uiAsset('touch/back.png')} alt="" />
        <span className="sr-only">{es.battle.back}</span>
      </button>
    </div>
  )
}

function Arrows({ amount, compact }: { amount: number; compact: boolean }) {
  const count = Math.abs(amount)
  if (compact && count > COMPACT_ARROWS) {
    return (
      <span className="bt-status-arrows" aria-hidden="true">
        <Arrow up={amount > 0} />
        <span className="bt-status-count">{count}</span>
      </span>
    )
  }
  return (
    <span className="bt-status-arrows" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <Arrow key={index} up={amount > 0} />)}
    </span>
  )
}

function EffectTurns({ effect }: { effect: FieldEffect }) {
  return effect.turns === null ? null : (
    <span className="bt-status-turns">
      <Clock />
      {effect.turns}
    </span>
  )
}

function MonCard({ side, name, active, names, onNote }: { side: 'player' | 'rival'; name: string; active: ActiveState; names: NamesEs; onNote: (note: string) => void }) {
  const compact = isCompact(active)
  const boosts = boostEntries(active)
  const labels = compact ? text.statsShort : text.statsLong
  const empty = boosts.length === 0 && active.effects.length === 0
  return (
    <button
      type="button"
      className={`bt-status-card bt-status-${side}${compact ? ' bt-status-compact' : ''}`}
      aria-label={text.cardAria(name, side)}
      onClick={() => onNote(cardNote(name, active, names))}
    >
      <span className="bt-status-shape" aria-hidden="true" />
      <span className="bt-status-name">{name}</span>
      <span className="bt-status-lines">
        {empty && <span className="bt-status-line bt-status-empty">{text.noChanges}</span>}
        <span className={compact ? 'bt-status-grid' : 'bt-status-list'}>
          {boosts.map((entry) => (
            <span key={entry.id} className="bt-status-line">
              <span>{labels[entry.id]}</span>
              <Arrows amount={entry.amount} compact={compact} />
              <span className="sr-only">{text.boost('', entry.amount)}</span>
            </span>
          ))}
        </span>
        {compact
          ? active.effects.length > 0 && <span className="bt-status-line bt-status-effects">{active.effects.map((effect) => effectLabel(effect, names)).join(' · ')}</span>
          : active.effects.map((effect) => (
              <span key={effect.id} className="bt-status-line bt-status-effect">
                <span>{effectLabel(effect, names)}</span>
                <EffectTurns effect={effect} />
              </span>
            ))}
      </span>
    </button>
  )
}

/**
 * Una franja (CAMPO, TÚ, RIVAL): los efectos que caben enteros y «y N más» con los que no (RF-44b; nunca uno cortado a medias). Se mide
 * una copia invisible con todos; sin medidas (jsdom), caben todos.
 */
function FieldRow({ kind, effects, names, onNote }: { kind: 'field' | 'player' | 'rival'; effects: FieldEffect[]; names: NamesEs; onNote: (note: string) => void }) {
  const measure = useRef(null as HTMLSpanElement | null)
  const key = effects.map((effect) => `${effect.id}:${effect.turns}:${effect.layers ?? ''}`).join('|')
  const [fit, setFit] = useState({ key: '', count: effects.length })
  const count = fit.key === key ? fit.count : effects.length

  useLayoutEffect(() => {
    const box = measure.current
    if (!box) return
    const update = () => {
      const available = box.parentElement?.clientWidth ?? 0
      const items = [...box.querySelectorAll('.bt-status-item')] as HTMLElement[]
      const more = box.querySelector('.bt-status-more') as HTMLElement | null
      let visible = items.length
      if (available > 0 && items.length > 0) {
        const end = (index: number) => items[index].offsetLeft + items[index].offsetWidth
        if (end(items.length - 1) > available) {
          const moreWidth = more?.offsetWidth ?? 0
          visible = 0
          while (visible < items.length - 1 && end(visible) + moreWidth <= available) visible += 1
        }
      }
      setFit((current) => (current.key === key && current.count === visible ? current : { key, count: visible }))
    }
    update()
    // La fuente del juego puede llegar después de pintar: al cambiar de tamaño la copia, se vuelve a medir.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(box)
    return () => observer.disconnect()
  }, [key])

  const name = text.rowNames[kind]
  const shown = effects.slice(0, count)
  const hidden = effects.length - shown.length
  const item = (effect: FieldEffect, index: number) => {
    return <RowItem key={effect.id} effect={effect} first={index === 0} names={names} />
  }
  return (
    <button type="button" className={`bt-status-row bt-status-row-${kind}`} aria-label={text.rowAria(name)} onClick={() => onNote(rowNote(name, effects, names))}>
      <span className="bt-status-tag" aria-hidden="true">{text.rowTags[kind]}</span>
      <span className="bt-status-text">
        {effects.length === 0 ? <span className="bt-status-empty">{text.nothing}</span> : shown.map(item)}
        {hidden > 0 && (
          <span className="bt-status-item bt-status-more">
            {shown.length > 0 && <span className="bt-status-sep" aria-hidden="true">·</span>}
            {text.more(hidden)}
          </span>
        )}
        <span ref={measure} className="bt-status-measure" aria-hidden="true">
          {effects.map(item)}
          <span className="bt-status-more">
            <span className="bt-status-sep">·</span>
            {text.more(effects.length)}
          </span>
        </span>
      </span>
    </button>
  )
}

function RowItem({ effect, first, names }: { effect: FieldEffect; first: boolean; names: NamesEs }) {
  return (
    <span className="bt-status-item">
      {!first && <span className="bt-status-sep" aria-hidden="true">·</span>}
      <span>{effectLabel(effect, names)}</span>
      <EffectTurns effect={effect} />
    </span>
  )
}
