/**
 * Pantalla Ruta de la campaña (D7, maqueta aprobada el 11/11/2026). Arriba, el mapa de Hoenn como el mapa de pared de Esmeralda
 * (field_region_map.c): ventana «HOENN» en (22,1) y nombre del lugar en (17,17), en teselas, sin nada más encima; cada ciudad con
 * gimnasio o Liga es un botón y el cursor del mapa marca la elegida. Abajo, la ficha del rival (DomeCard). Las medallas y «Continuar» van
 * en la barra del portal, fuera del lienzo (CampaignScreen).
 */
import { useRef, useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { imagesReady } from '../battle/preloadAssets'
import { usePreloadImages } from './usePreloadImages'
import { esCampaign } from '../../i18n/esCampaign'
import { DomeCard } from './DomeCard'
import { placeState, playerSpot, type CampaignEncounter, type RoutePlace } from './hoennRoute'

const t = esCampaign.route

type RouteScreenProps = {
  places: readonly RoutePlace[]
  badges: number
  speciesName: (id: string) => string
  /** La Liga: sus cinco rivales en orden y cuál toca (0 a 5; 5, ya ganada). */
  league?: { rivals: readonly CampaignEncounter[]; next: number }
  scale?: number
  reservedHeight?: number
}

/** El nivel que se da es el máximo de todo el equipo del rival, no solo de los que se ven en la ficha (Jose, 12/11/2026). */
function cardLines(place: RoutePlace, badges: number, leagueState: 'won' | 'next' | 'pending' | null = null): string[] {
  const levels = place.rival.team.map((member) => member.level)
  const city = t.cities[place.id]
  const head = place.gym === null ? t.leagueHead(city) : t.gymHead(place.gym, city)
  const what = place.gym === null ? t.levels(levels) : t.typeLine(t.types[place.id], t.levels(levels))
  const max = Math.max(...place.rival.team.map((member) => member.level))
  const state = leagueState ?? placeState(place, badges)
  const status = state === 'won' ? (leagueState ? t.leagueWonLine : t.wonLine(t.badges[place.id])) : state === 'next' ? t.nextLine(place.rival.team.length, max)
    : place.gym === null ? t.leaguePendingLine : t.pendingLine
  return [head, what, status]
}

/** Estado de un rival de la Liga: vencido, el que toca (con las 8 medallas) o pendiente. */
function leagueStateOf(index: number, next: number, badges: number): 'won' | 'next' | 'pending' {
  if (next > index) return 'won'
  return index === next && badges >= 8 ? 'next' : 'pending'
}

/** Imágenes de la ficha de un rival: su retrato y los iconos de su equipo. */
function cardImages(rival: CampaignEncounter): string[] {
  return [emeraldTheme.asset(`lider-${rival.id}`), ...rival.team.map((member) => emeraldSprite('icon', member.species))]
}

export function RouteScreen({ places, badges, speciesName, league, scale, reservedHeight }: RouteScreenProps) {
  const next = places.find((place) => placeState(place, badges) === 'next') ?? places[places.length - 1]
  const [selectedId, setSelectedId] = useState(next.id)
  const [page, setPage] = useState(0)
  // Liga: la ficha enseña al rival que toca y se pasa por los cinco con flechas (Jose, 12/11/2026: solo salía Plubio).
  const [leagueIndex, setLeagueIndex] = useState(Math.min(league?.next ?? 0, (league?.rivals.length ?? 1) - 1))
  // La ficha se enseña entera de una vez (Jose, 13/11/2026: los Pokémon llegaban unos milisegundos después que la ficha). Al abrir la
  // Ruta se piden los retratos y los iconos de todos sus rivales (unas 50 imágenes pequeñas; nunca las del resto de especies) y, al
  // elegir otra ciudad o rival de la Liga, el cambio espera a que estén decodificadas (al momento si ya lo estaban; como mucho, 0,8 s).
  const rivals = [...places.map((candidate) => candidate.rival), ...(league?.rivals ?? [])]
  usePreloadImages(rivals.flatMap(cardImages))
  const choice = useRef(0)
  const whenReady = (rival: CampaignEncounter, apply: () => void) => {
    const ticket = ++choice.current
    void imagesReady(cardImages(rival), 800, undefined, 'high').then(() => { if (ticket === choice.current) apply() })
  }
  const basePlace = places.find((candidate) => candidate.id === selectedId) ?? next
  const leagueRival = basePlace.gym === null && league ? league.rivals[leagueIndex] : null
  const place = leagueRival ? { ...basePlace, rival: leagueRival } : basePlace
  const party = place.rival.team.map((member) => ({ species: member.species, name: speciesName(member.species), level: member.level }))
  const title = place.gym !== null ? t.leaderTitle(place.rival.nameEs, place.id === 'vito-y-leti')
    : place.rival.kind === 'elite' ? esCampaign.league.eliteTitle(place.rival.nameEs) : t.championTitle(place.rival.nameEs)
  const leagueState = leagueRival && league ? leagueStateOf(leagueIndex, league.next, badges) : null

  return (
    <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
    <div key="map" className="route-map">
      <img src={emeraldTheme.asset('mapa-hoenn')} alt="" style={{ left: 0, top: 0 }} />
      {places.map((candidate) => (
        <button key={candidate.id} type="button" className="route-place" data-place={candidate.id}
          style={{ left: candidate.x * 8 - 4, top: candidate.y * 8 - 4, width: 16, height: 16 }}
          aria-pressed={candidate.id === place.id}
          aria-label={t.placeLabel(t.cities[candidate.id], candidate.gym, t.states[placeState(candidate, badges)])}
          onClick={() => {
            const rival = candidate.gym === null && league ? league.rivals[leagueIndex] : candidate.rival
            whenReady(rival, () => { setSelectedId(candidate.id); setPage(0) })
          }} />
      ))}
      {/* Icono del protagonista (region_map.c, brendan_icon) en la ciudad donde está; el cursor va encima, como en el juego. */}
      <img src={emeraldTheme.asset('mapa-jugador')} alt="" style={{ left: playerSpot(places, badges, league?.next ?? 0).x * 8 - 4, top: playerSpot(places, badges, league?.next ?? 0).y * 8 - 4 }} />
      <img className="blink-a" src={emeraldTheme.asset('mapa-cursor-0')} alt="" style={{ left: place.x * 8 - 4, top: place.y * 8 - 4 }} />
      <img className="blink-b" src={emeraldTheme.asset('mapa-cursor-1')} alt="" style={{ left: place.x * 8 - 4, top: place.y * 8 - 4 }} />
      <GameWindow x={22} y={1} width={7} height={2}>
        <GameText text={t.hoenn} y={1} width={56} align="center" />
      </GameWindow>
      <GameWindow x={17} y={17} width={12} height={2}>
        <GameText text={t.cities[place.id]} y={1} width={96} hidden />
      </GameWindow>
    </div>
  ), (
    <DomeCard
      key="card"
      rivalId={place.rival.id}
      title={title}
      party={party}
      page={page}
      onPage={setPage}
      lines={() => cardLines(place, badges, leagueState)}
      rivals={leagueRival && league ? { index: leagueIndex, total: league.rivals.length, onStep: (step) => { whenReady(league.rivals[leagueIndex + step], () => { setLeagueIndex(leagueIndex + step); setPage(0) }) }, label: (step) => t.leagueRivalLabel(league.rivals[leagueIndex + step].nameEs) } : undefined}
      accessibleName={t.cardLabel(place.rival.nameEs)}
      accessibleText={`${title}. ${t.medals(badges)}. ${cardLines(place, badges, leagueState).join(' ')}`}
    />
  )]} />
  )
}
