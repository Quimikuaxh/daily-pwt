/**
 * Pantalla Draft de la campaña (D7, maqueta aprobada el 11/11/2026). Arriba, el alquiler de la Fábrica Batalla (battle_factory_screen.c):
 * una Poké Ball por candidato (la elegida se bambolea), su nombre y el menú DATOS / RECLUTAR / OTROS en la ventana (22,14). Abajo, Datos
 * del Pokémon (pokemon_summary_screen.c), páginas INFO y ESTADÍSTICAS, con los campos originales rellenos con datos de la campaña. La oferta
 * y el reclutamiento son los del núcleo (openDraft / chooseRecruit), que guarda CampaignScreen.
 */
import { useState, type KeyboardEvent } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import type { Candidate } from './draftModel'
import { SummaryPages } from './SummaryPages'

const t = esCampaign.draft
const ballX = (i: number) => 48 + 48 * i

type DraftScreenProps = {
  candidates: readonly Candidate[]
  /** Elección actual (0…) y cuántas hay en este hito. */
  pick: number
  picks: number
  level: number
  rivalName: string
  onRecruit: (id: string) => void
  /** OTROS: ver el equipo y la caja sin cambiar nada (Jose, 12/11/2026). */
  onShowTeam?: () => void
  scale?: number
  reservedHeight?: number
}

export function DraftScreen({ candidates, pick, picks, level, rivalName, onRecruit, onShowTeam, scale, reservedHeight }: DraftScreenProps) {
  const [cursor, setCursor] = useState(0)
  const [menu, setMenu] = useState(false)
  // Páginas de Datos: 0 INFO, 1 ESTADÍSTICAS, 2 MOVIMIENTOS (Jose, 12/11/2026: los cuatro con que llegaría).
  const [page, setPage] = useState(0)
  const [option, setOption] = useState(0)
  const mon = candidates[cursor] ?? candidates[0]
  const recruit = () => { setMenu(false); setCursor(0); setPage(0); onRecruit(mon.id) }
  const options = [
    { label: t.summary, name: t.summaryLabel(page), action: () => setPage((page + 1) % 3) },
    { label: t.recruit, name: t.recruitLabel(mon.name), action: recruit },
    { label: t.others, name: t.othersLabel, action: () => { setMenu(false); onShowTeam?.() } },
  ]
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && menu) { event.preventDefault(); setMenu(false); return }
    if (menu || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    setCursor((cursor + (event.key === 'ArrowRight' ? 1 : candidates.length - 1)) % candidates.length)
  }
  const selectedOption = option

  return (
    <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
      <div key="rent" className="draft-rent" onKeyDown={onKeyDown}>
        <img src={emeraldTheme.asset('fabrica-fondo')} alt="" style={{ left: 0, top: 0 }} />
        <GameText text={t.pick(pick + 1, picks)} x={2} y={17} width={94} color="fabrica" />
        <GameText text={mon.name} x={152} y={17} width={86} align="right" color="especie" />
        {candidates.map((candidate, i) => (
          <button key={candidate.id} type="button" className="draft-ball" style={{ left: ballX(i) - 16, top: 48, width: 32, height: 32 }}
            aria-pressed={i === cursor} aria-haspopup="menu"
            aria-label={t.candidateLabel(i + 1, candidate.name, candidate.typeNames.join(' y '), candidate.total)}
            onClick={() => { setCursor(i); setMenu(true); setOption(0) }}>
            <span className={i === cursor ? 'draft-ball-sprite draft-ball-active' : 'draft-ball-sprite'}
              style={{ width: 32, height: 32, backgroundImage: `url("${emeraldTheme.asset(i === cursor ? 'fabrica-ball-activa' : 'fabrica-ball-gris')}")` }} />
          </button>
        ))}
        <img src={emeraldTheme.asset('fabrica-flecha')} alt="" style={{ left: ballX(cursor) - 8, top: 80 }} />
        <GameText text={t.choose(pick)} x={2} y={125} width={156} color="fabrica" />
        {menu && options.map((option, i) => (
          <button key={option.label} type="button" className="draft-option" style={{ left: 176, top: 112 + i * 16, width: 64, height: 16 }}
            aria-label={option.name} aria-current={i === selectedOption} onClick={option.action}
            onPointerEnter={() => setOption(i)} onFocus={() => setOption(i)}>
            <img className="draft-highlight" src={emeraldTheme.asset('fabrica-resalte-izda')} alt="" style={{ left: 0, top: 0 }} />
            <img className="draft-highlight" src={emeraldTheme.asset('fabrica-resalte-dcha')} alt="" style={{ left: 32, top: 0 }} />
            <GameText text={option.label} x={7} y={1} color="fabrica-menu" hidden />
          </button>
        ))}
      </div>
    ), (
      <SummaryPages key="summary" mon={mon} level={level} page={page} onPage={setPage} profile={t.candidate} heading={t.accessible(rivalName, level, pick + 1, picks)} />
    )]} />
  )
}
