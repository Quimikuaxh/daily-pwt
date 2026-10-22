import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { GameData } from '../../../core/types'
import { es } from '../../../i18n/es'
import { uiAsset } from '../../common/uiAssets'
import { MemberIcon } from './MemberIcon'
import { PANEL, PANEL_BANDS, PANEL_HEIGHT, PANEL_WIDTH, panelPosition } from './layout'
import { memberStateLabel, type PartyMember } from './partyModel'
import { hpBar } from './hpBar'
import './party.css'
import { SUMMARY_SCREEN_IMAGES, useImagesReady } from '../preloadAssets'

const SummaryScreen = lazy(() => import('./SummaryScreen'))


type PartyScreenProps = {
  members: PartyMember[]
  data: GameData
  /** Cambio forzado tras un KO (RF-49): no se puede cancelar. */
  forced: boolean
  /** Los controles solo actúan cuando el turno está abierto (no durante animaciones ni el turno rival). */
  enabled: boolean
  onChoose: (slot: number) => void
  onClose: () => void
}

type PanelColor = 'blue' | 'red' | 'green'

function panelAsset(member: PartyMember, selected: boolean, side: 'left' | 'right'): string {
  const color: PanelColor = member.fainted ? 'red' : selected ? 'green' : 'blue'
  const lit = selected || member.active
  return uiAsset(`party/panel-${color}-${side}${lit ? '-lit' : ''}.png`)
}

function PartyPanel({ member, index, selected, enabled, onSelect, buttonRef }: { member: PartyMember; index: number; selected: boolean; enabled: boolean; onSelect: () => void; buttonRef: (element: HTMLButtonElement | null) => void }) {
  const position = panelPosition(index)
  const bar = hpBar(member, PANEL.barFill.width)
  const stateLabel = memberStateLabel(member)
  const style = {
    left: position.x,
    top: position.y,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    backgroundImage: `url(${panelAsset(member, selected, position.side)})`,
  } as CSSProperties
  const statusIcon = member.fainted ? 'fnt' : member.status

  return (
    <button
      ref={buttonRef}
      type="button"
      className="bt-party-panel"
      style={style}
      data-state={member.fainted ? 'fainted' : member.active ? 'active' : 'ready'}
      data-selected={selected ? 'true' : undefined}
      disabled={!enabled}
      aria-haspopup="true"
      aria-expanded={selected}
      aria-label={es.battle.party.memberAria(member.name, es.battle.party.levelShort(member.level), es.battle.hpValues(member.hp, member.maxHp), stateLabel)}
      onClick={onSelect}
    >
      <span className="bt-party-visual" aria-hidden="true">
        <span className="bt-party-icon" style={{ left: PANEL.icon.x, top: PANEL.icon.y }}>
          <MemberIcon spriteId={member.spriteId} dimmed={member.fainted} />
        </span>
        <span className="bt-party-name" data-band={PANEL_BANDS.name.join(',')} data-size="normal" style={{ left: PANEL.name.x, top: PANEL.name.y }}>{member.name}</span>
        {' '}
        {member.gender && <img className="bt-party-gender" style={{ left: PANEL.gender.x, top: PANEL.gender.y }} src={uiAsset(`icons/gender-${member.gender === 'M' ? 'male' : 'female'}.png`)} alt="" />}
        <img className="bt-party-bar" style={{ left: PANEL.bar.x, top: PANEL.bar.y }} src={uiAsset('party/hp-track.png')} alt="" />
        <span className="bt-party-fill" data-fill={bar.color} style={{ left: PANEL.barFill.x, top: PANEL.barFill.y, width: bar.width }} />
        <span className="bt-party-level" data-band={PANEL_BANDS.bottomRow.join(',')} data-size="normal" style={{ left: PANEL.level.x, top: PANEL.level.y }}>{es.battle.party.levelShort(member.level)}</span>
        {' '}
        {statusIcon && <img className="bt-party-status" style={{ left: PANEL.status.x, top: PANEL.status.y + 2 }} src={uiAsset(`status/${statusIcon}.png`)} alt="" />}
        <span className="bt-party-hp" data-band={PANEL_BANDS.bottomRow.join(',')} data-size="normal" style={{ right: PANEL_WIDTH - 106, top: PANEL.hp.y }}>{es.battle.hpValues(member.hp, member.maxHp)}</span>
      </span>
    </button>
  )
}

function whyCannotSwitch(member: PartyMember): string | null {
  if (member.fainted) return es.battle.party.reasonFainted
  if (member.active) return es.battle.party.reasonActive
  return null
}

