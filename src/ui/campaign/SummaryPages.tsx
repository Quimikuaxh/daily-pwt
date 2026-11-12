/**
 * Páginas de Datos del Pokémon (pokemon_summary_screen.c): INFO, ESTADÍSTICAS y MOVIMIENTOS, en la pantalla de abajo. Las usa el draft
 * (candidatos) y, para mirar, el combate y Equipo y PC (Jose, 12/11/2026: DATOS), con el objeto, los PS y los PP de verdad y SALIR.
 */
import { useState, type ReactNode } from 'react'
import { GameText } from '../console/GameText'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import { candidateNotes, type Candidate } from './draftModel'
import { SummaryValue } from './SummaryValue'

const t = esCampaign.draft

type SummaryPagesProps = {
  mon: Candidate
  level: number
  page: number
  onPage: (page: number) => void
  /** Línea de PERFIL (en el draft, «CANDIDATO DEL DRAFT»). */
  profile: string
  /** Objeto que lleva (nombre); sin él, NINGUNO. */
  item?: string | null
  /** PS que le quedan (si no, los máximos). */
  hp?: number
  /** PP que le quedan a cada movimiento (si no, los máximos). */
  pp?: readonly (number | null)[]
  /** Primera línea del texto para lectores de pantalla. */
  heading: ReactNode
  /** Botón SALIR arriba a la derecha (fuera del draft). */
  onExit?: () => void
}

