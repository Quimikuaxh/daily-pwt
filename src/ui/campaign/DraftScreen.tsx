/**
 * Pantalla Draft de la campaña (D7, maqueta aprobada el 11/11/2026). Arriba, el alquiler de la Fábrica Batalla (battle_factory_screen.c):
 * una Poké Ball por candidato (la elegida se bambolea), su nombre y el menú DATOS / RECLUTAR / OTROS en la ventana (22,14). Abajo, Datos
 * del Pokémon (pokemon_summary_screen.c), páginas INFO y ESTADÍSTICAS, con los campos originales rellenos con datos de la campaña. La oferta
 * y el reclutamiento son los del núcleo (openDraft / chooseRecruit), que guarda CampaignScreen.
 */
import { useState, type KeyboardEvent } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import { candidateNotes, type Candidate } from './draftModel'

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
  scale?: number
  reservedHeight?: number
}

export function DraftScreen({ candidates, pick, picks, level, rivalName, onRecruit, scale, reservedHeight }: DraftScreenProps) {
  const [cursor, setCursor] = useState(0)
  const [menu, setMenu] = useState(false)
  const [info, setInfo] = useState(true)
  const mon = candidates[cursor] ?? candidates[0]
  const recruit = () => { setMenu(false); setCursor(0); setInfo(true); onRecruit(mon.id) }
  const options = [
    { label: t.summary, name: t.summaryLabel(info), action: () => setInfo(!info) },
    { label: t.recruit, name: t.recruitLabel(mon.name), action: recruit },
    { label: t.others, name: t.othersLabel, action: () => setMenu(false) },
  ]
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && menu) { event.preventDefault(); setMenu(false); return }
    if (menu || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    setCursor((cursor + (event.key === 'ArrowRight' ? 1 : candidates.length - 1)) % candidates.length)
  }
  const notes = candidateNotes(mon)

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
            onClick={() => { setCursor(i); setMenu(true) }}>
            <span className={i === cursor ? 'draft-ball-sprite draft-ball-active' : 'draft-ball-sprite'}
              style={{ width: 32, height: 32, backgroundImage: `url("${emeraldTheme.asset(i === cursor ? 'fabrica-ball-activa' : 'fabrica-ball-gris')}")` }} />
          </button>
        ))}
        <img src={emeraldTheme.asset('fabrica-flecha')} alt="" style={{ left: ballX(cursor) - 8, top: 80 }} />
        <GameText text={t.choose(pick)} x={2} y={125} width={156} color="fabrica" />
        {menu && options.map((option, i) => (
          <button key={option.label} type="button" className="draft-option" style={{ left: 176, top: 112 + i * 16, width: 64, height: 16 }}
            aria-label={option.name} onClick={option.action}>
            <img className="draft-highlight" src={emeraldTheme.asset('fabrica-resalte-izda')} alt="" style={{ left: 0, top: 0 }} />
            <img className="draft-highlight" src={emeraldTheme.asset('fabrica-resalte-dcha')} alt="" style={{ left: 32, top: 0 }} />
            <GameText text={option.label} x={7} y={1} color="fabrica-menu" hidden />
          </button>
        ))}
      </div>
    ), (
      <div key="summary" className="draft-summary">
        <img src={emeraldTheme.asset(info ? 'datos-info' : 'datos-habilidades')} alt="" style={{ left: 0, top: 0 }} />
        <div aria-hidden="true">
          <GameText text={info ? t.infoTitle : t.statsTitle} x={2} y={1} width={88} color="datos-rotulo" hidden />
          <GameText text={`{NO}${String(mon.dex).padStart(3, '0')}`} x={8} y={17} color="datos-rotulo" hidden />
          <img className="mon-front" src={emeraldSprite('front', mon.id)} alt="" style={{ left: 8, top: 32 }} />
          <GameText text={mon.name} x={8} y={97} color="datos-rotulo" hidden />
          <GameText text={`/${mon.name}`} x={8} y={113} width={72} color="datos-rotulo" hidden />
          <GameText text={`{LV}${level}`} x={32} y={129} color="datos-rotulo" hidden />
          {info ? (
            <>
              <GameText text={t.profile} x={98} y={20} face="small" color="tira" hidden />
              <GameText text={t.ability} x={98} y={60} face="small" color="tira" hidden />
              <GameText text={t.notes} x={98} y={100} face="small" color="tira" hidden />
              <GameText text={t.candidate} x={88} y={33} width={144} color="datos-rotulo" hidden />
              <GameText text={t.type} x={88} y={49} color="datos" hidden />
              {mon.types.map((type, i) => <img key={type} src={emeraldTheme.asset(`tipo-${type}`)} alt="" style={{ left: 120 + 40 * i, top: 48 }} />)}
              <GameText text={mon.ability} x={88} y={73} width={144} color="datos-rotulo" hidden />
              <GameText text={mon.abilityText} x={88} y={89} width={144} color="datos" hidden />
              {notes.map((line, i) => <GameText key={i} text={line} x={88} y={113 + i * 16} width={144} color="datos" hidden />)}
            </>
          ) : (
            <>
              <GameText text={t.item} x={98} y={20} face="small" color="tira" hidden />
              <GameText text={t.ribbons} x={178} y={20} face="small" color="tira" hidden />
              <GameText text={t.stats} x={98} y={44} width={58} face="small" color="tira" hidden />
              <GameText text={t.exp} x={98} y={100} face="small" color="tira" hidden />
              <GameText text={t.none} x={86} y={33} width={72} align="center" color="datos" hidden />
              <GameText text={t.noneF} x={166} y={33} width={70} align="center" color="datos" hidden />
              {t.statNames.slice(0, 3).map((label, r) => (
                <span key={label}>
                  <GameText text={label} x={86} y={57 + r * 16} width={42} face="narrow" color="datos-rotulo" hidden />
                  <GameText text={r === 0 ? `${mon.stats[0]}/${mon.stats[0]}` : String(mon.stats[r])} x={130} y={57 + r * 16} width={40} align="right" color="datos" hidden />
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
        <section className="sr-only" aria-label={t.dataOf(mon.name)}>
          <p>{t.accessible(rivalName, level, pick + 1, picks)}</p>
          <ul>
            <li>{mon.typeNames.join(' y ')}</li>
            <li>{t.statsLabel(mon.stats)}</li>
            <li>{`${mon.ability}. ${mon.abilityText}`}</li>
            <li>{mon.evolution ? t.evolves(mon.evolution.target, mon.evolution.level) : t.noEvolution}</li>
          </ul>
        </section>
      </div>
    )]} />
  )
}
