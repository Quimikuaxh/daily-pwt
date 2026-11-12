/**
 * Modo campaña Nuzlocke de Hoenn (D7). Conserva la cabecera y el fondo del portal Daily PWT; dentro, las pantallas del juego (de momento,
 * Ruta) y debajo la barra del portal con las medallas y la acción principal (maqueta aprobada: nada de eso tapa el mapa). Sin campaña
 * guardada, la barra ofrece empezarla; empezar otra sobre una en curso pide confirmación. Se carga aparte (lazy) desde App.
 */
import { availableDraftForms } from '../../core/nuzlocke/draftAvailability'
import emeraldCalendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import { campaignSteps } from './stepsModel'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { chooseRecruit, createCampaign, draftPicks, evolveForLeague, lockLeagueRoster, openDraft, type CampaignDefinition, type CampaignState } from '../../core/nuzlocke/campaign'
import type { GameData } from '../../core/types'
import { LocalCampaignStore } from '../../storage/campaignStore'
import type { AccountCampaign } from '../../cloud/campaign'
import { browserStorage } from '../../storage/browserStorage'
import { es } from '../../i18n/es'
import { esCampaign } from '../../i18n/esCampaign'
import { emeraldTheme } from '../console/themes/emerald'
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import { candidateOf, emeraldDex } from './draftModel'
import { DraftScreen } from './DraftScreen'
import { badgeCount, routePlaces, type CampaignEncounter } from './hoennRoute'
import { RouteScreen } from './RouteScreen'
import { initialLayout, teamMonOf, type TeamLayout } from './teamModel'
import { MovesScreen } from './MovesScreen'
import { equippedMoves, legalMoves } from './movesModel'
import { setCampaignMemberMoves } from '../../core/nuzlocke/progression'
import type { CampaignBattleDefinition } from '../../core/nuzlocke/battle'
import { LocalCampaignSession } from '../../battle/campaignSession'
import { createCampaignWorkerClient, type CampaignBattleClient } from '../../battle/client'
import { battleInput } from './campaignBattle'
import { EmeraldBattle } from './EmeraldBattle'
import { ResultScreen } from './ResultScreen'
import { EvolutionScene } from './EvolutionScene'
import { BagScreen } from './BagScreen'
import { bagContents, itemName as emeraldItemName } from './bagModel'
import { buyExchangeItem, equipItem, exchangeItems } from '../../core/nuzlocke/heldItems'
import { ExchangeScreen } from './ExchangeScreen'
import { leagueEvolutions } from './evolutionModel'
import { LeagueScreen } from './LeagueScreen'
import { leagueBeaten } from './leagueModel'
import { type CampaignResult, minutesSince, playerNameOf, protagonistOf, recruitedSpecies, resultOf, trainerId } from './resultModel'
import { TeamScreen } from './TeamScreen'
import { battleMusic } from './campaignMusic'
import { ShareScreen } from './ShareScreen'
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
  /** Nickname de la cuenta (mensaje de la medalla y Ficha de Entrenador); sin él, el protagonista de Esmeralda. */
  playerName?: string
  /** Cliente del worker de combate (por defecto, el real); los tests pasan un doble. */
  createBattleClient?: () => CampaignBattleClient
  /**
   * Guardado de la cuenta (D4, DEC-90; con sesión de Google): la campaña se lee y se guarda en ella en vez de en el navegador, y la
   * pantalla avisa de los conflictos («Recargar campaña») y de los fallos de conexión («Reintentar»). Sin él, el almacén local.
   */
  cloud?: AccountCampaign
}

type CampaignViewProps = Omit<CampaignScreenProps, 'store' | 'cloud'> & {
  store: LocalCampaignStore | AccountCampaign
  /** Sesión de combate sobre el almacén (la cuenta registra las suyas para pararlas al cerrar sesión o en un conflicto). */
  newSession: (client: CampaignBattleClient) => LocalCampaignSession
}

/** Plazas del equipo: las del líder en los gimnasios; seis en la Liga. */
/** Preparando un combate de la Liga (Alto Mando o campeón). */
const inLeague = (state: CampaignState) => encounters[state.encounterIndex].kind !== 'gym'

