/**
 * Modo campaña Nuzlocke de Hoenn (D7). Conserva la cabecera y el fondo del portal Daily PWT; dentro, las pantallas del juego (de momento,
 * Ruta) y debajo la barra del portal con las medallas y la acción principal (maqueta aprobada: nada de eso tapa el mapa). Sin campaña
 * guardada, la barra ofrece empezarla; empezar otra sobre una en curso pide confirmación. Se carga aparte (lazy) desde App.
 */
import { useMemo, useState } from 'react'
import { createCampaign, type CampaignState } from '../../core/nuzlocke/campaign'
import type { GameData } from '../../core/types'
import { LocalCampaignStore } from '../../storage/campaignStore'
import { browserStorage } from '../../storage/browserStorage'
import { es } from '../../i18n/es'
import { esCampaign } from '../../i18n/esCampaign'
import { emeraldTheme } from '../console/themes/emerald'
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import { badgeCount, routePlaces, type CampaignEncounter } from './hoennRoute'
import { RouteScreen } from './RouteScreen'
import './campaign.css'

const t = esCampaign.route
const encounters = catalog.encounters as readonly CampaignEncounter[]

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
        <RouteScreen places={places} badges={badges} speciesName={speciesName} reservedHeight={150} />
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
            <button type="button" className="campaign-action" disabled
              aria-label={next.gym === null ? t.continueLeague : t.continueLabel(next.gym)}>
              {t.continue}
            </button>
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
