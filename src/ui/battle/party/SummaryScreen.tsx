import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { GameData } from '../../../core/types'
import { es } from '../../../i18n/es'
import { CategoryIcon } from '../../common/CategoryIcon'
import { Sprite } from '../../common/Sprite'
import { speciesSprite } from '../../common/spriteUrls'
import { TypeBadge } from '../../common/TypeBadge'
import { uiAsset } from '../../common/uiAssets'
import type { PartyMember } from './partyModel'
import { BANDS, infoLine, infoRow, moveDetailRow, statRow, topInBand, type Band } from './summaryLayout'
import { abilityDescription, dexNumberText, frontSpriteSize, hpBar, moveDescription, natureEffectText, SKILL_STAT_KEYS } from './summaryModel'
import './summary.css'

type Page = 0 | 1 | 2
const PAGE_COUNT = 3
const text = es.battle.summary

/** Primer plano del Pokémon de la pantalla de datos: el GIF de frente, anclado por los pies sobre la banda del fondo. */
const SPRITE_FEET = { x: 208, y: 312 }
const SPRITE_FALLBACK = 80
/** Las dos pantallas (arriba y abajo) de las páginas: la de movimientos reutiliza la inferior de habilidades, como el juego. */
const BACKGROUNDS: Record<Page, { top: string; bottom: string }> = {
  0: { top: 'summary/info-top.png', bottom: 'summary/info-bottom.png' },
  1: { top: 'summary/skills-top.png', bottom: 'summary/skills-bottom.png' },
  2: { top: 'summary/moves-top.png', bottom: 'summary/skills-bottom.png' },
}
const MOVE_SLOT_TOP = [207, 239, 271, 303] as const

type Placed = { x: number; y: number }
const at = ({ x, y }: Placed): CSSProperties => ({ left: x, top: y })

const bandAttribute = (band: Band): string => `${band[0]},${band[1]}`

function Label({ children, x, band, plain = false }: { children: ReactNode; x: number; band: Band; plain?: boolean }) {
  return (
    <span className="bt-sum-label" data-plain={plain ? 'true' : undefined} data-band={bandAttribute(band)} data-size="normal" style={at({ x, y: topInBand(band) })}>
      {children}
    </span>
  )
}

type ValueSize = 'normal' | 'small' | 'tiny'

/** Tamaño según lo largo del texto: la fuente baja solo cuando no cabe, como último recurso antes de la elipsis (`maxWidth`). */
const sizeFor = (text: string, smallFrom: number, tinyFrom: number): ValueSize => (text.length > tinyFrom ? 'tiny' : text.length > smallFrom ? 'small' : 'normal')

function Value({ children, x, band, right = false, size = 'normal', maxWidth }: { children: ReactNode; x: number; band: Band; right?: boolean; size?: ValueSize; maxWidth?: number }) {
  const y = topInBand(band, size)
  const position: CSSProperties = right ? { right: 256 - x, top: y } : at({ x, y })
  const style: CSSProperties = maxWidth === undefined ? position : { ...position, maxWidth }
  return (
    <span className="bt-sum-value" data-small={size === 'normal' ? undefined : size === 'small' ? 'true' : 'tiny'} data-band={bandAttribute(band)} data-size={size} data-max={maxWidth === undefined ? undefined : 'true'} data-align={right ? 'right' : undefined} style={style}>
      {children}
    </span>
  )
}

function HpBar({ member, x, y }: { member: PartyMember; x: number; y: number }) {
  const bar = hpBar(member, 48)
  return (
    <>
      <img className="bt-sum-bar" style={at({ x, y })} src={uiAsset('party/hp-track.png')} alt="" />
      <span className="bt-party-fill" data-fill={bar.color} style={{ left: x + 14, top: y + 2, width: bar.width }} />
    </>
  )
}

function FrontSprite({ member, data }: { member: PartyMember; data: GameData }) {
  const spriteId = data.dex.species[member.speciesId]?.spriteId ?? member.speciesId
  const { width, height } = frontSpriteSize(spriteId, SPRITE_FALLBACK)
  return (
    <span className="bt-sum-sprite" style={{ left: SPRITE_FEET.x - width / 2, top: SPRITE_FEET.y - height, width, height }}>
      <Sprite src={speciesSprite(data.dex, member.speciesId, 'front')} name={member.name} width={width} height={height} className="bt-sum-sprite-img" />
    </span>
  )
}

