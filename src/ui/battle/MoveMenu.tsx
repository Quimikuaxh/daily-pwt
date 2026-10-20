import { useId, type CSSProperties } from 'react'
import { es } from '../../i18n/es'
import { uiAsset } from './introAssets'
import type { MoveOption } from './battleModel'
import { moveTileColor } from './moveTileColors'

type MoveMenuProps = {
  moves: MoveOption[]
  enabled: boolean
  onChoose: (slot: number) => void
  onBack: () => void
}

function MovePp({ pp }: { pp: MoveOption['pp'] }) {
  if (!pp) return null
  return (
    <span className="bt-move-pp">
      <span>{es.battle.ppLabel}</span>
      <span>{es.battle.hpValues(pp.current, pp.max)}</span>
    </span>
  )
}

/** Menú de movimientos de la pantalla táctil: 4 teselas de 128x48 con el borde del color del tipo (el tipo va también en el nombre accesible), el nombre y los PP centrados debajo. */
export function MoveMenu({ moves, enabled, onChoose, onBack }: MoveMenuProps) {
  const baseId = useId()

  return (
    <div className="bt-moves" role="group" aria-label={es.battle.movesLabel}>
      {moves.map((move) => {
        const reasonId = `${baseId}-${move.slot}`
        const disabled = !enabled || move.disabledReason !== null
        const style = { '--tile': moveTileColor(move.typeName) } as CSSProperties
        return (
          <button
            key={move.slot}
            type="button"
            className="bt-move"
            style={style}
            data-slot={move.slot}
            aria-label={es.battle.moveAria(move.name, move.typeLabel, move.pp)}
            disabled={disabled}
            aria-describedby={move.disabledReason ? reasonId : undefined}
            onClick={() => onChoose(move.slot)}
          >
            <span className="bt-move-shape" aria-hidden="true" />
            <span className="bt-move-name">{move.name}</span>
            {move.disabledReason ? <span id={reasonId} className="bt-move-reason">{move.disabledReason}</span> : <MovePp pp={move.pp} />}
          </button>
        )
      })}
      <button type="button" className="bt-back" disabled={!enabled} onClick={onBack}>
        <img src={uiAsset('touch/back.png')} alt="" />
        <span className="sr-only">{es.battle.back}</span>
      </button>
    </div>
  )
}
