/**
 * Modo campaña Nuzlocke de Hoenn (D7). Conserva la cabecera y el fondo del portal Daily PWT; dentro, las pantallas del juego (de momento,
 * Ruta) y debajo la barra del portal con las medallas y la acción principal (maqueta aprobada: nada de eso tapa el mapa). Sin campaña
 * guardada, la barra ofrece empezarla; empezar otra sobre una en curso pide confirmación. Se carga aparte (lazy) desde App.
 */
import { useMemo, useState } from 'react'
import { chooseRecruit, createCampaign, draftPicks, openDraft, type CampaignDefinition, type CampaignState } from '../../core/nuzlocke/campaign'
import type { GameData } from '../../core/types'
import { LocalCampaignStore } from '../../storage/campaignStore'
import { browserStorage } from '../../storage/browserStorage'
import { es } from '../../i18n/es'
import { esCampaign } from '../../i18n/esCampaign'
import { emeraldTheme } from '../console/themes/emerald'
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import { candidateOf } from './draftModel'
import { DraftScreen } from './DraftScreen'
import { badgeCount, routePlaces, type CampaignEncounter } from './hoennRoute'
import { RouteScreen } from './RouteScreen'
import './campaign.css'

const t = esCampaign.route
const encounters = catalog.encounters as readonly CampaignEncounter[]
const definition = { encounters, species: progression.species } as unknown as CampaignDefinition

type CampaignScreenProps = {
  data: GameData
  onExit: () => void
  /** Almacén de la campaña (por defecto, el local del navegador); los tests pasan uno en memoria. */
  store?: LocalCampaignStore
  /** Semilla de una campaña nueva (por defecto, aleatoria). */
  newSeed?: () => string
}

const randomSeed = () => `hoenn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export default function CampaignScreen({ data, onExit, store: givenStore, newSeed = randomSeed }: CampaignScreenProps) {
  const store = useMemo(() => givenStore ?? new LocalCampaignStore(browserStorage()), [givenStore])
  const [state, setState] = useState(() => store.read()?.state ?? null as CampaignState | null)
  const [view, setView] = useState('route' as 'route' | 'draft')
  const save = (next: CampaignState) => {
    const record = store.write(next, null, store.read()?.revision ?? 0)
    if (!(record instanceof Promise)) setState(record.state)
    return next
  }
  const openNext = (current: CampaignState) => save(current.offer.length ? current : openDraft(definition, current))
  const continueCampaign = () => {
    if (state?.phase !== 'draft') return
    openNext(state)
    setView('draft')
  }
  const recruit = (id: string) => {
    if (!state) return
    const next = chooseRecruit(definition, state, id)
    if (next.phase === 'draft') openNext(next)
    else { save(next); setView('route') }
  }
  const places = useMemo(() => routePlaces(encounters), [])
  const badges = state ? badgeCount(state, encounters) : 0
  const next = places[Math.min(badges, places.length - 1)]
  const speciesName = (id: string) => data.names.species[id] ?? id

  const start = () => {
    if (state && !window.confirm(esCampaign.newCampaignConfirm)) return
    const created = createCampaign(newSeed())
    const record = store.write(created, null, store.read()?.revision ?? 0)
    if (!(record instanceof Promise)) setState(record.state)
  }

  return (
    <div className="page campaign-page">
      <a href="#main" className="skip-link">{es.app.skipToContent}</a>
      <header className="today-header">
        <div className="today-header-inner">
          <h1 className="logo" translate="no">
            <span className="logo-ball" aria-hidden="true" />
            <span className="logo-text">{es.app.name}</span>
          </h1>
          <p className="campaign-mode">{esCampaign.modeLabel}</p>
          <button type="button" className="btn btn-secondary campaign-back" onClick={onExit}>{esCampaign.back}</button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="campaign-main">
        <h2 className="visually-hidden">{t.screen}</h2>
        {view === 'draft' && state?.phase === 'draft' && state.offer.length ? (
          <DraftScreen
            candidates={state.offer.map((id) => candidateOf(id, Math.max(...encounters[state.encounterIndex].team.map((member) => member.level)), definition, data))}
            pick={state.pick}
            picks={draftPicks(definition, state.encounterIndex)}
            level={Math.max(...encounters[state.encounterIndex].team.map((member) => member.level))}
            rivalName={encounters[state.encounterIndex].nameEs}
            onRecruit={recruit}
            reservedHeight={150}
          />
        ) : (
          <RouteScreen places={places} badges={badges} speciesName={speciesName} reservedHeight={150} />
        )}
        <div className="campaign-bar">
          <ul className="campaign-medals" aria-label={t.medals(badges)}>
            {places.filter((place) => place.gym !== null).map((place) => (
              <li key={place.id}>
                <img src={emeraldTheme.asset(`medalla-${place.gym}`)} alt={t.medal(t.badges[place.id], (place.gym ?? 0) <= badges)}
                  className={(place.gym ?? 0) <= badges ? undefined : 'campaign-medal-off'} />
              </li>
            ))}
          </ul>
          {state ? (
            view === 'draft' ? (
              <button type="button" className="campaign-action" onClick={() => setView('route')}>{esCampaign.draft.back}</button>
            ) : (
              <button type="button" className="campaign-action" disabled={state.phase !== 'draft'} onClick={continueCampaign}
                aria-label={next.gym === null ? t.continueLeague : t.continueLabel(next.gym)}>
                {t.continue}
              </button>
            )
          ) : (
            <button type="button" className="campaign-action" onClick={start}>{esCampaign.newCampaign}</button>
          )}
        </div>
        {state && <button type="button" className="campaign-restart" onClick={start}>{esCampaign.newCampaign}</button>}
        {!store.persistent && <p className="fight-hint" role="status">{esCampaign.notSaved}</p>}
      </main>
    </div>
  )
}