function SharedBottom({ member, data }: { member: PartyMember; data: GameData }) {
  const status = member.fainted ? 'fnt' : member.status
  return (
    <>
      <Value x={163} band={BANDS.monName} maxWidth={76}>{member.name}</Value>
      {member.gender && <img className="bt-sum-gender" style={at({ x: 241, y: 197 })} src={uiAsset(`icons/gender-${member.gender === 'M' ? 'male' : 'female'}.png`)} alt="" />}
      <Value x={161} band={BANDS.monLevel}>{es.battle.party.levelLong(member.level)}</Value>
      {status && <img className="bt-sum-status" style={at({ x: 212, y: 214 })} src={uiAsset(`status/${status}.png`)} alt="" />}
      <FrontSprite member={member} data={data} />
      {member.gender && <span className="sr-only">{text.gender[member.gender]}</span>}
      <Label x={167} band={BANDS.itemLabel}>{text.item}</Label>
      <Value x={158} band={BANDS.itemValue} size={sizeFor(member.itemName, 13, 18)} maxWidth={96}>{member.itemName}</Value>
    </>
  )
}

function InfoPage({ member }: { member: PartyMember }) {
  return (
    <>
      <Value x={33} band={infoLine(0)} maxWidth={200}>
        {text.natureLead}
        {' '}
        <span className="bt-sum-blue">{member.natureName}</span>
        .
      </Value>
      <Value x={33} band={infoLine(1)} maxWidth={200}>{natureEffectText(member)}</Value>
      <Label x={17} band={infoRow(0)}>{text.dexNumber}</Label>
      <Value x={81} band={infoRow(0)} maxWidth={60}>{dexNumberText(member.speciesId)}</Value>
      <Label x={17} band={infoRow(1)}>{text.name}</Label>
      <Value x={81} band={infoRow(1)} maxWidth={100}>{member.name}</Value>
      <Label x={17} band={infoRow(2)}>{text.types}</Label>
      <span className="bt-sum-types" style={at({ x: 81, y: 233 })}>
        {member.types.map((type) => (
          <TypeBadge key={type.id} typeName={type.id} label={type.label} compact />
        ))}
      </span>
      <Label x={17} band={infoRow(3)}>{text.level}</Label>
      <Value x={81} band={infoRow(3)} maxWidth={60}>{member.level}</Value>
      <Label x={17} band={infoRow(4)}>{text.ability}</Label>
      <Value x={81} band={infoRow(4)} size={sizeFor(member.abilityName, 13, 19)} maxWidth={109}>{member.abilityName}</Value>
      <Label x={17} band={BANDS.natureLabel}>{text.nature}</Label>
      <Value x={81} band={BANDS.natureValue} maxWidth={90}>{member.natureName}</Value>
      <Label x={17} band={BANDS.hpLabel}>{text.hp}</Label>
      <Value x={81} band={BANDS.hpValue} maxWidth={90}>{es.battle.hpValues(member.hp, member.maxHp)}</Value>
    </>
  )
}

function SkillsPage({ member }: { member: PartyMember }) {
  const description = abilityDescription(member.abilityId)
  return (
    <>
      <Label x={89} band={BANDS.hpRow}>{es.today.statNames.hp}</Label>
      <Value x={186} band={BANDS.hpRow} right>{`${member.hp} / ${member.maxHp}`}</Value>
      <HpBar member={member} x={121} y={49} />
      {SKILL_STAT_KEYS.map((key, index) => {
        const tone = member.natureUp === key ? 'up' : member.natureDown === key ? 'down' : undefined
        return (
          <span key={key}>
            <Label x={65} band={statRow(index)}>
              <span className="bt-sum-stat" data-tone={tone}>{es.today.statNames[key]}</span>
              {tone && <span className="sr-only">{tone === 'up' ? text.statUp : text.statDown}</span>}
            </Label>
            <Value x={168} band={statRow(index)} right>{member.stats[key]}</Value>
          </span>
        )
      })}
      <Label x={50} band={BANDS.abilityBar} plain>{text.ability}</Label>
      <Value x={114} band={BANDS.abilityBar} size={sizeFor(member.abilityName, 9, 15)} maxWidth={90}>{member.abilityName}</Value>
      {description && (
        <div className="bt-sum-text-box bt-sum-ability-box" style={at({ x: 50, y: 160 })}>
          <p className="bt-sum-description bt-sum-ability-text">{description}</p>
        </div>
      )}
    </>
  )
}

