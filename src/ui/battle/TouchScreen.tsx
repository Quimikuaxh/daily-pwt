import { useEffect, useId, useRef } from 'react'
import { es } from '../../i18n/es'
import { uiAsset } from './introAssets'
import { MoveMenu } from './MoveMenu'
import type { MoveOption } from './battleModel'

/**
 * Fondo de la pantalla táctil, medido de la captura de Negro/Blanco: panel #504848 con contorno negro y un saliente central
 * abajo, alas granate (#b81840, franja inferior #881830) arriba en las esquinas y zona clara #d8d8e0 debajo.
 */
function TouchBackground() {
  return (
    <svg className="bt-touch-svg" viewBox="0 0 256 192" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="256" height="192" fill="#d8d8e0" />
      <path d="M0 0H256V145H214L200 154H56L42 145H0Z" fill="#181818" />
      <path d="M0 0H256V142H212L198 151H58L44 142H0Z" fill="#504848" />
      <path d="M0 0H62L52 12H0Z" fill="#181818" />
      <path d="M0 0H59L50 9H0Z" fill="#b81840" />
      <path d="M0 6H51L50 9H0Z" fill="#881830" />
      <path d="M256 0H194L204 12H256Z" fill="#181818" />
      <path d="M256 0H197L206 9H256Z" fill="#b81840" />
      <path d="M256 6H205L206 9H256Z" fill="#881830" />
      <path d="M0 142H44L58 151H198L212 142H256" fill="none" stroke="#403838" strokeWidth="2" />
    </svg>
  )
}

export type TouchMode = 'main' | 'moves' | 'switch'

type TouchScreenProps = {
  mode: TouchMode
  canAct: boolean
  forfeitEnabled: boolean
  moves: MoveOption[]
  switchBlockedReason: string | null
  onMode: (mode: TouchMode) => void
  onChooseMove: (slot: number) => void
  onForfeit: () => void
  /** La Mochila no se puede usar en el PWT: solo avisa. */
  onBag: () => void
}

/** Pantalla táctil (256x192): menú principal Luchar / Cambiar / Rendirse y movimientos. El equipo (Cambiar) es la pantalla de equipo, que ocupa las dos pantallas. */
export function TouchScreen(props: TouchScreenProps) {
  const reasonId = useId()
  const bagReasonId = useId()
  const fightRef = useRef(null as HTMLButtonElement | null)
  const wasActing = useRef(false)
  const { mode, canAct, switchBlockedReason } = props

  // Al reaparecer el menú tras resolverse el turno, si el foco se perdió (el botón pulsado desapareció) vuelve a Luchar.
  useEffect(() => {
    if (canAct && !wasActing.current && mode === 'main' && (document.activeElement === document.body || document.activeElement === null)) fightRef.current?.focus()
    wasActing.current = canAct
  }, [canAct, mode])

  return (
    <section className="bt-touch" data-mode={mode} aria-label={es.battle.controlsLabel}>
      <TouchBackground />
      {!canAct && <p className="sr-only">{es.battle.waitingTurn}</p>}
      {canAct && mode === 'moves' && <MoveMenu moves={props.moves} enabled={canAct} onChoose={props.onChooseMove} onBack={() => props.onMode('main')} />}
      {canAct && mode !== 'moves' && (
        <div className="bt-main">
          <button ref={fightRef} type="button" className="bt-fight" disabled={!canAct} onClick={() => props.onMode('moves')}>
            <span className="bt-fight-shape" aria-hidden="true" />
            <span className="bt-fight-label">{es.battle.fight}</span>
          </button>
          <button type="button" className="bt-bag" aria-disabled="true" aria-describedby={bagReasonId} onClick={props.onBag}>
            <img src={uiAsset('touch/bag.png')} alt="" />
            <span className="bt-plate-label">{es.battle.bag}</span>
            <span id={bagReasonId} className="sr-only">{es.battle.bagUnavailable}</span>
          </button>
          <button
            type="button"
            className="bt-pokemon"
            disabled={!canAct || switchBlockedReason !== null}
            aria-describedby={switchBlockedReason ? reasonId : undefined}
            onClick={() => props.onMode('switch')}
          >
            <img src={uiAsset('touch/pokemon.png')} alt="" />
            <span className="bt-plate-label" aria-hidden="true">{es.battle.pokemonLabel}</span>
            <span className="sr-only">{es.battle.switchMon}</span>
          </button>
          <button type="button" className="bt-run" disabled={!props.forfeitEnabled} onClick={props.onForfeit}>
            <img src={uiAsset('touch/run.png')} alt="" />
            <span className="bt-plate-label">{es.battle.forfeit}</span>
          </button>
          {switchBlockedReason && <p id={reasonId} className="bt-switch-reason">{switchBlockedReason}</p>}
        </div>
      )}
    </section>
  )
}
