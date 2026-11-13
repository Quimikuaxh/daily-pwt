/**
 * Ficha de rival sobre la ficha de entrenador del Domo Batalla de Esmeralda (battle_dome.c: WIN_TRAINER_NAME, MON_NAMES, FLAVOR_TEXT y
 * sInfoTrainerMonX/Y), compartida por Ruta y Liga. Tres Pokémon por página con las flechas del Domo; uno solo va en el centro. Todo lo
 * pintado es decorativo: el texto accesible va en una sección aparte.
 */
import type { KeyboardEvent } from 'react'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { GameText } from '../console/GameText'
import { esCampaign } from '../../i18n/esCampaign'
import { keyPage, pageArrows } from './hoennRoute'

type Member = { species: string; name: string; level: number }

type DomeCardProps = {
  rivalId: string
  title: string
  party: readonly Member[]
  page: number
  /** Las tres líneas de abajo para los Pokémon de la página. */
  lines: (shown: readonly Member[]) => readonly string[]
  onPage: (page: number) => void
  accessibleName: string
  accessibleText: string
  /** Varios rivales en la misma ficha (la Liga): flechas junto al título para pasar de uno a otro. */
  rivals?: { index: number; total: number; onStep: (step: number) => void; label: (step: number) => string }
}

const SLOTS = [
  { ix: 80, iy: 14, nx: 120, ny: 32, nw: 64 },
  { ix: 112, iy: 38, nx: 151, ny: 52, nw: 65 },
  { ix: 80, iy: 54, nx: 120, ny: 72, nw: 64 },
] as const

/** Flechas de rival que tienen a quién ir (la izquierda si no es el primero, la derecha si no es el último). */
const rivalArrows = (index: number, total: number) => ([[-1, 'izda', 0], [1, 'dcha', 232]] as const).filter(([step]) => { return index + step >= 0 && total > index + step })

export function DomeCard({ rivalId, title, party, page, lines, onPage, accessibleName, accessibleText, rivals }: DomeCardProps) {
  const pages = Math.ceil(party.length / 3)
  const shown = party.slice(page * 3, page * 3 + 3)
  const positions = shown.length === 1 ? [SLOTS[1]] : SLOTS
  const onKeyDown = (event: KeyboardEvent) => {
    const target = keyPage(event.key, page, pages)
    if (target === null) return
    event.preventDefault()
    onPage(target)
  }
  return (
    <div className="dome" onKeyDown={onKeyDown}>
      {/* Fondo del Domo: tesela de 64 x 64 que se repite por toda la pantalla. */}
      <div aria-hidden="true" style={{ left: 0, top: 0, width: 240, height: 160, backgroundImage: `url("${emeraldTheme.asset('domo-fondo')}")` }} />
      <div className="dome-card" aria-hidden="true" style={{ left: 8, top: 8, width: 224, height: 144, backgroundImage: `url("${emeraldTheme.asset('domo-ficha')}")` }}>
        <GameText text={title} x={8} y={8} width={208} align="center" face="short" color="domo" hidden />
        <img src={emeraldTheme.asset(`lider-${rivalId}`)} alt="" style={{ left: 8, top: 24 }} />
        {shown.map((member, i) => (
          <span key={`${page}-${i}`}>
            <img className="mon-icon" src={emeraldSprite('icon', member.species)} alt="" style={{ left: positions[i].ix, top: positions[i].iy }} />
            <GameText text={member.name.toUpperCase()} x={positions[i].nx} y={positions[i].ny} width={positions[i].nw} face="short" color="domo" hidden />
          </span>
        ))}
        {lines(shown).map((line, i) => (
          <GameText key={i} text={line} x={8} y={92 + i * 16} width={208} color="domo" hidden />
        ))}
      </div>
      {pageArrows(page, pages).map(({ side, target, x }) => (
        <button key={side} type="button" className="dome-arrow" style={{ left: x - 4, top: 64, width: 16, height: 32 }}
          aria-label={esCampaign.route.pageLabel(target + 1, pages)} onClick={() => onPage(target)}>
          <img src={emeraldTheme.asset(`domo-flecha-${side}`)} alt="" style={{ left: 4, top: 8 }} />
        </button>
      ))}
      {rivals && rivalArrows(rivals.index, rivals.total).map(([step, side, x]) => (
        (
          // En el margen entre la ficha y el borde de la pantalla, centradas en el cuadro del título (cuadro verde y 13 a 29, flecha 16 a 27; la media fila sobrante, abajo);
          // dentro de la ficha pisaban la franja (Jose, 13/11/2026).
          <button key={side} type="button" className="dome-arrow" style={{ left: x, top: 14, width: 8, height: 16 }} aria-label={rivals.label(step)} onClick={() => rivals.onStep(step)}>
            <img src={emeraldTheme.asset(`domo-flecha-${side}`)} alt="" style={{ left: 0, top: 0 }} />
          </button>
        )
      ))}
      <section className="sr-only" aria-label={accessibleName}>
        <p>{accessibleText}</p>
        <ul>
          {party.map((member, i) => <li key={i}>{esCampaign.route.memberLabel(member.name, member.level)}</li>)}
        </ul>
      </section>
    </div>
  )
}
