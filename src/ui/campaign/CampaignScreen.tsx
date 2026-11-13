/**
 * Modo campaña Nuzlocke de Hoenn (D7). Conserva la cabecera y el fondo del portal Daily PWT; dentro, las pantallas del juego (de momento,
 * Ruta) y debajo la barra del portal con las medallas y la acción principal (maqueta aprobada: nada de eso tapa el mapa). Sin campaña
 * guardada, la barra ofrece empezarla; empezar otra sobre una en curso pide confirmación. Se carga aparte (lazy) desde App.
 */
import { preloadCampaign } from './campaignPreload'
import { RevealWhenLoaded } from './RevealWhenLoaded'
import { availableDraftForms } from '../../core/nuzlocke/draftAvailability'
import emeraldCalendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import { campaignSteps } from './stepsModel'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { type CampaignDifficulty, chooseRecruit, createCampaign, draftPicks, evolveForLeague, evolveRecruit, lockLeagueRoster, openDraft, specialEvolutionOptions, type CampaignDefinition, type CampaignState } from '../../core/nuzlocke/campaign'
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
import { fittingLayout, initialLayout, teamMonOf, type TeamLayout } from './teamModel'
import { MovesScreen } from './MovesScreen'
import { equippedMoves, legalMoves, moveInfo } from './movesModel'
import { setCampaignMemberMoves } from '../../core/nuzlocke/progression'
import type { CampaignBattleDefinition } from '../../core/nuzlocke/battle'
import { LocalCampaignSession } from '../../battle/campaignSession'
import { createCampaignWorkerClient, type CampaignBattleClient } from '../../battle/client'
import { battleInput } from './campaignBattle'
import { EmeraldBattle } from './EmeraldBattle'
import { ResultScreen } from './ResultScreen'
import { EvolutionScene } from './EvolutionScene'
import { BagScreen } from './BagScreen'
import { bagContents, itemName as emeraldItemName, machineItems, machineLabel } from './bagModel'
import { campaignEvolutionItems } from '../../core/nuzlocke/calendar'
import { emeraldMoveName } from './emeraldNames'
import moveTexts from '../../../data/nuzlocke/emerald-move-descriptions-es.json'
import { buyExchangeItem, equipItem, exchangeItems } from '../../core/nuzlocke/heldItems'
import { ExchangeScreen } from './ExchangeScreen'
import { leagueEvolutions } from './evolutionModel'
import { LeagueScreen } from './LeagueScreen'
import { leagueBeaten } from './leagueModel'
import { type CampaignResult, minutesSince, playerNameOf, protagonistOf, recruitedSpecies, resultOf, trainerId } from './resultModel'
import { TeamScreen } from './TeamScreen'
import { battleMusic, townMusic, useCampaignMusic } from './campaignMusic'
import { ShareScreen } from './ShareScreen'
import { DifficultyDialog } from './DifficultyDialog'
import { Modal } from '../common/Modal'
import { SoundSettings } from '../menu/SoundSettings'
import type { SoundPrefs } from '../../storage/settings'
import { CampaignCard, SideColumn, TeamPanel, useSidePanelOffset } from './CampaignSide'
import { CAMPAIGN_PANEL, type SideSets } from './sidePanelsModel'
import { toId } from '../../core/id'
import { NEUTRAL_NATURE } from '../../core/constants'
import type { CSSProperties } from 'react'
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
  /** Sonido y volumen de Ajustes; con `onSoundChange`, el botón Sonido de la cabecera los cambia (Jose, 13/11/2026). */
  sound?: SoundPrefs
  onSoundChange?: (sound: SoundPrefs) => void
}

type CampaignViewProps = Omit<CampaignScreenProps, 'store' | 'cloud'> & {
  store: LocalCampaignStore | AccountCampaign
  /** Sesión de combate sobre el almacén (la cuenta registra las suyas para pararlas al cerrar sesión o en un conflicto). */
  newSession: (client: CampaignBattleClient) => LocalCampaignSession
  /**
   * Si ya se puede crear la sesión de combate. En la cuenta, solo con el guardado listo: mientras carga o guarda, `createSession` lanza
   * y, llamado al montar con un combate guardado en caché, dejaba la página en blanco. El combate se crea en cuanto esté listo.
   */
  canStartBattle?: () => boolean
  /** Avisa de cada cambio de estado del guardado (para crear entonces la sesión que no se pudo crear). */
  subscribeStore?: (listener: () => void) => () => void
}

