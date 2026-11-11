/**
 * Pantalla Ruta de la campaña (D7, maqueta aprobada el 11/11/2026). Arriba, el mapa de Hoenn como el mapa de pared de Esmeralda
 * (field_region_map.c): ventana «HOENN» en (22,1) y nombre del lugar en (17,17), en teselas, sin nada más encima; cada ciudad con
 * gimnasio o Liga es un botón y el cursor del mapa marca la elegida. Abajo, la ficha del rival (DomeCard). Las medallas y «Continuar» van
 * en la barra del portal, fuera del lienzo (CampaignScreen).
 */
import { useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import { DomeCard } from './DomeCard'
import { placeState, playerSpot, type RoutePlace } from './hoennRoute'

const t = esCampaign.route

type RouteScreenProps = {
  places: readonly RoutePlace[]
  badges: number
  speciesName: (id: string) => string
  scale?: number
  reservedHeight?: number
}

function cardLines(place: RoutePlace, badges: number, levels: readonly number[]): string[] {
  const city = t.cities[place.id]
  const head = place.gym === null ? t.leagueHead(city) : t.gymHead(place.gym, city)
  const what = place.gym === null ? t.levels(levels) : t.typeLine(t.types[place.id], t.levels(levels))
  const max = Math.max(...place.rival.team.map((member) => member.level))
  const state = placeState(place, badges)
  const status = state === 'won' ? t.wonLine(t.badges[place.id]) : state === 'next' ? t.nextLine(place.rival.team.length, max)
    : place.gym === null ? t.leaguePendingLine : t.pendingLine
  return [head, what, status]
}

export function RouteScreen({ places, badges, speciesName, scale, reservedHeight }: RouteScreenProps) {
  const next = places.find((place) => placeState(place, badges) === 'next') ?? places[places.length - 1]
  const [selectedId, setSelectedId] = useState(next.id)
  const [page, setPage] = useState(0)
  const place = places.find((candidate) => candidate.id === selectedId) ?? next
  const party = place.rival.team.map((member) => ({ species: member.species, name: speciesName(member.species), level: member.level }))
  const title = place.gym === null ? t.championTitle(place.rival.nameEs) : t.leaderTitle(place.rival.nameEs, place.id === 'vito-y-leti')

  return (
    <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
    <div key="map" className="route-map">
      <img src={emeraldTheme.asset('mapa-hoenn')} alt="" style={{ left: 0, top: 0 }} />
      {places.map((candidate) => (
        <button key={candidate.id} type="button" className="route-place" data-place={candidate.id}
          style={{ left: candidate.x * 8 - 4, top: candidate.y * 8 - 4, width: 16, height: 16 }}
          aria-pressed={candidate.id === place.id}
          aria-label={t.placeLabel(t.cities[candidate.id], candidate.gym, t.states[placeState(candidate, badges)])}
          onClick={() => { setSelectedId(candidate.id); setPage(0) }} />
      ))}
      {/* Icono del protagonista (region_map.c, brendan_icon) en la ciudad donde está; el cursor va encima, como en el juego. */}
      <img src={emeraldTheme.asset('mapa-jugador')} alt="" style={{ left: playerSpot(places, badges).x * 8 - 4, top: playerSpot(places, badges).y * 8 - 4 }} />
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
      rivalId={place.id}
      title={title}
      party={party}
      page={page}
      onPage={setPage}
      lines={(shown) => cardLines(place, badges, shown.map((member) => member.level))}
      accessibleName={t.cardLabel(place.rival.nameEs)}
      accessibleText={`${title}. ${t.medals(badges)}. ${cardLines(place, badges, party.map((member) => member.level)).join(' ')}`}
    />
  )]} />
  )
}