export function SummaryPages({ mon, level, page, onPage, profile, item = null, hp, pp, heading, onExit }: SummaryPagesProps) {
  const [moveCursor, setMoveCursor] = useState(0)
  const notes = candidateNotes(mon)
  const setPage = onPage
  return (
    <div className="draft-summary">
      <img src={emeraldTheme.asset(['datos-info', 'datos-habilidades', 'datos-movimientos'][page])} alt="" style={{ left: 0, top: 0 }} />
      {/* Cada puntito de las páginas lleva a la suya (Jose, 12/11/2026), como DATOS en el menú. */}
      {[0, 1, 2].map((target) => (
        <button key={target} type="button" className="team-button" style={{ left: 88 + 16 * target, top: 0, width: 16, height: 16 }}
          aria-label={t.pageLabel(target)} aria-current={target === page} onClick={() => setPage(target)} />
      ))}
      <div aria-hidden="true">
        <GameText text={[t.infoTitle, t.statsTitle, t.movesTitle][page]} x={2} y={1} width={88} color="datos-rotulo" hidden />
        <GameText text={`{NO}${String(mon.dex).padStart(3, '0')}`} x={8} y={17} color="datos-rotulo" hidden />
        <img className="mon-front" src={emeraldSprite('front', mon.id)} alt="" style={{ left: 8, top: 32 }} />
        {/* En MOVIMIENTOS el recuadro de la izquierda es más corto (debajo va EFECTO): solo el nombre, como en Movimientos. */}
        <GameText text={mon.name} x={8} y={page === 2 ? 95 : 97} color="datos-rotulo" hidden />
        {page !== 2 && (
          <>
            <GameText text={`/${mon.name}`} x={8} y={113} width={72} color="datos-rotulo" hidden />
            <GameText text={`{LV}${level}`} x={32} y={129} color="datos-rotulo" hidden />
          </>
        )}
        {page === 2 && (
          <>
            <GameText text={t.movesTitle} x={98} y={20} face="small" color="tira" hidden />
            <GameText text={t.effect} x={18} y={108} face="small" color="tira" hidden />
            <GameText text={t.description} x={98} y={108} face="small" color="tira" hidden />
            {mon.moves[moveCursor] && (
              <>
                <GameText text={t.powerLabel} x={8} y={121} width={52} fit color="datos-rotulo" hidden />
                <GameText text={t.accuracyLabel} x={8} y={137} width={52} fit color="datos-rotulo" hidden />
                <SummaryValue value={mon.moves[moveCursor].power} y={121} />
                <SummaryValue value={mon.moves[moveCursor].accuracy} y={137} />
                {mon.moves[moveCursor].text.split('\n').map((line, i) => <GameText key={i} text={line} x={86} y={121 + i * 16} width={148} color="datos" hidden />)}
              </>
            )}
          </>
        )}
        {page === 0 && (
          <>
            <GameText text={t.profile} x={98} y={20} face="small" color="tira" hidden />
            <GameText text={t.ability} x={98} y={60} face="small" color="tira" hidden />
            <GameText text={t.notes} x={98} y={100} face="small" color="tira" hidden />
            <GameText text={profile} x={88} y={33} width={144} color="datos-rotulo" fit hidden />
            <GameText text={t.type} x={88} y={49} color="datos" hidden />
            {mon.types.map((type, i) => <img key={type} src={emeraldTheme.asset(`tipo-${type}`)} alt="" style={{ left: 120 + 40 * i, top: 48 }} />)}
            <GameText text={mon.ability} x={88} y={73} width={144} color="datos-rotulo" hidden />
            <GameText text={mon.abilityText} x={88} y={89} width={144} color="datos" hidden />
            {notes.map((line, i) => <GameText key={i} text={line} x={88} y={113 + i * 16} width={144} color="datos" hidden />)}
          </>
        )}
        {page === 1 && (
          <>
            <GameText text={t.item} x={98} y={20} face="small" color="tira" hidden />
            <GameText text={t.ribbons} x={178} y={20} face="small" color="tira" hidden />
            <GameText text={t.stats} x={98} y={44} width={58} face="small" color="tira" hidden />
            <GameText text={t.exp} x={98} y={100} face="small" color="tira" hidden />
            <GameText text={item ?? t.none} x={86} y={33} width={72} align="center" color="datos" fit hidden />
            <GameText text={t.noneF} x={166} y={33} width={70} align="center" color="datos" hidden />
            {t.statNames.slice(0, 3).map((label, r) => (
              <span key={label}>
                <GameText text={label} x={86} y={57 + r * 16} width={42} face="narrow" color="datos-rotulo" hidden />
                <GameText text={r === 0 ? `${hp ?? mon.stats[0]}/${mon.stats[0]}` : String(mon.stats[r])} x={130} y={57 + r * 16} width={40} align="right" color="datos" hidden />
              </span>
            ))}
            {t.statNames.slice(3).map((label, r) => (
              <span key={label}>
                <GameText text={label} x={178} y={57 + r * 16} width={38} face="narrow" color="datos-rotulo" hidden />
                <GameText text={String(mon.stats[r + 3])} x={216} y={57 + r * 16} width={19} align="right" color="datos" hidden />
              </span>
            ))}
            <GameText text={t.expPoints} x={86} y={113} color="datos-rotulo" hidden />
            <GameText text={t.nextLevel} x={86} y={129} color="datos-rotulo" hidden />
          </>
        )}
      </div>
      {page === 2 && Array.from({ length: 4 }, (_, i) => {
        const move = mon.moves[i]
        return (
          <button key={i} type="button" className="moves-slot" style={{ left: 84, top: 32 + 16 * i, width: 154, height: 16 }}
            aria-current={i === moveCursor || undefined} aria-label={move ? t.moveLabel(move.name, move.typeName, move.pp) : t.noMove}
            onClick={() => setMoveCursor(i)} onFocus={() => setMoveCursor(i)} onPointerEnter={() => setMoveCursor(i)}>
            {move ? (
              <>
                <img src={emeraldTheme.asset(`tipo-${move.type}`)} alt="" style={{ left: 1, top: 0 }} />
                <GameText text={move.name} x={36} y={1} width={72} fit color="datos-rotulo" hidden />
                <GameText text={`{PP}${pp?.[i] ?? move.pp}/${move.pp}`} x={108} y={1} width={44} align="right" color="datos-pp" hidden />
              </>
            ) : <GameText text="-" x={36} y={1} color="datos-rotulo" hidden />}
          </button>
        )
      })}
      <section className="sr-only" aria-label={t.dataOf(mon.name)}>
        <p>{heading}</p>
        <ul>
          <li>{mon.typeNames.join(' y ')}</li>
          <li>{t.statsLabel(mon.stats)}</li>
          <li>{`${mon.ability}. ${mon.abilityText}`}</li>
          <li>{mon.evolutionText}</li>
          <li>{t.movesList(mon.moves.map((move) => move.name).join(', '))}</li>
        </ul>
      </section>
      {onExit && (
        <button type="button" className="team-button" style={{ left: 184, top: 0, width: 56, height: 16 }} aria-label={t.summaryExitLabel} onClick={onExit}>
          <img src={emeraldTheme.asset('boton-pildora')} alt="" style={{ left: 0, top: 0 }} />
          <GameText text={t.summaryExit} x={5} y={1} width={48} align="center" face="small" color="equipo" hidden />
        </button>
      )}
    </div>
  )
}