/**
 * Pantalla de equipo del combate (ocupa las dos pantallas, como en el juego): cuadrícula de 6 placas y, al elegir una,
 * el menú Cambiar / Datos / Cancelar. Datos abre la pantalla de datos del Pokémon. En el cambio forzado no hay Cancelar ni Volver.
 */
export function PartyScreen({ members, data, forced, enabled, onChoose, onClose }: PartyScreenProps) {
  const [selectedSlot, setSelectedSlot] = useState(null as number | null)
  const [summarySlot, setSummarySlot] = useState(null as number | null)
  const summaryReady = useImagesReady(SUMMARY_SCREEN_IMAGES, summarySlot !== null)
  const panelRefs = useRef(new Map<number, HTMLButtonElement>())
  const switchRef = useRef(null as HTMLButtonElement | null)
  const summaryReturnSlot = useRef(null as number | null)

  const selected = members.find((member) => member.slot === selectedSlot) ?? null
  const blockedReason = selected ? whyCannotSwitch(selected) : null

  useEffect(() => {
    if (selected) switchRef.current?.focus()
  }, [selected])

  useEffect(() => {
    if (selected || summarySlot !== null) return
    const returned = summaryReturnSlot.current
    if (returned !== null) {
      summaryReturnSlot.current = null
      panelRefs.current.get(returned)?.focus()
    }
  }, [selected, summarySlot])

  useEffect(() => {
    if (summarySlot !== null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (selectedSlot !== null) closeOptions()
      else if (!forced) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  function closeOptions() {
    const slot = selectedSlot
    setSelectedSlot(null)
    if (slot !== null) requestAnimationFrame(() => panelRefs.current.get(slot)?.focus())
  }

  function openSummary(slot: number) {
    summaryReturnSlot.current = slot
    setSelectedSlot(null)
    setSummarySlot(slot)
  }

  const prompt = forced ? es.battle.party.forcedPrompt : es.battle.party.choosePrompt

  return (
    <section className="bt-party" aria-label={es.battle.party.label}>
      <img className="bt-party-bg bt-party-bg-top" src={uiAsset('party/bg-top.png')} alt="" />
      <img className="bt-party-bg bt-party-bg-bottom" src={uiAsset('party/bg-bottom.png')} alt="" />
      <div className="bt-party-members" role="group" aria-label={es.battle.party.label} inert={selected !== null || summarySlot !== null ? true : undefined}>
        {members.map((member, index) => (
          <PartyPanel
            key={member.slot}
            member={member}
            index={index}
            selected={member.slot === selectedSlot}
            enabled={enabled}
            onSelect={() => setSelectedSlot(member.slot)}
            buttonRef={(element) => {
              if (element) panelRefs.current.set(member.slot, element)
              else panelRefs.current.delete(member.slot)
            }}
          />
        ))}
      </div>

      <img className="bt-party-toolbar" src={uiAsset('party/bar.png')} alt="" />
      <p className="bt-party-prompt" role="status">{prompt}</p>
      {!forced && (
        <>
          <button type="button" className="bt-party-cancel" disabled={!enabled} onClick={onClose}>
            <span className="sr-only">{es.battle.party.options.cancel}</span>
          </button>
          <button type="button" className="bt-party-back" disabled={!enabled} onClick={onClose}>
            <span className="sr-only">{es.battle.back}</span>
          </button>
        </>
      )}

      {selected && (
        <div className="bt-party-options-layer">
          <button type="button" className="bt-party-dismiss" tabIndex={-1} aria-hidden="true" onClick={closeOptions} />
          <div className="bt-party-options" role="group" aria-label={es.battle.party.optionsLabel(selected.name)}>
            <button
              ref={switchRef}
              type="button"
              className="bt-party-option"
              aria-disabled={blockedReason !== null || !enabled ? 'true' : undefined}
              aria-describedby={blockedReason ? 'bt-party-reason' : undefined}
              onClick={() => {
                if (blockedReason !== null || !enabled) return
                onChoose(selected.slot)
              }}
            >
              {es.battle.party.options.switch}
            </button>
            <button type="button" className="bt-party-option" onClick={() => openSummary(selected.slot)}>
              {es.battle.party.options.summary}
            </button>
            {!forced && (
              <button type="button" className="bt-party-option" onClick={closeOptions}>
                {es.battle.party.options.cancel}
              </button>
            )}
            {blockedReason && <span id="bt-party-reason" className="sr-only">{blockedReason}</span>}
          </div>
        </div>
      )}

      {summarySlot !== null && summaryReady && (
        <Suspense fallback={null}>
          <SummaryScreen members={members} initialSlot={summarySlot} data={data} onClose={() => setSummarySlot(null)} />
        </Suspense>
      )}
    </section>
  )
}