const teamLimit = (state: CampaignState) => encounters[state.encounterIndex].kind === 'gym' ? encounters[state.encounterIndex].team.length : 6

const battleDefinition = definition as unknown as CampaignBattleDefinition
/** Género del rival para «la LÍDER» / «el LÍDER» (Esmeralda); el Alto Mando habla como líder y Plubio como campeón. */
const FEMALE = new Set(['petra', 'candela', 'alana', 'fatima', 'nivea'])
const trainerOf = (encounter: CampaignEncounter) => ({
  nameEs: encounter.nameEs, category: encounter.kind === 'champion' ? 'champion' as const : 'leader' as const, gender: FEMALE.has(encounter.id) ? 'F' as const : 'M' as const,
})

const randomSeed = () => `hoenn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export default function CampaignScreen({ store: givenStore, cloud, ...props }: CampaignScreenProps) {
  const local = useMemo(() => { return givenStore ?? new LocalCampaignStore(browserStorage()) }, [givenStore])
  if (cloud) { return <CloudCampaign cloud={cloud} {...props} /> }
  return <CampaignView {...props} store={local} newSession={(client) => { return new LocalCampaignSession(client, local) }} />
}

/**
 * Campaña guardada en la cuenta (GUARDADO.md): carga el registro al abrir y, mientras guarda o si algo falla, bloquea la pantalla.
 * En conflicto, el aviso y «Recargar campaña» (nunca automático ni sobrescribiendo el remoto, PRD §0); sin conexión, «Reintentar» con
 * la misma operación. Tras recargar o recuperarse, la pantalla se vuelve a montar desde el registro (y reanuda el combate guardado).
 */
function CloudCampaign({ cloud, ...props }: Omit<CampaignScreenProps, 'store'> & { cloud: AccountCampaign }) {
  const cloudState = useSyncExternalStore(cloud.subscribe, cloud.getState)
  const [generation, setGeneration] = useState(0)
  useEffect(() => { void cloud.load().catch(() => undefined) }, [cloud])
  const { status, message } = cloudState
  const remount = () => { setGeneration((value) => value + 1) }
  if (status === 'closed' || (status === 'loading' && generation === 0 && !cloudState.record)) {
    return <p className="campaign-cloud-status" role="status">{status === 'closed' ? esCampaign.closed : esCampaign.loading}</p>
  }
  const blocked = status !== 'ready'
  return (
    <>
      {status === 'conflict' && (
        <div className="campaign-cloud-alert" role="alert">
          <p>{message ?? esCampaign.conflict}</p>
          <button type="button" className="campaign-action" onClick={() => { void cloud.reload().then(remount, () => undefined) }}>{esCampaign.reload}</button>
        </div>
      )}
      {status === 'offline' && (
        <div className="campaign-cloud-alert" role="alert">
          <p>{message ?? esCampaign.offline}</p>
          <button type="button" className="campaign-action" onClick={() => { void cloud.retry().then(remount, () => undefined) }}>{esCampaign.retry}</button>
        </div>
      )}
      {status === 'error' && <p className="campaign-cloud-alert" role="alert">{message ?? esCampaign.invalid}</p>}
      <div className="campaign-cloud" inert={blocked} aria-busy={status === 'saving' || status === 'loading'}>
        <CampaignView key={generation} {...props} store={cloud} newSession={(client) => { return cloud.createSession(client) }} />
      </div>
    </>
  )
}

function CampaignView({ data, onExit, store, newSession, newSeed = randomSeed, createBattleClient = createCampaignWorkerClient, playerName }: CampaignViewProps) {
  const [state, setState] = useState(() => store.read()?.state ?? null as CampaignState | null)
  // Resultado del último combate: el encuentro jugado, la alineación (para enseñar sus bajas), el estado al cerrarlo y los minutos.
  const [result, setResult] = useState(null as CampaignResult | null)
  // Estado y alineación con los que se entró en el combate en curso.
  const [battleContext, setBattleContext] = useState(() => {
    const record = store.read()
    return record?.battle ? { before: record.state, lineup: record.battle.source.selected ?? record.state.leagueRoster ?? [] } : null
  })
  // Con un combate guardado (recarga a mitad), se vuelve a él.
  const [view, setView] = useState(() => (store.read()?.battle ? 'battle' : 'route') as 'route' | 'draft' | 'team' | 'teamView' | 'moves' | 'battle' | 'result' | 'share' | 'evolution' | 'league' | 'bag' | 'exchange')
  // El worker de combate (y su sesión) solo se crea al entrar en combate: Ruta, Draft y Equipo no lo necesitan.
  const [session, setSession] = useState(() => (store.read()?.battle ? newSession(createBattleClient()) : null))
  const enterBattle = (lineup: readonly string[]) => {
    if (state) setBattleContext({ before: state, lineup })
    if (!session) setSession(newSession(createBattleClient()))
    setView('battle')
  }
  useEffect(() => () => session?.stop(), [session])
  useEffect(() => session?.subscribe((message) => {
    if (message.type !== 'campaign-finished') return
    const after = store.read()?.state ?? null
    if (battleContext && after) {
      setResult({ ...resultOf(battleContext.before, after, encounters), lineup: battleContext.lineup, after, minutes: minutesSince(after.startedAt, Date.now()) })
    }
    setState(after)
    setView('result')
  }), [session, store, battleContext])
  // Alineación aceptada en Equipo y PC; la usan Movimientos y el combate.
  const [team, setTeam] = useState(null as string[] | null)
  // Colocación de Equipo y PC mientras se va a Movimientos y se vuelve; se rehace al entrar desde la Ruta.
  const [teamLayout, setTeamLayout] = useState(null as TeamLayout | null)
  const [movesFor, setMovesFor] = useState(null as string | null)

  // En la cuenta el guardado es asíncrono: se enseña ya y, si falla, la pantalla queda bloqueada con su aviso (CloudCampaign).
  const save = (next: CampaignState) => {
    const record = store.write(next, null, store.read()?.revision ?? 0)
    if (record instanceof Promise) { setState(next); record.catch(() => undefined) } else setState(record.state)
    return next
  }
  const openNext = (current: CampaignState) => save(current.offer.length ? current : openDraft(definition, current))
  const continueCampaign = () => {
    if (state?.phase === 'prepare' && inLeague(state)) {
      // Liga: evoluciones (una vez), después los 6 en Equipo y PC y la elección de participantes; con la plantilla fijada, el rival.
      if (state.leagueRoster) { setView('league'); return }
      if (!state.leagueEvolved) {
        if (leagueEvolutions(definition, state).length) { setView('evolution'); return }
        save(evolveForLeague(definition, state, {}))
      }
      setTeamLayout(null)
      setView('team')
      return
    }
    if (state?.phase === 'prepare') { setTeamLayout(null); setView('team'); return }
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
  // Candidatos del draft con la trayectoria de su forma (para los movimientos con que llegarían).
  const draftCandidates = (current: CampaignState) => {
    const level = Math.max(...encounters[current.encounterIndex].team.map((member) => member.level))
    const forms = availableDraftForms(definition, emeraldCalendar, current.encounterIndex, 'A')
    return current.offer.map((id) => candidateOf(id, level, definition, data, forms.find((form) => form.species === id)?.history))
  }
  const badges = state ? badgeCount(state, encounters) : 0
  const next = places[Math.min(badges, places.length - 1)]
  // Qué viene: pasos del tramo y lo que hace el botón principal (stepsModel).
  const steps = state ? campaignSteps(state, draftPicks(definition, state.encounterIndex), inLeague(state),
    inLeague(state) && !state.leagueEvolved && leagueEvolutions(definition, state).length > 0) : null
  const rivalNow = state ? encounters[state.encounterIndex] : null
  const action = !steps || !rivalNow ? t.continue
    : steps.current === 'recruit' && steps.pick ? t.actions.recruit(steps.pick.n, steps.pick.total)
      : steps.current === 'battle' ? t.actions.battle(rivalNow.nameEs)
        : t.actions[steps.current] as string
  const speciesName = (id: string) => data.names.species[id] ?? id

  const start = () => {
    if (state && !window.confirm(esCampaign.newCampaignConfirm)) return
    // Cuándo empezó: el TIEMPO de la Ficha de Entrenador.
    const created = { ...createCampaign(newSeed()), startedAt: Date.now() }
    save(created)
  }

  // Desde OTROS en el draft: el equipo y la caja, solo para mirar; CANCELAR vuelve a la misma oferta.
  const teamView = () => {
    if (view !== 'teamView' || state?.phase !== 'draft') return null
    return (
      <TeamScreen
        readOnly
        mons={Object.fromEntries(state.members.map((member) => [member.id, teamMonOf(member, data)]))}
        initial={initialLayout(state, 6, [])}
        limit={6}
        rivalName={encounters[state.encounterIndex].nameEs}
        itemName={emeraldItemName}
        onAccept={() => setView('draft')}
        onCancel={() => setView('draft')}
        onMoves={() => undefined}
        onGiveItem={() => undefined}
        onTakeItem={() => undefined}
        reservedHeight={150}
      />
    )
  }

  const teamScreen = () => {
    if (view !== 'team' || state?.phase !== 'prepare') return null
    return (
    <TeamScreen
      mons={Object.fromEntries(state.members.map((member) => [member.id, teamMonOf(member, data)]))}
      initial={teamLayout ?? initialLayout(state, teamLimit(state), team ?? [])}
      limit={teamLimit(state)}
      rivalName={encounters[state.encounterIndex].nameEs}
      itemName={emeraldItemName}
      onAccept={(chosen) => { setTeam(chosen); if (inLeague(state)) setView('league'); else enterBattle(chosen) }}
      onCancel={() => setView('route')}
      onMoves={(id) => { setMovesFor(id); setView('moves') }}
      onGiveItem={(id) => { setMovesFor(id); setView('bag') }}
      onTakeItem={(id) => { save(equipItem(state, id, null)) }}
      onLayoutChange={setTeamLayout}
      reservedHeight={150}
    />
    )
  }

  const startBattle = useCallback(() => {
    if (!session) return
    const record = store.read()
    if (record?.battle) return session.resume(battleDefinition)
    if (!record) return
    // En la Liga sale la plantilla fijada (los que siguen en pie, en su orden); en un gimnasio, la alineación de Equipo y PC.
    const roster = record.state.leagueRoster?.filter((id) => record.state.members.some((member) => { return member.id === id && !member.fainted }))
    const lineup = roster ?? team
    if (!lineup?.length) return
    return session.prepare(battleInput(battleDefinition, record.state, lineup))
  }, [session, store, team])

  const resultScreen = () => {
    if (view !== 'result' || !result) return null
    const { mode, encounter, after, lineup } = result
    const player = playerNameOf(after.seed, playerName)
    const badges = badgeCount(after, encounters)
    const badgeNames = places.filter((place) => place.gym !== null).map((place) => t.badges[place.id])
    const message = mode === 'medal' ? esCampaign.result.medal(player, t.badges[encounter.id], encounter.nameEs)
      : mode === 'beaten' ? esCampaign.result.beaten(encounter.nameEs)
        : mode === 'whiteout' ? esCampaign.result.whiteout(player) : esCampaign.result.hallOfFame
    const team = lineup.flatMap((id) => {
      const member = after.members.find((candidate) => { return candidate.id === id })
      if (!member) return []
      const mon = teamMonOf(member, data)
      return [{ species: member.species, name: mon.name, level: member.level, hp: mon.hp, fainted: member.fainted }]
    })
    return (
      <ResultScreen
        mode={mode} message={message} player={player} protagonist={protagonistOf(after.seed)}
        badges={badges} badgeNames={badgeNames}
        card={{ id: trainerId(after.seed), points: after.battlePoints ?? 0, pokedex: recruitedSpecies(after), minutes: result.minutes }}
        team={team}
        // Al ganar al campeón o al perder la campaña, la pantalla final para compartir; si no, a la Ruta.
        onDone={() => { if (mode === 'hallOfFame' || mode === 'whiteout') { setView('share'); return } setResult(null); setView('route') }}
        reservedHeight={150}
      />
    )
  }

  const shareScreen = () => {
    if (view !== 'share' || !result) return null
    const { mode, encounter, after, lineup } = result
    const won = mode === 'hallOfFame'
    const team = lineup.flatMap((id) => {
      const member = after.members.find((candidate) => { return candidate.id === id })
      // Al ganar, los que siguen en pie (como el Salón de la Fama); al perder, todos los del último combate.
      return member && (!won || !member.fainted) ? [{ species: member.species, name: speciesName(member.species).toUpperCase() }] : []
    })
    return (
      <ShareScreen
        won={won} player={playerNameOf(after.seed, playerName)} protagonist={protagonistOf(after.seed)} rival={encounter.nameEs} team={team}
        card={{ id: trainerId(after.seed), pokedex: recruitedSpecies(after), fainted: after.members.filter((member) => member.fainted).length, minutes: result.minutes, badges: badgeCount(after, encounters) }}
        date={new Date().toISOString().slice(0, 10)}
        reservedHeight={200}
      />
    )
  }

  const battleScreen = () => {
    if (view !== 'battle' || !state || !session) return null
    const encounter = encounters[state.encounterIndex]
    const record = store.read()
    const leadId = record?.battle?.source.preparation.leadId ?? state.leagueRoster?.[0] ?? team?.[0]
    const lead = state.members.find((member) => { return member.id === leadId })
    return (
      <EmeraldBattle
        session={session}
        start={startBattle}
        data={data}
        trainer={trainerOf(encounter)}
        intro={{ rivalLead: speciesName(encounter.team[0].species).toUpperCase(), playerLead: lead ? speciesName(lead.species).toUpperCase() : '' }}
        rivalLevels={encounter.team.map((member) => member.level)}
        playerLevels={Object.fromEntries(state.members.map((member) => [member.species, member.level]))}
        music={battleMusic(encounter.kind)}
        onEnded={() => { session.finish(battleDefinition) }}
        reservedHeight={150}
      />
    )
  }

  const evolutionScreen = () => {
    if (view !== 'evolution' || state?.phase !== 'prepare') return null
    return (
      <EvolutionScene
        evolutions={leagueEvolutions(definition, state)}
        nameOf={(species) => speciesName(species).toUpperCase()}
        hpOf={(id, species) => {
          const member = state.members.find((candidate) => { return candidate.id === id })
          return member ? teamMonOf({ ...member, species }, data).hp : 1
        }}
        onDone={(choices) => { save(evolveForLeague(definition, state, choices)); setTeamLayout(null); setView('team') }}
        reservedHeight={150}
      />
    )
  }

  const leagueScreen = () => {
    if (view !== 'league' || state?.phase !== 'prepare') return null
    const ids = state.leagueRoster ?? team ?? []
    const members = ids.flatMap((id) => {
      const member = state.members.find((candidate) => { return candidate.id === id })
      if (!member) return []
      const mon = teamMonOf(member, data)
      return [{ id, species: member.species, name: mon.name, level: member.level, hp: mon.hp, fainted: member.fainted }]
    })
    return (
      <LeagueScreen
        rival={encounters[state.encounterIndex]}
        beaten={leagueBeaten(state.encounterIndex, encounters)}
        members={members}
        roster={state.leagueRoster}
        speciesName={(id) => speciesName(id).toUpperCase()}
        onAccept={(selected) => {
          const locked = state.leagueRoster ? state : save(lockLeagueRoster(definition, state, selected))
          enterBattle((locked.leagueRoster ?? selected).filter((id) => locked.members.some((member) => { return member.id === id && !member.fainted })))
        }}
        onCancel={() => setView('route')}
        reservedHeight={150}
      />
    )
  }

  const exchangeScreen = () => {
    if (view !== 'exchange' || state?.phase !== 'prepare') return null
    return (
      <ExchangeScreen
        points={state.battlePoints ?? 0}
        offers={exchangeItems()}
        onBuy={(item) => { save(buyExchangeItem(state, item)) }}
        onExit={() => setView('route')}
        reservedHeight={150}
      />
    )
  }

  const bagScreen = () => {
    const member = view === 'bag' && state?.phase === 'prepare' ? state.members.find((candidate) => { return candidate.id === movesFor && !candidate.fainted }) : undefined
    if (!state || !member) return null
    const mon = teamMonOf(member, data)
    return (
      <BagScreen
        protagonist={protagonistOf(state.seed)}
        member={{ species: member.species, name: mon.name, level: member.level, hp: mon.hp, item: member.item ?? null }}
        contents={(pocket) => bagContents(state, pocket, member.id)}
        onGive={(item) => { save(equipItem(state, member.id, item)); setView('team') }}
        onClose={() => setView('team')}
        reservedHeight={150}
      />
    )
  }

  const movesScreen = () => {
    const member = view === 'moves' && state?.phase === 'prepare' ? state.members.find((candidate) => { return candidate.id === movesFor && !candidate.fainted }) : undefined
    if (!state || !member) return null
    const mon = teamMonOf(member, data)
    return (
      <MovesScreen
        key={member.id}
        mon={{ species: member.species, name: mon.name, level: member.level, dex: emeraldDex(member.species) }}
        legal={legalMoves(definition, state, member, data)}
        equipped={equippedMoves(definition, state, member)}
        onChange={(moves) => save(setCampaignMemberMoves(definition, state, member.id, moves))}
        onExit={() => setView('team')}
        reservedHeight={150}
      />
    )
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
        {shareScreen() ?? teamView() ?? resultScreen() ?? battleScreen() ?? evolutionScreen() ?? leagueScreen() ?? teamScreen() ?? exchangeScreen() ?? bagScreen() ?? movesScreen() ?? (view === 'draft' && state?.phase === 'draft' && state.offer.length ? (
          <DraftScreen
            candidates={draftCandidates(state)}
            pick={state.pick}
            picks={draftPicks(definition, state.encounterIndex)}
            level={Math.max(...encounters[state.encounterIndex].team.map((member) => member.level))}
            rivalName={encounters[state.encounterIndex].nameEs}
            onRecruit={recruit}
            onShowTeam={() => setView('teamView')}
            reservedHeight={150}
          />
        ) : (
          <RouteScreen places={places} badges={badges} speciesName={speciesName} reservedHeight={150} />
        ))}
        {steps && view === 'route' && (
          <ol className="campaign-steps" aria-label={t.stepsLabel(t.steps[steps.current])}>
            {steps.steps.map((id) => (
              <li key={id} aria-current={id === steps.current ? 'step' : undefined}>
                <span>{id === 'recruit' && steps.pick && id === steps.current ? `${t.steps[id]} ${steps.pick.n}/${steps.pick.total}` : t.steps[id]}</span>
              </li>
            ))}
          </ol>
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
            view !== 'route' ? (
              <button type="button" className="campaign-action" onClick={() => { if (view === 'share') setResult(null); setView('route') }}>{esCampaign.draft.back}</button>
            ) : (
              <button type="button" className="campaign-action" disabled={state.phase !== 'draft' && state.phase !== 'prepare'} onClick={continueCampaign}
                aria-label={t.actionLabel(action, next.gym === null ? t.continueLeague.replace('Continuar: ', '') : t.continueLabel(next.gym).replace('Continuar: ', ''))}>
                {action}
              </button>
            )
          ) : (
            <button type="button" className="campaign-action" onClick={start}>{esCampaign.newCampaign}</button>
          )}
        </div>
        {/* Botones secundarios en una fila (Jose, 12/11/2026: apilados no gustaban). */}
        {/* Solo en la Ruta: en el draft, el equipo o el combate era fácil pulsarlo sin querer (Jose, 12/11/2026). */}
        {state && view === 'route' && (
          <div className="campaign-secondary">
            {state.phase === 'prepare' && (
              <button type="button" className="campaign-restart" aria-label={esCampaign.exchange.openLabel(state.battlePoints ?? 0)} onClick={() => setView('exchange')}>
                {esCampaign.exchange.open}
              </button>
            )}
            <button type="button" className="campaign-restart" onClick={start}>{esCampaign.newCampaign}</button>
          </div>
        )}
        {store instanceof LocalCampaignStore && !store.persistent && <p className="fight-hint" role="status">{esCampaign.notSaved}</p>}
      </main>
    </div>
  )
}
