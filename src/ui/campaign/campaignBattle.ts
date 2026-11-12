/**
 * Combate de campaña (D7) con el presentador del reto diario (`useBattle`): un `BattleClient` sobre `LocalCampaignSession`. Arrancar
 * prepara el combate (o lo reanuda si ya había uno guardado); las decisiones van a la sesión, que guarda antes de enviarlas al worker,
 * y sus respuestas se traducen a los `update` del diario. La intro de Esmeralda no tiene pancarta, iris ni entrada: solo sus frases.
 */
import type { BattleClient, ClientMessage } from '../../battle/client'
import type { LocalCampaignSession } from '../../battle/campaignSession'
import type { CampaignBattleInput, EngineInit } from '../../battle/protocol'
import type { CampaignState } from '../../core/nuzlocke/campaign'
import { campaignMachineMoves } from '../../core/nuzlocke/calendar'
import { campaignMemberMoves } from '../../core/nuzlocke/progression'
import type { INTRO_DURATIONS_MS, SWITCH_DURATIONS_MS } from '../../hooks/useBattle'

export const EMERALD_INTRO: Readonly<Record<keyof typeof INTRO_DURATIONS_MS, number>> = {
  vs: 0, iris: 0, enter: 0, challenge: 1200, rivalSend: 1300, playerSend: 1500,
}

/**
 * Cambio en Esmeralda (`sendOutFrame`, `recallFrame`): la retirada son 33 fotogramas (550 ms) y el envío del jugador, hasta 84
 * (vuelo de la bola de 43 y chispas de 41), así que 1,5 s; con las del PWT (500 y 1100 ms) se cortaban.
 */
export const EMERALD_SWITCH: Readonly<Record<keyof typeof SWITCH_DURATIONS_MS, number>> = { recall: 550, send: 1500 }

/** `useBattle` pide un `EngineInit` para arrancar el cliente; en la campaña lo construye el worker, así que no se usa. */
export const UNUSED_INIT = null as unknown as EngineInit

/** Entrada de `prepare`: alineación de Equipo y PC (el primero sale a combatir) y los movimientos guardados de cada uno. */
export function battleInput(definition: CampaignBattleInput['definition'], state: CampaignState, team: readonly string[]): CampaignBattleInput {
  const movesByMember = Object.fromEntries(team.map((id) => {
    const member = state.members.find((candidate) => candidate.id === id)
    if (!member) throw new Error(`Miembro de campaña no disponible: ${id}`)
    return [id, campaignMemberMoves(definition as never, state, member)]
  }))
  return {
    definition,
    state,
    preparation: { movesByMember, leadId: team[0], unlockedMoves: [...campaignMachineMoves(definition, state)] },
    selected: state.leagueRoster ? undefined : team,
  }
}

/** Arranca el combate: prepararlo o reanudar el guardado. */
export type StartBattle = () => void | Promise<void>

/** Cliente para `useBattle`: `start` prepara o reanuda; elegir y rendirse van a la sesión. */
export function sessionBattleClient(session: LocalCampaignSession, start: () => void | Promise<void>): BattleClient {
  return {
    init: () => { void start() },
    choose: (choice) => { void session.choose(choice) },
    forfeit: () => { void session.forfeit() },
    subscribe: (listener: (message: ClientMessage) => void) => session.subscribe((message) => {
      if (message.type === 'campaign-prepared' || message.type === 'campaign-resumed' || message.type === 'campaign-update') {
        listener({ type: 'update', ...message.update })
      } else if (message.type === 'campaign-error') {
        listener({ type: 'error', message: message.message })
      }
    }),
    terminate: () => undefined,
  }
}
