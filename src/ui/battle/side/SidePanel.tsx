import { useState } from 'react'
import type { Boosts } from '../../../battle/fieldState'
import descriptions from '../../../generated/descriptions-es.json'
import { es } from '../../../i18n/es'
import { CategoryIcon } from '../../common/CategoryIcon'
import { TypeBadge } from '../../common/TypeBadge'
import { uiAsset } from '../../common/uiAssets'
import { boostEntries } from '../fieldText'
import { hpFillColor } from '../party/hpBar'
import { MemberIcon } from '../party/MemberIcon'
import { memberHpText, type PartyMember, type PartyMove } from '../party/partyModel'
import { effectivenessTone, moveEffectiveness, statsWithBoosts } from './sideModel'
import './side.css'

const text = es.battle.side
/**
 * Franja de eficacia en la ficha de un movimiento: desactivada (Jose, 05/11/2026). El código se queda (`Effectiveness`, `moveEffectiveness`)
 * por si se vuelve a poner; basta con cambiar esto.
 */
const SHOW_EFFECTIVENESS = false
type Texts = { [id: string]: string | undefined }
const descriptionTable = descriptions as { moves: Texts; abilities: Texts; items: Texts }
/** Color del valor de una estadística según suba (1) o baje (−1). */
const STAGE_TONE: { [sign: number]: 'up' | 'down' | undefined } = { 1: 'up', [-1]: 'down' }

/** Lo pulsado en el panel: un movimiento (por posición), el objeto o la habilidad. */
type Detail = { kind: 'move'; index: number } | { kind: 'item' } | { kind: 'ability' }

function aliveCount(members: PartyMember[]): number {
  let count = 0
  for (const member of members) if (!member.fainted) count += 1
  return count
}

function samePressed(current: Detail | null, detail: Detail): boolean {
  if (!current || current.kind !== detail.kind) return false
  return detail.kind !== 'move' || (current.kind === 'move' && current.index === detail.index)
}

/** Pokémon que se ve y lo pulsado; `forActive` es el que estaba en combate al elegirlo: si sale otro, se vuelve a él (Jose, 05/11/2026). */
type Selection = { forActive: number | null; slot: number | null; detail: Detail | null }

type SidePanelProps = {
  side: 'player' | 'rival'
  title: string
  members: PartyMember[]
  /** Subidas y bajadas del que está en combate en este lado. */
  boosts: Boosts | null
  /** El Pokémon en combate del otro lado: contra él se mide la eficacia. */
  opponent: PartyMember | null
  chart: Record<string, Record<string, number>>
}

/**
 * Panel lateral del combate (RF-44c, DEC-81): Poké Balls de los que quedan en pie, el Pokémon elegido (el que está en combate salvo que se
 * pulse otro de abajo) con PS, estado, estadísticas, objeto, habilidad y movimientos, y los demás con su barra de PS. Debajo, la ficha de
 * lo pulsado (movimiento con su eficacia contra el de enfrente, objeto o habilidad).
 */
