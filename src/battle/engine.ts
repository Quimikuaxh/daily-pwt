import { Battle, Dex, extractChannelMessages, type Pokemon, type PokemonSet, type Side } from '@pkmn/sim'
import { toId } from '../core/id'
import { Prng } from '../core/prng'
import type { ResolvedSet } from '../core/types'
import { buildAiState } from './ai/state'
import { aiSeed, chooseRivalAction } from './ai/heuristic'
import { chooseTrivialAction } from './ai/trivial'
import { evaluateEnd, forfeitBattle } from './end'
import type { BattleRequest, Choice, EngineBattleView, EngineEnd, EngineInit, EngineUpdate, MonView } from './protocol'
import { hpPercentOf } from './viewReducer'

// Formato de depuración sin Team Preview (DEC-09). Reglas ausentes a propósito: sin cláusula de sueño, de KO en un golpe, de especie ni de objeto.
const BATTLE_FORMAT = 'gen5customgame@@@!teampreview'
const PLAYER_NAME = 'Jugador'
const RIVAL_NAME = 'Rival'
const PLAYER_VIEWER_CHANNEL = 1
const MAX_CONSECUTIVE_AI_TURNS = 50

// `|debug|` y `|raw|` son ruido del formato de depuración; `|t:|` lleva la hora real y rompería el determinismo del log.
const DROPPED_LINE = /^\|(debug|raw|split|t:)\|/

export type BattleEngine = {
  start(): EngineUpdate
  choose(choice: Choice): EngineUpdate
  forfeit(): EngineUpdate
}

/**
 * El nombre del Pokémon en el simulador es el id de su especie (`rotommow`): con el nombre de la especie, el simulador quita la forma
 * («Rotom-Mow» -> «Rotom») y el registro no casaba con la especie (la barra de PS no bajaba y los mensajes decían «Rotom»). Con el id,
 * `toId` de la línea da la especie exacta y su nombre en español.
 */
function toSimSet(set: ResolvedSet): PokemonSet {
  const speciesName = Dex.species.get(set.species).name || set.species
  return {
    name: toId(set.species),
    species: speciesName,
    item: set.item,
    ability: set.ability,
    moves: [...set.moves],
    nature: set.nature,
    gender: set.gender ?? '',
    evs: { ...set.evs },
    ivs: { ...set.ivs },
    level: set.level,
    shiny: false,
  } as PokemonSet
}

/** Semilla del simulador (cuatro enteros de 16 bits) derivada de la cadena de semilla del combate. */
function simSeed(battleSeed: string): [number, number, number, number] {
  const prng = new Prng(`${battleSeed}:sim`)
  return [prng.nextInt(65536), prng.nextInt(65536), prng.nextInt(65536), prng.nextInt(65536)]
}

function withLeadFirst<T>(team: readonly T[], leadIndex: number): T[] {
  return [team[leadIndex], ...team.filter((_, index) => index !== leadIndex)]
}

function describeChoice(choice: Choice): string {
  if ((choice.type !== 'move' && choice.type !== 'switch') || !Number.isInteger(choice.slot) || choice.slot < 1) {
    throw new Error('La elección no es válida: indica un movimiento o un cambio y una posición a partir de 1.')
  }
  return `${choice.type} ${choice.slot}`
}