/** Plazas del equipo: las del líder en los gimnasios; seis en la Liga. */
/** Preparando un combate de la Liga (Alto Mando o campeón). */
const inLeague = (state: CampaignState) => encounters[state.encounterIndex].kind !== 'gym'

const teamLimit = (state: CampaignState) => encounters[state.encounterIndex].kind === 'gym' ? encounters[state.encounterIndex].team.length : 6

/** Los cinco de la Liga, en orden (Alto Mando y campeón). */
const leagueRivals = encounters.filter((encounter) => encounter.kind !== 'gym')

const battleDefinition = definition as unknown as CampaignBattleDefinition
/** Género del rival para «la LÍDER» / «el LÍDER» (Esmeralda); el Alto Mando habla como líder y Plubio como campeón. */
const FEMALE = new Set(['petra', 'candela', 'alana', 'fatima', 'nivea'])
const trainerOf = (encounter: CampaignEncounter) => ({
  nameEs: encounter.nameEs, category: encounter.kind === 'champion' ? 'champion' as const : 'leader' as const, gender: FEMALE.has(encounter.id) ? 'F' as const : 'M' as const,
})

/** Pantallas con su propia salida: sin «Volver a la ruta» en la barra. */
const OWN_EXIT: readonly string[] = ['battle', 'result', 'evolution', 'evolveOne']

/** Descripción española de un movimiento en dos líneas (la de Movimientos). */
const moveDescription = (move: string): string => (moveTexts as unknown as { moves: Record<string, string> }).moves[move] ?? ''

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
        <CampaignView key={generation} {...props} store={cloud} newSession={(client) => { return cloud.createSession(client) }}
          canStartBattle={() => { return cloud.getState().status === 'ready' }} subscribeStore={cloud.subscribe} />
      </div>
    </>
  )
}

