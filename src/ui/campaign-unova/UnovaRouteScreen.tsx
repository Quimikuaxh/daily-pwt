/**
 * Pantalla Ruta de la campaña de Teselia (maqueta A3 aprobada el 13/11/2026). Arriba, la barra «TESELIA» con el nombre del lugar y el mapa
 * de N2/B2; cada gimnasio y la Liga es un botón y el cursor marca el elegido. Abajo, la ficha del rival sobre el fondo de rejilla de los
 * menús: franja de título con el tipo, retrato, tres líneas, la cuadrícula de 2 x 3 con el equipo (las casillas vacías, solo el marco) y
 * la tira de medallas, que no sale cuando las enseñan los paneles laterales. En la Liga, las flechas pasan por sus cinco rivales.
 * Todo el texto va a 13 px, el único tamaño al que pokemon-dp.ttf cae en la rejilla de píxeles (a 12 o 16 px sale borroso); para que a
 * 13 px quepan los nombres largos (Carracosta, 59 px), la cuadrícula es de 2 columnas y no de 3 (Jose, 14/11/2026).
 */
import { useRef, useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { uiAsset } from '../common/uiAssets'
import { trainerSprite } from '../common/spriteUrls'
import { imagesReady } from '../battle/preloadAssets'
import { usePreloadImages } from '../campaign/usePreloadImages'
import { esCampaign } from '../../i18n/esCampaign'
import { placeState, type CampaignEncounter, type PlaceState, type RoutePlace } from '../campaign/hoennRoute'
import { MAP_TOP, n2b2Ui, unovaVars } from './unovaRoute'
import { GRID_TOP, UnovaRivalCard } from './UnovaRivalCard'
import './unova.css'

const t = esCampaign.unova
const route = esCampaign.route

export type UnovaRouteScreenProps = {
  places: readonly RoutePlace[]
  badges: number
  speciesName: (id: string) => string
  /** La Liga: sus cinco rivales en orden y cuál toca (0 a 5; 5, ya ganada). */
  league?: { rivals: readonly CampaignEncounter[]; next: number }
  /** La tira de medallas de la ficha; no sale cuando las enseñan los paneles laterales. */
  showBadges?: boolean
  scale?: number
  reservedHeight?: number
}

/** Estado de un rival de la Liga: vencido, el que toca (con las 8 medallas) o pendiente. */
function leagueStateOf(index: number, next: number, badges: number): PlaceState {
  if (next > index) return 'won'
  return index === next && badges >= 8 ? 'next' : 'pending'
}

function statusLine(place: RoutePlace, state: PlaceState, league: boolean): string {
  const max = Math.max(...place.rival.team.map((member) => member.level))
  if (state === 'won') return league ? t.leagueWonLine : t.wonLine(t.badges[place.id])
  return state === 'next' ? t.nextLine(max) : t.pendingLine(max)
}

export function UnovaRouteScreen({ places, badges, speciesName, league, showBadges = true, scale, reservedHeight }: UnovaRouteScreenProps) {
  const next = places.find((place) => placeState(place, badges) === 'next') ?? places[places.length - 1]
  const [selectedId, setSelectedId] = useState(next.id)
  const [leagueIndex, setLeagueIndex] = useState(Math.min(league?.next ?? 0, (league?.rivals.length ?? 1) - 1))
  // Como en Hoenn: los retratos de todos los rivales se piden al abrir y el cambio de ficha espera a que estén (como mucho, 0,8 s).
  const rivals = [...places.map((candidate) => candidate.rival), ...(league?.rivals ?? [])]
  usePreloadImages([uiAsset('party/icons-sheet.png'), ...rivals.map((rival) => trainerSprite(rival.id))])
  const choice = useRef(0)
  const whenReady = (rival: CampaignEncounter, apply: () => void) => {
    const ticket = ++choice.current
    void imagesReady([trainerSprite(rival.id)], 800, undefined, 'high').then(() => { if (ticket === choice.current) apply() })
  }

  const basePlace = places.find((candidate) => candidate.id === selectedId) ?? next
  const leagueRival = basePlace.gym === null && league ? league.rivals[leagueIndex] : null
  const place = leagueRival ? { ...basePlace, rival: leagueRival } : basePlace
  const state = leagueRival && league ? leagueStateOf(leagueIndex, league.next, badges) : placeState(place, badges)
  const title = place.gym !== null ? t.leaderTitle(place.rival.nameEs)
    : place.rival.kind === 'elite' ? t.eliteTitle(place.rival.nameEs) : t.championTitle(place.rival.nameEs)
  const lines = [place.gym !== null ? t.gymHead(place.gym, t.cities[place.id]) : t.leagueHead, statusLine(place, state, leagueRival !== null),
    t.count(place.rival.team.length)]
  const type = place.gym !== null ? t.types[place.id] : null
  const step = (delta: number) => {
    if (!league) return
    whenReady(league.rivals[leagueIndex + delta], () => setLeagueIndex(leagueIndex + delta))
  }
  // En la Liga, flechas a los lados para pasar por sus cinco rivales.
  const neighbour = (delta: number) => (league?.rivals[leagueIndex + delta] ? route.leagueRivalLabel(league.rivals[leagueIndex + delta].nameEs) : null)
  const arrows = leagueRival && league ? { previous: neighbour(-1), next: neighbour(1), onStep: step } : undefined

  return (
    <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} screens={[(
      <div key="map" className="unova-route-map" style={unovaVars()}>
        <span className="unova-bar unova-route-title" />
        <span className="unova-text unova-route-region">{t.region}</span>
        <span className="unova-text unova-route-city">{t.cities[place.id]}</span>
        <img src={n2b2Ui('mapa-teselia')} alt="" style={{ left: 0, top: MAP_TOP }} />
        {places.map((candidate) => (
          <button key={candidate.id} type="button" className="unova-route-place" data-place={candidate.id}
            style={{ left: candidate.x - 8, top: MAP_TOP + candidate.y - 8 }}
            aria-pressed={candidate.id === place.id}
            aria-label={route.placeLabel(t.cities[candidate.id], candidate.gym, route.states[placeState(candidate, badges)])}
            onClick={() => {
              const rival = candidate.gym === null && league ? league.rivals[leagueIndex] : candidate.rival
              whenReady(rival, () => setSelectedId(candidate.id))
            }} />
        ))}
        <span className="unova-route-cursor" aria-hidden="true" style={{ left: place.x - 9, top: MAP_TOP + place.y - 9 }} />
      </div>
    ), (
      <UnovaRivalCard key="card" rival={place.rival} title={title} type={type} lines={lines} goldLine={state === 'next' ? 1 : null}
        speciesName={speciesName}
        arrows={arrows}>
        {showBadges && (
          <div className="unova-card-badges" style={{ top: GRID_TOP + 3 * 22 + 6 }} aria-label={route.medals(badges)} role="img">
            <span className="unova-bar-off" style={{ left: 0, top: 0, width: 240, height: 30 }} />
            <span className="unova-text unova-soft" style={{ left: 7, top: 9 }}>{t.medals}</span>
            {places.filter((candidate) => candidate.gym !== null).map((candidate) => (
              <img key={candidate.id} src={n2b2Ui(`medalla-${candidate.gym}${(candidate.gym ?? 0) <= badges ? '' : '-off'}`)} alt=""
                style={{ left: 76 + ((candidate.gym ?? 1) - 1) * 20, top: 2 }} />
            ))}
          </div>
        )}
      </UnovaRivalCard>
    )]} />
  )
}