/** Motor de combate síncrono sobre el `Battle` de @pkmn/sim. Funciona igual en el worker y en Node. */
export function createBattleEngine(init: EngineInit): BattleEngine {
  const playerLead = init.playerLead ?? 0
  if (!Number.isInteger(playerLead) || playerLead < 0 || playerLead >= init.player.length) {
    throw new Error('El Pokémon inicial elegido no está en el equipo.')
  }
  const playerTeam = withLeadFirst(init.player, playerLead)

  const battle = new Battle({ formatid: BATTLE_FORMAT as never, seed: simSeed(init.battleSeed) as never })
  battle.reportExactHP = false
  battle.reportPercentages = true
  battle.setPlayer('p1', { name: PLAYER_NAME, team: playerTeam.map(toSimSet) })
  battle.setPlayer('p2', { name: RIVAL_NAME, team: init.rival.map(toSimSet) })

  const playerSide = battle.sides[0]
  const rivalSide = battle.sides[1]
  // La vista usa un orden fijo (el inicial); el sim reordena `side.pokemon` tras cada cambio.
  const playerRoster: Pokemon[] = [...playerSide.pokemon]
  const rivalRoster: Pokemon[] = [...rivalSide.pokemon]
  const rosterSpecies = (roster: Pokemon[], team: ResolvedSet[]) => new Map(roster.map((pokemon, index) => [pokemon, team[index].species]))
  const playerSpecies = rosterSpecies(playerRoster, playerTeam)
  const rivalSpecies = rosterSpecies(rivalRoster, init.rival)

  const aiRng = new Prng(aiSeed(init.battleSeed))
  let sentLogPosition = 0
  let forfeited = false
  let finalUpdate: EngineUpdate | null = null

  /**
   * Muro Mágico evita el daño de Drenadoras sin que el simulador lo diga: el turno acababa sin ningún mensaje y no se entendía por qué
   * no drenaba (decisión de Jose, 27/10/2026). Línea propia, antes de `|upkeep`, por cada Pokémon activo sembrado, con Muro Mágico y con
   * quien lo sembró aún en pie (las mismas condiciones del drenaje en el simulador).
   */
  function magicGuardLeechSeedLines(): string[] {
    return [playerSide, rivalSide].flatMap((side) => {
      const pokemon = side.active[0]
      const seed = pokemon?.volatiles['leechseed']
      if (!pokemon || !seed || pokemon.fainted || pokemon.hp <= 0 || !pokemon.hasAbility('magicguard')) return []
      const source = battle.getAtSlot(seed.sourceSlot)
      if (!source || source.fainted || source.hp <= 0) return []
      return [`|-activate|${pokemon.getSlot()}: ${pokemon.name}|ability: Magic Guard|[leechseed]`]
    })
  }

  function takeNewLines(): string[] {
    const chunk = battle.log.slice(sentLogPosition).join('\n')
    sentLogPosition = battle.log.length
    if (!chunk) return []
    const lines = extractChannelMessages(chunk, [PLAYER_VIEWER_CHANNEL])[PLAYER_VIEWER_CHANNEL].filter((line) => !DROPPED_LINE.test(line))
    const upkeep = lines.indexOf('|upkeep')
    if (upkeep >= 0) lines.splice(upkeep, 0, ...magicGuardLeechSeedLines())
    return lines
  }

  function sideView(side: Side, roster: Pokemon[], species: Map<Pokemon, string>, exact: boolean): EngineBattleView['player'] {
    const team: MonView[] = roster.map((pokemon) => {
      const fainted = pokemon.hp <= 0
      const view: MonView = {
        species: species.get(pokemon)!,
        hpPercent: hpPercentOf(pokemon.hp, pokemon.maxhp),
        status: fainted ? null : pokemon.status || null,
        fainted,
      }
      if (exact) {
        view.hp = pokemon.hp
        view.maxHp = pokemon.maxhp
      }
      if (pokemon.volatiles['substitute']) view.substitute = true
      // PP de los dos bandos (los del rival, para el botón RIVAL: decisión de Jose). Los del simulador ya cuentan Presión.
      view.moves = pokemon.moveSlots.map((slot) => ({ id: slot.id, pp: slot.pp, maxPp: slot.maxpp }))
      return view
    })
    return { remaining: team.filter((mon) => !mon.fainted).length, active: roster.indexOf(side.active[0]), team }
  }

  function buildView(): EngineBattleView {
    return {
      turn: battle.turn,
      weather: battle.field.weather || null,
      weatherTurns: battle.field.weather ? battle.field.weatherState.duration || null : null,
      player: sideView(playerSide, playerRoster, playerSpecies, true),
      rival: sideView(rivalSide, rivalRoster, rivalSpecies, false),
    }
  }

  function playerRequest(): BattleRequest | null {
    if (battle.ended || !playerSide.requestState) return null
    return JSON.parse(JSON.stringify(playerSide.activeRequest)) as BattleRequest
  }

  function rivalFainted(): number {
    return rivalRoster.filter((pokemon) => pokemon.hp <= 0).length
  }

  /** `playerRoster` va con el inicial delante: se devuelve al orden del equipo del reto. */
  function playerFaintedInTeamOrder(): boolean[] {
    const teamIndexes = [playerLead, ...init.player.map((_, index) => index).filter((index) => index !== playerLead)]
    const fainted = init.player.map(() => false)
    playerRoster.forEach((pokemon, rosterIndex) => {
      fainted[teamIndexes[rosterIndex]] = pokemon.hp <= 0
    })
    return fainted
  }

  function currentEnd(): EngineEnd | null {
    const winner = battle.winner === PLAYER_NAME ? 'player' : battle.winner === RIVAL_NAME ? 'rival' : 'tie'
    const ended = evaluateEnd(
      {
        ended: battle.ended,
        winner: battle.ended ? winner : null,
        turn: battle.turn,
        playerAlive: playerRoster.filter((pokemon) => pokemon.hp > 0).length,
        rivalFainted: rivalFainted(),
        forfeited,
      },
      init.maxTurns,
    )
    return ended ? { ...ended, playerFainted: playerFaintedInTeamOrder() } : null
  }

  function snapshotUpdate(): EngineUpdate {
    const ended = currentEnd()
    const update: EngineUpdate = { lines: takeNewLines(), view: buildView(), request: ended ? null : playerRequest() }
    if (ended) {
      update.ended = ended
      finalUpdate = update
    }
    return update
  }

  function makeRivalChoice(): void {
    const request = rivalSide.activeRequest as BattleRequest
    const choice = init.ai === 'trivial' ? chooseTrivialAction(request) : chooseRivalAction(buildAiState(battle), aiRng)
    // Una decisión de la IA que el sim rechaza no puede dejar la partida colgada: se deja que el sim elija.
    if (!rivalSide.choose(describeChoice(choice))) rivalSide.autoChoose()
  }

  /** Mientras solo el rival tenga que decidir (sustituto tras un KO, Ida y Vuelta...), la IA responde sin esperar al jugador. */
  function resolveRivalOnlyRequests(): void {
    for (let guard = 0; guard < MAX_CONSECUTIVE_AI_TURNS; guard++) {
      if (battle.ended || !rivalSide.requestState || playerSide.requestState) return
      makeRivalChoice()
      battle.commitChoices()
    }
    throw new Error('El rival no ha terminado de decidir: el combate se ha detenido.')
  }

  return {
    start() {
      resolveRivalOnlyRequests()
      return snapshotUpdate()
    },

    choose(choice) {
      if (finalUpdate) return finalUpdate
      const text = describeChoice(choice)
      if (!playerSide.requestState) throw new Error('Ahora no se puede elegir: no hay ninguna decisión pendiente.')
      const couldBeTrapped = Boolean(playerRequest()?.active?.[0]?.maybeTrapped)
      if (!playerSide.choose(text)) {
        // Con una captura oculta (Magnet Pull...) el sim rechaza el cambio y vuelve a pedir la decisión, ya con `trapped`: no es un fallo.
        if (couldBeTrapped && choice.type === 'switch') return snapshotUpdate()
        throw new Error('La elección no es válida en este momento del combate.')
      }
      if (rivalSide.requestState) makeRivalChoice()
      battle.commitChoices()
      resolveRivalOnlyRequests()
      return snapshotUpdate()
    },

    forfeit() {
      if (finalUpdate) return finalUpdate
      forfeited = true
      forfeitBattle(battle)
      return snapshotUpdate()
    },
  }
}