function CampaignView({ data, onExit, store, newSession, canStartBattle = () => true, subscribeStore, newSeed = randomSeed, createBattleClient = createCampaignWorkerClient, playerName, sound, onSoundChange }: CampaignViewProps) {
  const [soundOpen, setSoundOpen] = useState(false)
  // Una campaña perdida no se vuelve a abrir: al entrar sale directamente la pantalla para empezar otra (Jose, 13/11/2026). El registro
  // se queda guardado hasta que se empiece la nueva, que lo sustituye.
  const [state, setState] = useState(() => {
    const saved = store.read()?.state ?? null
    return saved?.phase === 'lost' ? null : saved
  })
  // Resultado del último combate: el encuentro jugado, la alineación (para enseñar sus bajas), el estado al cerrarlo y los minutos.
  const [result, setResult] = useState(null as CampaignResult | null)
  // Estado y alineación con los que se entró en el combate en curso.
  const [battleContext, setBattleContext] = useState(() => {
    const record = store.read()
    return record?.battle ? { before: record.state, lineup: record.battle.source.selected ?? record.state.leagueRoster ?? [] } : null
  })
  // Con un combate guardado (recarga a mitad), se vuelve a él.
  const [view, setView] = useState(() => (store.read()?.battle ? 'battle' : 'route') as 'route' | 'draft' | 'team' | 'teamView' | 'evolveOne' | 'moves' | 'battle' | 'result' | 'share' | 'evolution' | 'league' | 'bag' | 'exchange')
  // El worker de combate (y su sesión) solo se crea al entrar en combate: Ruta, Draft y Equipo no lo necesitan.
  const startSession = () => (canStartBattle() ? newSession(createBattleClient()) : null)
  const [session, setSession] = useState(() => (store.read()?.battle ? startSession() : null))
  // Combate guardado al abrir la campaña: se retoma donde estaba, sin la entrada (Jose, 12/11/2026). Uno nuevo, con ella.
  const [resumedBattle, setResumedBattle] = useState(() => !!store.read()?.battle)
  const enterBattle = (lineup: readonly string[]) => {
    setResumedBattle(false)
    if (state) setBattleContext({ before: state, lineup })
    if (!session) setSession(startSession())
    setView('battle')
  }
  // En combate sin sesión (la cuenta aún cargaba o guardaba al entrar): se crea cuando el guardado pase a listo, una sola vez.
  useEffect(() => {
    if (view !== 'battle' || session || !subscribeStore) return
    let started = false
    return subscribeStore(() => {
      if (started || !canStartBattle()) return
      started = true
      setSession(newSession(createBattleClient()))
    })
  }, [view, session, subscribeStore, canStartBattle, newSession, createBattleClient])
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
      // Entre rondas, primero Equipo y PC con la plantilla (orden, movimientos y objetos; Jose, 12/11/2026) y después la ficha del rival.
      if (state.leagueRoster) { setView('team'); return }
      if (!state.leagueEvolved) {
        if (leagueEvolutions(definition, state).length) { setView('evolution'); return }
        save(evolveForLeague(definition, state, {}))
      }
      setTeamLayout(null)
      setView('team')
      return
    }
    // La colocación de Equipo y PC se conserva al salir y volver a entrar (Jose, 12/11/2026); `fittingLayout` la descarta si ya no vale.
    if (state?.phase === 'prepare') { setView('team'); return }
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
  // Precarga al entrar y al cambiar de tramo, equipo u oferta: la interfaz entera y los sprites que pueden salir pronto.
  const preloadKey = state ? `${state.encounterIndex}|${state.members.map((member) => member.species).join(',')}|${state.offer.join(',')}` : ''
  useEffect(() => {
    preloadCampaign(state, encounters[state?.encounterIndex ?? 0].team.map((member) => member.species))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia lo que se precarga
  }, [preloadKey])
  // En los menús (Ruta, draft, equipo, movimientos, Mochila, Tienda, Liga) suena el tema de la ciudad del tramo; el combate, el
  // resultado, la evolución y el final llevan la suya.
  const menuView = !['battle', 'result', 'share', 'evolution', 'evolveOne'].includes(view)
  useCampaignMusic(menuView ? townMusic(encounters[state?.encounterIndex ?? 0].id) : null)
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
  // Tipos de Esmeralda (sin el tipo Hada de generaciones posteriores), en minúsculas como los iconos tipo-*.
  const typesOf = (id: string) => (definition.species[id]?.types ?? data.dex.species[id]?.types ?? []).map((type) => type.toLowerCase())

  // Paneles laterales en escritorio (PRD §0, 12/11/2026): en los menús, «Tu campaña» y «Tu equipo»; con ellos, la tira de medallas de la
  // barra sobra y los botones secundarios van en la misma fila que el principal.
  const sideOffset = useSidePanelOffset(150, CAMPAIGN_PANEL.h)
  // El TIEMPO de la ficha avanza solo: se rehace cada medio minuto.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, 30_000)
    return () => { clearInterval(timer) }
  }, [])
  // En todas las pantallas menos el combate, que lleva los suyos (Jose, 12/11/2026: el resultado no debe quedar solo en medio).
  const panels = sideOffset !== null && state !== null && view !== 'battle'
  const sidePanels = () => {
    if (!panels || !state || sideOffset === null) return null
    // El mismo equipo que la pantalla de Equipo y PC mientras se edita (Jose, 12/11/2026: no coincidían); fuera de ella, el guardado.
    // En la Liga, con la plantilla fijada, el equipo es esa plantilla (los que siguen en pie, en su orden; Jose, 12/11/2026).
    const roster = state.leagueRoster?.filter((id) => state.members.some((member) => { return member.id === id && !member.fainted }))
    const limit = roster ? roster.length : state.phase === 'prepare' ? teamLimit(state) : 6
    const layout = (state.phase === 'prepare' && !roster ? fittingLayout(teamLayout, state, limit) : null) ?? initialLayout(state, limit, roster ?? team ?? state.lastTeam ?? [])
    const party = layout.party.map((id) => {
      const member = state.members.find((candidate) => { return candidate.id === id })
      if (!member) return null
      const mon = teamMonOf(member, data)
      return { species: member.species, name: mon.name, level: member.level, hp: mon.hp, maxHp: mon.hp, item: member.item ?? null }
    })
    const encounter = encounters[state.encounterIndex]
    return (
      <>
        <SideColumn side="left" offset={sideOffset} label={esCampaign.side.campaignLabel}>
          <CampaignCard points={state.battlePoints ?? 0} minutes={minutesSince(state.startedAt, now)}
            fainted={state.members.filter((member) => member.fainted).length} species={recruitedSpecies(state)}
            box={layout.boxes[0].mons.filter(Boolean).length} badges={badges}
            next={esCampaign.side.nextValue(encounter.nameEs, Math.max(...encounter.team.map((member) => member.level)))} />
        </SideColumn>
        <SideColumn side="right" offset={sideOffset} label={esCampaign.side.teamLabel}>
          <TeamPanel party={party} limit={limit} itemName={emeraldItemName}
            box={layout.boxes.flatMap((box) => box.mons.flatMap((id) => {
              const member = state.members.find((candidate) => { return candidate.id === id })
              return member ? [{ species: member.species, name: teamMonOf(member, data).name, fainted: member.fainted }] : []
            }))} />
        </SideColumn>
      </>
    )
  }

  // Salida de los menús y de la pantalla final. Tras perder, la pantalla final ofrece empezar otra en lugar de volver a una Ruta que ya
  // no sirve (Jose, 13/11/2026).
  const exitButton = () => {
    if (OWN_EXIT.includes(view)) return null
    if (view === 'share' && state?.phase === 'lost') {
      return <button type="button" className="campaign-action" onClick={start}>{esCampaign.restartCampaign}</button>
    }
    return <button type="button" className="campaign-action" onClick={() => { if (view === 'share') setResult(null); setView('route') }}>{esCampaign.draft.back}</button>
  }

  // Solo en la Ruta: en el draft, el equipo o el combate era fácil pulsarlo sin querer (Jose, 12/11/2026).
  const secondary = () => {
    if (!state || view !== 'route') return null
    return (
      <>
        {/* Sin Tienda en la Liga: en el juego no se puede salir de ella (Jose, 13/11/2026). */}
        {state.phase === 'prepare' && !inLeague(state) && (
          <button type="button" className="campaign-restart" aria-label={esCampaign.exchange.openLabel(state.battlePoints ?? 0)} onClick={() => setView('exchange')}>
            {esCampaign.exchange.open}
          </button>
        )}
        <button type="button" className="campaign-restart" onClick={start}>{esCampaign.restartCampaign}</button>
      </>
    )
  }

  // Empezar: primero la dificultad (PRD §0, 13/11/2026) y, con una campaña en curso, la confirmación de perderla.
  const [choosingDifficulty, setChoosingDifficulty] = useState(false)
  const start = () => {
    // Perdida, no hay nada que conservar: sin confirmación.
    if (state && state.phase !== 'lost' && !window.confirm(esCampaign.newCampaignConfirm)) return
    setChoosingDifficulty(true)
  }
  const startWith = (difficulty: CampaignDifficulty) => {
    setChoosingDifficulty(false)
    // Desde la pantalla final de una derrota, la nueva empieza en la Ruta.
    setResult(null)
    setView('route')
    // Cuándo empezó: el TIEMPO de la Ficha de Entrenador.
    save({ ...createCampaign(newSeed(), difficulty), startedAt: Date.now() })
  }

  // EVOLUCIONAR en el PC antes de la Liga (Jose, 12/11/2026): las formas a las que puede llegar ahora (de día y de noche, para Eevee).
  const [evolvingId, setEvolvingId] = useState(null as string | null)
  const evolveTargets = (current: CampaignState, id: string): string[] => {
    try {
      const member = current.members.find((candidate) => { return candidate.id === id })
      const options = [...specialEvolutionOptions(definition, current, id, { period: 'day' }), ...specialEvolutionOptions(definition, current, id, { period: 'night' })]
      return [...new Set(options)].filter((target) => target !== member?.species)
    } catch {
      return []
    }
  }
  const evolveOneScreen = () => {
    if (view !== 'evolveOne' || state?.phase !== 'prepare' || !evolvingId) return null
    const member = state.members.find((candidate) => { return candidate.id === evolvingId })
    if (!member) return null
    return (
      <EvolutionScene
        evolutions={[{ id: member.id, species: member.species, level: member.level, targets: evolveTargets(state, member.id) }]}
        nameOf={(species) => speciesName(species).toUpperCase()}
        hpOf={(id, species) => teamMonOf({ ...member, species }, data).hp}
        onDone={(choices) => {
          const target = choices[member.id]
          const night = !specialEvolutionOptions(definition, state, member.id, { period: 'day' }).includes(target)
          save(evolveRecruit(definition, state, member.id, target, { period: night ? 'night' : 'day' }))
          setEvolvingId(null)
          setView('team')
        }}
        reservedHeight={150}
      />
    )
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
    // Liga con la plantilla fijada: solo sus miembros (la caja está cerrada); se puede cambiar el orden, los movimientos y los objetos.
    const roster = state.leagueRoster
    const shown = roster ? { ...state, members: state.members.filter((member) => { return roster.includes(member.id) }) } : state
    const limit = roster ? shown.members.filter((member) => { return !member.fainted }).length : teamLimit(state)
    const preferred = roster ?? team ?? state.lastTeam ?? []
    return (
    <TeamScreen
      mons={Object.fromEntries(shown.members.map((member) => [member.id, teamMonOf(member, data)]))}
      initial={fittingLayout(teamLayout, shown, limit) ?? initialLayout(shown, limit, preferred)}
      limit={limit}
      rivalName={encounters[state.encounterIndex].nameEs}
      itemName={emeraldItemName}
      onAccept={(chosen) => {
        setTeam(chosen)
        if (roster) save({ ...state, leagueRoster: [...chosen, ...roster.filter((id) => !chosen.includes(id))] })
        if (inLeague(state)) setView('league'); else enterBattle(chosen)
      }}
      onCancel={() => setView('route')}
      onMoves={(id) => { setMovesFor(id); setView('moves') }}
      onGiveItem={(id) => { setMovesFor(id); setView('bag') }}
      onTakeItem={(id) => { save(equipItem(state, id, null)) }}
      canEvolve={(id) => !roster && evolveTargets(state, id).length > 0}
      onEvolve={(id) => { setEvolvingId(id); setView('evolveOne') }}
      onLayoutChange={setTeamLayout}
      summaryOf={(id) => {
        const member = state.members.find((candidate) => { return candidate.id === id })
        return member ? memberSummary(state, member) : null
      }}
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
        trainer={encounter.id}
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

  // Sets para los paneles del combate mientras el motor lo prepara (Jose, 12/11/2026: tardaban en salir): los del jugador y el rival
  // con la habilidad de la especie; cuando llega la preparación, los del registro (los del motor).
  const provisionalSets = (current: CampaignState, lineup: readonly string[]): SideSets => {
    const flat = (value: number) => ({ hp: value, atk: value, def: value, spa: value, spd: value, spe: value })
    const set = (species: string, level: number, item: string | null | undefined, moves: readonly string[]) => ({
      species: toId(battleDefinition.species[species]?.simulatorSpecies ?? species), nameEs: species, level, item: item ?? '',
      ability: toId(data.dex.species[species]?.abilities[0] ?? ''), moves: [...moves], nature: NEUTRAL_NATURE, ivs: flat(20), evs: flat(0),
    })
    const player = lineup.flatMap((id) => {
      const member = current.members.find((candidate) => { return candidate.id === id })
      return member ? [set(member.species, member.level, member.item, equippedMoves(definition, current, member))] : []
    })
    return { player, rival: battleDefinition.encounters[current.encounterIndex].team.map((member) => set(member.species, member.level, member.item, member.moves)) }
  }

  // DATOS de un miembro (Jose, 12/11/2026): la ficha del draft con sus movimientos equipados, su nivel y su objeto.
  const memberSummary = (current: CampaignState, member: CampaignState['members'][number]) => {
    const mon = candidateOf(member.species, member.level, definition, data, member.history)
    return {
      mon: { ...mon, moves: equippedMoves(definition, current, member).map((id) => moveInfo(id, data, { level: member.level })) },
      level: member.level, item: member.item ? emeraldItemName(member.item) : null,
    }
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
        trainerId={encounter.id}
        summaryOf={(species, occurrence) => {
          const ids = battleContext?.lineup ?? []
          const member = ids.map((id) => state.members.find((candidate) => { return candidate.id === id })).filter((candidate) => candidate?.species === species)[occurrence]
          return member ? memberSummary(state, member) : null
        }}
        resumed={resumedBattle}
        intro={{ rivalLead: speciesName(encounter.team[0].species).toUpperCase(), playerLead: lead ? speciesName(lead.species).toUpperCase() : '' }}
        rivalLevels={encounter.team.map((member) => member.level)}
        playerLevels={Object.fromEntries(state.members.map((member) => [member.species, member.level]))}
        music={battleMusic(encounter.kind)}
        lineup={(battleContext?.lineup ?? []).flatMap((id, i) => {
          const member = state.members.find((candidate) => { return candidate.id === id })
          if (!member) return []
          const mon = teamMonOf(member, data)
          return [{ species: member.species, name: mon.name, level: member.level, hp: mon.hp, maxHp: mon.hp, fainted: member.fainted, active: i === 0 }]
        })}
        onEnded={() => { session.finish(battleDefinition) }}
        sides={{ sets: () => store.read()?.battle?.init ?? provisionalSets(state, battleContext?.lineup ?? []), typesOf, trainer: encounter.id }}
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
        // CANCELAR vuelve al equipo, de donde se llega a esta pantalla, no a la ruta (Jose, 13/11/2026).
        onCancel={() => setView('team')}
        reservedHeight={150}
      />
    )
  }

  const exchangeScreen = () => {
    if (view !== 'exchange' || state?.phase !== 'prepare' || inLeague(state)) return null
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
        contents={(pocket) => {
          if (pocket === 'evolution') return [...campaignEvolutionItems(definition, state)].sort().map((id) => ({ id, name: emeraldItemName(id), text: esCampaign.bag.evolutionText, free: 0, view: true }))
          if (pocket === 'machines') return machineItems(state).map(({ id, move }) => ({ id, name: esCampaign.bag.machineName(machineLabel(id), emeraldMoveName(move, data.names)), text: moveDescription(move), free: 0, view: true }))
          return bagContents(state, pocket, member.id)
        }}
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

  // Marco de ventana de Esmeralda para los botones (URL absoluta: relativa en una variable CSS se resolvería contra la hoja de estilos).
  const pageStyle = { '--campaign-frame': `url("${new URL(emeraldTheme.asset('marco-1'), document.baseURI).href}")` } as CSSProperties
  return (
    <div className="page campaign-page" style={pageStyle}>
      <a href="#main" className="skip-link">{es.app.skipToContent}</a>
      <header className="today-header">
        <div className="today-header-inner">
          <h1 className="logo" translate="no">
            <span className="logo-ball" aria-hidden="true" />
            <span className="logo-text">{es.app.name}</span>
          </h1>
          <p className="campaign-mode">{esCampaign.modeLabel}</p>
          {/* Un solo hueco de la rejilla de la cabecera para los dos botones. */}
          <div className="campaign-header-actions">
            {sound && onSoundChange && (
              <button type="button" className="btn btn-secondary campaign-sound" onClick={() => setSoundOpen(true)}>{es.battle.sound}</button>
            )}
            <button type="button" className="btn btn-secondary campaign-back" onClick={onExit}>{esCampaign.back}</button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="campaign-main">
        <h2 className="visually-hidden">{t.screen}</h2>
        {/* Cada pantalla se enseña cuando sus imágenes han cargado (como mucho 1,5 s): la primera vez, el fondo de Equipo y PC o del combate
            llegaba después que el resto (Jose, 13/11/2026). */}
        <RevealWhenLoaded key={view}>
        {shareScreen() ?? teamView() ?? evolveOneScreen() ?? resultScreen() ?? battleScreen() ?? evolutionScreen() ?? leagueScreen() ?? teamScreen() ?? exchangeScreen() ?? bagScreen() ?? movesScreen() ?? (view === 'draft' && state?.phase === 'draft' && state.offer.length ? (
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
          // Una partida nueva vuelve a montar la Ruta: si no, seguía elegida la ciudad de la anterior en vez del primer gimnasio (Jose, 13/11/2026).
          <RouteScreen key={state?.seed ?? 'sin-campaña'} places={places} badges={badges} speciesName={speciesName} reservedHeight={150}
            league={{ rivals: leagueRivals, next: Math.max(0, Math.min(leagueRivals.length, (state?.encounterIndex ?? 0) - encounters.findIndex((encounter) => encounter.kind !== 'gym') + (state?.phase === 'won' ? 1 : 0))) }} />
        ))}
        </RevealWhenLoaded>
        {steps && view === 'route' && (
          <ol className="campaign-steps" aria-label={t.stepsLabel(t.steps[steps.current])}>
            {steps.steps.map((id) => (
              <li key={id} aria-current={id === steps.current ? 'step' : undefined}>
                <span>{id === 'recruit' && steps.pick && id === steps.current ? `${t.steps[id]} ${steps.pick.n}/${steps.pick.total}` : t.steps[id]}</span>
              </li>
            ))}
          </ol>
        )}
        {sidePanels()}
        <div className="campaign-bar" data-panels={panels || undefined}>
          {/* En escritorio, con campaña, las medallas van en la ficha del panel «Tu campaña» (también en el combate). */}
          {(sideOffset === null || state === null) && (
            <ul className="campaign-medals" aria-label={t.medals(badges)}>
              {places.filter((place) => place.gym !== null).map((place) => (
                <li key={place.id}>
                  <img src={emeraldTheme.asset(`medalla-${place.gym}`)} alt={t.medal(t.badges[place.id], (place.gym ?? 0) <= badges)}
                    className={(place.gym ?? 0) <= badges ? undefined : 'campaign-medal-off'} />
                </li>
              ))}
            </ul>
          )}
          {state ? (
            view !== 'route' ? (
              // Solo en los menús y en la pantalla final, que no tiene otra salida (Jose, 12/11/2026, opción A): el combate, el resultado
              // y la evolución tienen su propio camino y ahí se pulsaba sin querer.
              exitButton()
            ) : (
              <button type="button" className="campaign-action" disabled={state.phase !== 'draft' && state.phase !== 'prepare'} onClick={continueCampaign}
                aria-label={t.actionLabel(action, next.gym === null ? t.continueLeague.replace('Continuar: ', '') : t.continueLabel(next.gym).replace('Continuar: ', ''))}>
                {action}
              </button>
            )
          ) : (
            <button type="button" className="campaign-action" onClick={start}>{esCampaign.newCampaign}</button>
          )}
          {panels && secondary()}
        </div>
        {/* Botones secundarios en una fila (Jose, 12/11/2026: apilados no gustaban); con los paneles, junto al principal. */}
        {!panels && state && view === 'route' && <div className="campaign-secondary">{secondary()}</div>}
        {soundOpen && sound && onSoundChange && (
          <Modal title={es.settings.soundTitle} onClose={() => setSoundOpen(false)} className="settings-dialog">
            <SoundSettings settings={sound} onChange={onSoundChange} showTitle={false} />
          </Modal>
        )}
        {choosingDifficulty && <DifficultyDialog onStart={startWith} onCancel={() => setChoosingDifficulty(false)} />}
        {store instanceof LocalCampaignStore && !store.persistent && <p className="fight-hint" role="status">{esCampaign.notSaved}</p>}
      </main>
    </div>
  )
}