function MovesTopPage({ member, moveIndex, data }: { member: PartyMember; moveIndex: number; data: GameData }) {
  const move = member.moves[moveIndex]
  const description = moveDescription(move.id)
  const dexMove = data.dex.moves[move.id]
  return (
    <>
      <Label x={80} band={moveDetailRow(0)}>{text.category}</Label>
      <span className="bt-sum-category" style={at({ x: 156, y: 48 })}>
        {move.category && <CategoryIcon category={move.category} />}
        <span className="sr-only">{move.categoryLabel}</span>
      </span>
      <Label x={80} band={moveDetailRow(1)}>{text.power}</Label>
      <Value x={178} band={moveDetailRow(1)} right>{move.power}</Value>
      <Label x={80} band={moveDetailRow(2)}>{text.accuracy}</Label>
      <Value x={178} band={moveDetailRow(2)} right>{move.accuracy}</Value>
      {description && (
        <div className="bt-sum-text-box bt-sum-move-box" style={at({ x: 8, y: 104 })}>
          <p className="bt-sum-description bt-sum-move-text">{description}</p>
        </div>
      )}
      {dexMove && <span className="sr-only">{move.name}</span>}
    </>
  )
}

function MoveSlots({ member, page, moveIndex, onPick }: { member: PartyMember; page: Page; moveIndex: number; onPick: (index: number) => void }) {
  return (
    <div className="bt-sum-moves" role="group" aria-label={es.battle.movesLabel}>
      {member.moves.map((move, index) => {
        const top = MOVE_SLOT_TOP[index]
        const selected = page === 2 && index === moveIndex
        return (
          <button
            key={`${move.id}-${index}`}
            type="button"
            className="bt-sum-slot"
            style={{ top }}
            aria-pressed={page === 2 ? selected : undefined}
            aria-label={text.selectMove(move.name)}
            onClick={() => onPick(index)}
          >
            {selected && (
              <svg className="bt-sum-slot-highlight" viewBox="0 0 136 34" aria-hidden="true" shapeRendering="crispEdges">
                <polygon points="12,1 124,1 134,17 124,33 12,33 2,17" fill="#215a63" stroke="#18cead" strokeWidth="1" />
              </svg>
            )}
            <span className="bt-sum-slot-visual" aria-hidden="true">
              {move.typeName && move.typeLabel && (
                <span className="bt-sum-slot-type">
                  <TypeBadge typeName={move.typeName} label={move.typeLabel} compact />
                </span>
              )}
              <span className="bt-sum-slot-name" data-size={sizeFor(move.name, 11, 15) === 'normal' ? undefined : sizeFor(move.name, 11, 15)}>{move.name}</span>
              <span className="bt-sum-slot-pp">{text.pp}</span>
              <span className="bt-sum-slot-pp-value">{move.pp !== null && move.maxPp !== null ? es.battle.hpValues(move.pp, move.maxPp) : '--'}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

type SummaryScreenProps = {
  members: PartyMember[]
  initialSlot: number
  data: GameData
  onClose: () => void
}

/**
 * Pantalla de datos del Pokémon (como el "Resumen" de N2/B2) con tres páginas: Información, Habilidades y estadísticas, y Movimientos
 * (detalle del movimiento elegido). El fondo es la captura de Negro/Blanco limpiada por script; todo lo demás se pinta en ejecución con datos reales.
 * Teclado: ← → cambian de página, ↑ ↓ de Pokémon, Escape vuelve.
 */
export default function SummaryScreen({ members, initialSlot, data, onClose }: SummaryScreenProps) {
  const [slot, setSlot] = useState(initialSlot)
  const [page, setPage] = useState(0 as Page)
  const [moveIndex, setMoveIndex] = useState(0)
  const rootRef = useRef(null as HTMLElement | null)

  const position = Math.max(0, members.findIndex((member) => member.slot === slot))
  const member = members[position]

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  const goToPage = (next: number) => setPage(Math.min(PAGE_COUNT - 1, Math.max(0, next)) as Page)
  const goToMember = (offset: number) => {
    setSlot(members[(position + offset + members.length) % members.length].slot)
    setMoveIndex(0)
  }
  const back = () => (page === 2 ? setPage(1) : onClose())

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const handlers: Record<string, () => void> = {
        ArrowLeft: () => goToPage(page - 1),
        ArrowRight: () => goToPage(page + 1),
        ArrowUp: () => goToMember(-1),
        ArrowDown: () => goToMember(1),
        Escape: back,
      }
      const handler = handlers[event.key]
      if (!handler || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select'))) return
      event.preventDefault()
      event.stopPropagation()
      handler()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  })

  const pickMove = (index: number) => {
    setMoveIndex(index)
    setPage(2)
  }

  const backgrounds = BACKGROUNDS[page]

  return (
    <section ref={rootRef} tabIndex={-1} className="bt-summary" aria-label={text.label(member.name)} data-page={page}>
      <img className="bt-sum-bg" style={{ top: 0 }} src={uiAsset(backgrounds.top)} alt="" />
      <img className="bt-sum-bg" style={{ top: 192 }} src={uiAsset(backgrounds.bottom)} alt="" />
      <h2 className="sr-only">{text.pageTitles[['info', 'skills', 'moves'][page] as 'info' | 'skills' | 'moves']}</h2>

      <span className="bt-sum-heading" aria-hidden="true" data-band={bandAttribute(BANDS.header)} data-size="head" style={{ top: topInBand(BANDS.header, 'head') }}>{text.heading}</span>
      <div className="bt-sum-pager" style={{ top: topInBand(BANDS.header, 'head') }}>
        <button type="button" className="bt-sum-hit bt-sum-prev-page" disabled={page === 0} onClick={() => goToPage(page - 1)} aria-label={text.previousPage}>
          <span aria-hidden="true">«</span>
        </button>
        <span className="bt-sum-page-title" aria-live="polite" data-band={bandAttribute(BANDS.header)} data-size="head">{text.pageNames[page]}</span>
        <button type="button" className="bt-sum-hit bt-sum-next-page" disabled={page === PAGE_COUNT - 1} onClick={() => goToPage(page + 1)} aria-label={text.nextPage}>
          <span aria-hidden="true">»</span>
        </button>
      </div>
      <span className="sr-only">{text.pageCounter(page + 1, PAGE_COUNT)}</span>

      {page === 0 && <InfoPage member={member} />}
      {page === 1 && <SkillsPage member={member} />}
      {page === 2 && <MovesTopPage member={member} moveIndex={moveIndex} data={data} />}
      {page !== 0 && <MoveSlots member={member} page={page} moveIndex={moveIndex} onPick={pickMove} />}
      <SharedBottom member={member} data={data} />

      <button type="button" className="bt-sum-hit bt-sum-tab-info" aria-pressed={page === 0} onClick={() => goToPage(0)} aria-label={text.pageNames[0]} />
      <button type="button" className="bt-sum-hit bt-sum-tab-skills" aria-pressed={page !== 0} onClick={() => goToPage(1)} aria-label={text.pageNames[1]} />
      {members.length > 1 && (
        <>
          <button type="button" className="bt-sum-hit bt-sum-prev-mon" onClick={() => goToMember(-1)} aria-label={text.previousMon} />
          <button type="button" className="bt-sum-hit bt-sum-next-mon" onClick={() => goToMember(1)} aria-label={text.nextMon} />
        </>
      )}
      <button type="button" className="bt-sum-hit bt-sum-close" onClick={onClose} aria-label={text.close} />
      <button type="button" className="bt-sum-hit bt-sum-back" onClick={back} aria-label={text.back} />
    </section>
  )
}