export function SidePanel({ side, title, members, boosts, opponent, chart }: SidePanelProps) {
  const activeSlot = members.find((member) => member.active)?.slot ?? null
  const [selection, setSelection] = useState({ forActive: activeSlot, slot: null, detail: null } as Selection)
  // Sale otro al campo: el panel vuelve al que está en combate, sin nada pulsado.
  const current = selection.forActive === activeSlot ? selection : { forActive: activeSlot, slot: null, detail: null }
  const shown = members.find((member) => member.slot === (current.slot ?? activeSlot)) ?? members.find((member) => !member.fainted) ?? members[0]
  if (!shown) return null
  function select(slot: number | null, detail: Detail | null) {
    setSelection({ forActive: activeSlot, slot, detail })
  }
  const alive = aliveCount(members)
  const isPressed = samePressed.bind(null, current.detail)

  return (
    <div className="bt-side" data-side={side}>
      <section className="bt-side-panel" aria-label={text.panelLabel(title)}>
        <div className="bt-side-in">
          <header className="bt-side-head">
            <h2 className="bt-side-title">{title}</h2>
            <span className="bt-side-balls" role="img" aria-label={text.alive(alive, members.length)}>
              {members.map((member) => (
                <span key={member.slot} className="bt-ball-dot" data-fainted={member.fainted || undefined} />
              ))}
            </span>
          </header>
          <MonCard member={shown} boosts={shown.active ? boosts : null} isPressed={isPressed} onDetail={(detail) => select(current.slot, isPressed(detail) ? null : detail)} />
          <ul className="bt-side-bench">
            {members
              .filter((member) => member.slot !== shown.slot)
              .map((member) => (
                <li key={member.slot}>
                  <button type="button" className="bt-side-bench-mon" aria-label={text.showMon(member.name)} data-fainted={member.fainted || undefined} onClick={() => select(member.slot, null)}>
                    <MemberIcon spriteId={member.spriteId} dimmed={member.fainted} />
                    <HpBar percent={member.hpPercent} />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </section>
      <DetailCard member={shown} detail={current.detail} opponent={opponent} chart={chart} />
    </div>
  )
}

function HpBar({ percent }: { percent: number }) {
  return (
    <span className="bt-side-hp" aria-hidden="true">
      <span className="bt-side-hp-fill" data-fill={hpFillColor(percent)} style={{ width: `${percent}%` }} />
    </span>
  )
}

type MonCardProps = {
  member: PartyMember
  boosts: Boosts | null
  isPressed: (detail: Detail) => boolean
  onDetail: (detail: Detail) => void
}

function MonCard({ member, boosts, isPressed, onDetail }: MonCardProps) {
  const summary = es.battle.summary
  const statNames = es.battle.fieldStatus.statsShort as Texts
  const stats = statsWithBoosts(member.stats, boosts)
  const hasStages = stats.some(hasStage)
  return (
    <article className="bt-side-card" aria-label={member.name}>
      <div className="bt-side-id">
        <span className="bt-side-icon">
          <MemberIcon spriteId={member.spriteId} dimmed={member.fainted} />
        </span>
        <div className="bt-side-names">
          <p className="bt-side-name">
            <span>{member.name}</span>
            {member.gender && <img className="bt-side-gender" src={uiAsset(`icons/gender-${member.gender === 'M' ? 'male' : 'female'}.png`)} alt={summary.gender[member.gender]} />}
            <span className="bt-side-level">{es.battle.party.levelLong(member.level)}</span>
          </p>
          <p className="bt-side-types">
            {member.types.map((type) => (
              <TypeBadge key={type.id} typeName={type.id} label={type.label} />
            ))}
          </p>
        </div>
      </div>
      <p className="bt-side-hp-row">
        <HpBar percent={member.hpPercent} />
        {member.status && <img className="bt-side-status" src={uiAsset(`status/${member.status}.png`)} alt={es.battle.status[member.status as keyof typeof es.battle.status] ?? member.status} />}
        {member.fainted && <img className="bt-side-status" src={uiAsset('status/fnt.png')} alt={es.battle.party.fainted} />}
        <span className="bt-side-hp-text">{memberHpText(member)}</span>
      </p>
      <dl className="bt-side-stats" aria-label={text.statsLabel}>
        {stats.map((stat) => (
          <div key={stat.key}>
            <dt>{stat.key === 'hp' ? summary.hp : statNames[stat.key]}</dt>
            <dd>{stat.value}</dd>
            {hasStages && <dd className="bt-side-stage-slot">{stat.stage !== 0 && <StageBadge stage={stat.stage} />}</dd>}
          </div>
        ))}
      </dl>
      {boosts && <OtherStages boosts={boosts} />}
      <dl className="bt-side-facts">
        <dt>{summary.item}</dt>
        <dd>
          <button type="button" className="bt-side-link" aria-label={text.showItem(member.itemName)} aria-pressed={isPressed({ kind: 'item' })} disabled={!member.itemId} onClick={() => onDetail({ kind: 'item' })}>{member.itemName}</button>
        </dd>
        <dt>{summary.ability}</dt>
        <dd>
          <button type="button" className="bt-side-link" aria-label={text.showAbility(member.abilityName)} aria-pressed={isPressed({ kind: 'ability' })} onClick={() => onDetail({ kind: 'ability' })}>{member.abilityName}</button>
        </dd>
      </dl>
      <ul className="bt-side-moves" aria-label={es.battle.movesLabel}>
        {member.moves.map((move, index) => (
          <li key={`${move.id}-${index}`}>
            <button type="button" className="bt-side-move" aria-label={text.showMove(move.name)} aria-pressed={isPressed({ kind: 'move', index })} onClick={() => onDetail({ kind: 'move', index })}>
              {move.typeName && <TypeBadge typeName={move.typeName} label={move.typeLabel ?? move.typeName} />}
              {move.category && <CategoryIcon category={move.category} />}
              <span className="bt-side-move-name">{move.name}</span>
              {move.pp !== null && <span className="bt-side-pp">{es.battle.hpValues(move.pp, move.maxPp ?? move.pp)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </article>
  )
}

/** «^» fina verde al subir y «v» roja al bajar (Jose, 05/11/2026): un chevrón de píxel, sin borde. */
const CARET_UP = 'M3 0h1v1H3zM2 1h1v1H2zM4 1h1v1H4zM1 2h1v1H1zM5 2h1v1H5zM0 3h1v1H0zM6 3h1v1H6z'
const CARET_DOWN = 'M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h1v1H2zM4 2h1v1H4zM3 3h1v1H3z'

function Caret({ up }: { up: boolean }) {
  return (
    <svg className="bt-side-caret" viewBox="0 0 7 4" width="11" height="6" aria-hidden="true" shapeRendering="crispEdges">
      <path d={up ? CARET_UP : CARET_DOWN} fill="currentColor" />
    </svg>
  )
}

/** Bajo la estadística: el «^» o la «v» y, con más de un nivel, el número. El texto, para lectores de pantalla. */
function StageBadge({ stage }: { stage: number }) {
  const levels = Math.abs(stage)
  return (
    <span className="bt-side-stage" data-dir={STAGE_TONE[Math.sign(stage)]}>
      <Caret up={stage > 0} />
      {levels > 1 && <span aria-hidden="true">{levels}</span>}
      <span className="sr-only">{es.battle.fieldStatus.boost('', stage)}</span>
    </span>
  )
}

/** Precisión y Evasión no tienen casilla: si cambian, van en una línea con lo mismo. */
function OtherStages({ boosts }: { boosts: Boosts }) {
  const labels = es.battle.fieldStatus.statsLong
  const entries = boostEntries({ boosts, effects: [] }).filter(isOtherStage)
  if (entries.length === 0) return null
  return (
    <ul className="bt-side-boosts" aria-label={text.boostsLabel}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <span>{labels[entry.id]}</span>
          <StageBadge stage={entry.amount} />
        </li>
      ))}
    </ul>
  )
}

function hasStage(stat: { stage: number }): boolean {
  return stat.stage !== 0
}

function isOtherStage(entry: { id: string }): boolean {
  return entry.id === 'accuracy' || entry.id === 'evasion'
}

type DetailCardProps = {
  member: PartyMember
  detail: Detail | null
  opponent: PartyMember | null
  chart: Record<string, Record<string, number>>
}

function DetailCard({ member, detail, opponent, chart }: DetailCardProps) {
  if (!detail) return <p className="bt-side-hint">{text.hint}</p>
  if (detail.kind !== 'move') {
    const name = detail.kind === 'item' ? member.itemName : member.abilityName
    const body = detail.kind === 'item' ? descriptionTable.items[member.itemId] : descriptionTable.abilities[member.abilityId]
    return (
      <section className="bt-side-info" aria-live="polite">
        <header className="bt-side-info-head">
          <span className="bt-side-kind">{text.kinds[detail.kind]}</span>
          <h3>{name}</h3>
        </header>
        <p>{body ?? text.noDescription}</p>
      </section>
    )
  }
  const move = member.moves[detail.index]
  if (!move) return null
  return (
    <section className="bt-side-info" aria-live="polite">
      <header className="bt-side-info-head">
        <h3>{move.name}</h3>
        {move.typeName && <TypeBadge typeName={move.typeName} label={move.typeLabel ?? move.typeName} />}
      </header>
      <MoveFacts move={move} />
      <p>{descriptionTable.moves[move.id] ?? text.noDescription}</p>
      {SHOW_EFFECTIVENESS && opponent && <Effectiveness move={move} attacker={member} opponent={opponent} chart={chart} />}
    </section>
  )
}

function MoveFacts({ move }: { move: PartyMove }) {
  const summary = es.battle.summary
  return (
    <dl className="bt-side-move-facts">
      <div>
        <dt>{summary.category}</dt>
        <dd>
          {move.category && <CategoryIcon category={move.category} />}
          {move.categoryLabel}
        </dd>
      </div>
      <div>
        <dt>{summary.power}</dt>
        <dd>{move.power}</dd>
      </div>
      <div>
        <dt>{summary.accuracy}</dt>
        <dd>{move.accuracy}</dd>
      </div>
      <div>
        <dt>{summary.pp}</dt>
        <dd>{move.maxPp ?? es.today.notApplicable}</dd>
      </div>
    </dl>
  )
}

/** Franja de eficacia con el icono del de enfrente (opción 3 de las maquetas, Jose 05/11/2026). */
function Effectiveness({ move, attacker, opponent, chart }: { move: PartyMove; attacker: PartyMember; opponent: PartyMember; chart: Record<string, Record<string, number>> }) {
  const multiplier = moveEffectiveness(move, opponent, attacker.abilityId, chart)
  if (multiplier === null) return null
  const tone = effectivenessTone(multiplier)
  return (
    <p className="bt-side-eff" data-tone={tone}>
      <span className="bt-side-eff-icon">
        <MemberIcon spriteId={opponent.spriteId} />
      </span>
      <span className="bt-side-eff-text">{text.against(text.effectiveness[tone], opponent.name, tone === 'x0')}</span>
      <span className="bt-side-eff-mult">{text.multipliers[tone]}</span>
    </p>
  )
}
