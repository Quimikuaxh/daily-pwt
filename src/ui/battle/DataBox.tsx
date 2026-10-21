import type { CSSProperties } from 'react'
import type { MonView } from '../../battle/protocol'
import { es } from '../../i18n/es'
import { uiAsset } from './introAssets'
import { useAnimatedValue } from './useAnimatedValue'

type DataBoxProps = {
  side: 'player' | 'rival'
  mon: MonView
  name: string
  testId: string
  gender?: 'M' | 'F'
  /** x1, x2 o x4: la barra y el número tardan 700 ms / velocidad en llegar a su valor. */
  speed?: number
  reducedMotion?: boolean
}

const BAR_WIDTH = 50
const LEVEL = 50

/** El verde baja a amarillo y rojo por umbral, como en el juego. */
const fillFor = (percent: number): 'green' | 'yellow' | 'red' => (percent > 50 ? 'green' : percent > 20 ? 'yellow' : 'red')

const digitsOf = (value: number): number[] => String(Math.max(0, Math.trunc(value))).split('').map(Number)

function statusLabel(status: string | null): string | null {
  return status ? (es.battle.status as Record<string, string>)[status] ?? null : null
}

function Digits({ kind, value, className }: { kind: 'hp' | 'level'; value: number; className?: string }) {
  return (
    <span className={`bt-digits ${className ?? ''}`} aria-hidden="true">
      {digitsOf(value).map((digit, index) => (
        <img key={index} src={uiAsset(`digits/${kind}-${digit}.png`)} alt="" />
      ))}
    </span>
  )
}

/**
 * Caja de datos de N2/B2: el cuadro es el ripeado y encima se pintan la barra, el nombre, el nivel y los PS.
 * Lo visible es decorativo (aria-hidden) y el texto accesible va aparte, así el lector de pantalla no oye los dígitos suelta a suelta.
 */
const BAR_ANIMATION_MS = 700

export function DataBox({ side, mon, name, testId, gender, speed = 1, reducedMotion = false }: DataBoxProps) {
  const targetPercent = Math.max(0, Math.min(100, mon.hpPercent))
  const status = statusLabel(mon.status)
  const isPlayer = side === 'player'
  const hasNumbers = isPlayer && mon.hp !== undefined && mon.maxHp !== undefined
  const hpText = hasNumbers ? es.battle.hpValues(mon.hp as number, mon.maxHp as number) : es.battle.percent(targetPercent)
  // Un único valor animado (PS del jugador; % del rival) del que derivan la barra y el número.
  const animationOptions = { durationMs: BAR_ANIMATION_MS / speed, enabled: !reducedMotion, resetKey: mon.species }
  const animatedHp = useAnimatedValue(hasNumbers ? (mon.hp as number) : targetPercent, animationOptions)
  const animatedPercent = hasNumbers ? (mon.maxHp ? (100 * animatedHp) / (mon.maxHp as number) : 0) : animatedHp
  const percent = Math.max(0, Math.min(100, animatedPercent))
  const shownHp = Math.round(animatedHp)
  const fillWidth = hasNumbers && shownHp > 0 && animatedHp > 0 ? Math.max(1, Math.round((BAR_WIDTH * percent) / 100)) : Math.round((BAR_WIDTH * percent) / 100)
  const style = { '--fill': `${fillWidth}px` } as CSSProperties

  return (
    <div data-testid={testId} className={`bt-databox bt-databox-${side}`} style={style}>
      <div className="bt-databox-visual" aria-hidden="true">
        <img className="bt-databox-plate" src={uiAsset(`databox/b2-${side}.png`)} alt="" />
        <img className="bt-databox-track" src={uiAsset('hp/track.png')} alt="" />
        <div className="bt-databox-fill">
          <img src={uiAsset(`hp/fill-${fillFor(percent)}.png`)} alt="" />
        </div>
        {isPlayer && <img className="bt-databox-exp" src={uiAsset('hp/exp-track.png')} alt="" />}
        <span className="bt-databox-name">{name}</span>
        {gender && <img className="bt-databox-gender" src={uiAsset(`icons/gender-${gender === 'M' ? 'male' : 'female'}.png`)} alt="" />}
        <Digits kind="level" value={LEVEL} className="bt-databox-level" />
        {status && <img className="bt-databox-status" src={uiAsset(`status/${mon.status}.png`)} alt="" />}
        {hasNumbers && <Digits kind="hp" value={shownHp} className="bt-databox-hp-now" />}
        {hasNumbers && <Digits kind="hp" value={mon.maxHp as number} className="bt-databox-hp-max" />}
      </div>
      <p className="sr-only">
        {name} {es.battle.level}. {es.battle.hpLabel} {hpText}
        {status ? `. ${status}` : ''}
      </p>
    </div>
  )
}
