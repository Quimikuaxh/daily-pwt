import { beginCampaignBattle, finishCampaignBattle } from '../core/nuzlocke/battle'
import type { CampaignState } from '../core/nuzlocke/campaign'
import { sameJson } from './json'
import { es } from '../i18n/es'
import { createBattleEngine, type BattleEngine } from './engine'
import type { BattleRequest, CampaignBattleInput, CampaignBattleFinish, CampaignBattleResume, Choice, EngineBattleView, EngineEnd, EngineInit, EngineUpdate } from './protocol'

/** Mensajes del hilo principal al worker. */
export type WorkerCommand = { type: 'init'; init: EngineInit } | { type: 'choose'; choice: Choice } | { type: 'forfeit' }

/** Mensajes del worker al hilo principal. */
export type ClientMessage =
  | { type: 'update'; lines: string[]; view: EngineBattleView; request: BattleRequest | null; ended?: EngineEnd }
  | { type: 'error'; message: string }

/** Protocolo separado: el diario conserva sus comandos y respuestas originales. */
export type CampaignWorkerCommand =
  | { type: 'campaign-prepare'; requestId: string; input: CampaignBattleInput }
  | { type: 'campaign-resume'; requestId: string; input: CampaignBattleResume }
  | { type: 'campaign-choose'; requestId: string; battleSeed: string; choice: Choice }
  | { type: 'campaign-forfeit'; requestId: string; battleSeed: string }
  | { type: 'campaign-finish'; requestId: string; input: CampaignBattleFinish }

export type CampaignClientMessage =
  | { type: 'campaign-prepared'; requestId: string; state: CampaignState; init: EngineInit; update: EngineUpdate }
  | { type: 'campaign-resumed'; requestId: string; battleSeed: string; update: EngineUpdate }
  | { type: 'campaign-update'; requestId: string; battleSeed: string; update: EngineUpdate }
  | { type: 'campaign-finished'; requestId: string; battleSeed: string; state: CampaignState; ended: EngineEnd }
  | { type: 'campaign-error'; requestId: string | null; message: string }

export type BattleWorkerCommand = WorkerCommand | CampaignWorkerCommand
export type BattleWorkerMessage = ClientMessage | CampaignClientMessage

/**
 * Router síncrono, compartido por el worker real y los tests. Conserva solo el motor y su identidad/resultado;
 * la definición y el estado de campaña pertenecen al hilo principal y se reciben al preparar y al cerrar.
 */
export function createWorkerHandler() {
  let engine: BattleEngine | null = null
  let campaignSeed: string | null = null
  let campaignEnd: EngineEnd | null = null

  function handle(command: WorkerCommand): ClientMessage
  function handle(command: CampaignWorkerCommand): CampaignClientMessage
  function handle(command: BattleWorkerCommand): BattleWorkerMessage
  function handle(command: BattleWorkerCommand): BattleWorkerMessage {
    try {
      switch (command.type) {
        case 'campaign-prepare': {
          const { definition, state, preparation, selected } = command.input
          const prepared = beginCampaignBattle(definition, state,
            { ...preparation, unlockedMoves: new Set(preparation.unlockedMoves) }, selected)
          const next = createBattleEngine(prepared.init)
          const update = next.start()
          engine = next
          campaignSeed = prepared.init.battleSeed
          campaignEnd = update.ended ?? null
          return { type: 'campaign-prepared', requestId: command.requestId, ...prepared, update }
        }
        case 'campaign-resume': {
          const { definition, state, battle } = command.input
          const { source, init, decisions, checkpoint } = battle
          const prepared = beginCampaignBattle(definition, source.state,
            { ...source.preparation, unlockedMoves: new Set(source.preparation.unlockedMoves) }, source.selected)
          if (!sameJson(prepared.init, init) || !sameJson(prepared.state, state)) throw new Error('campaign preparation')
          if (checkpoint && (!Number.isInteger(checkpoint.decisions) || checkpoint.decisions < 0 || checkpoint.decisions > decisions.length)) throw new Error('campaign checkpoint')
          const next = createBattleEngine(init)
          let update = next.start()
          const check = (count: number) => {
            if (checkpoint?.decisions === count && !sameJson(checkpoint.update, update)) throw new Error('campaign replay')
          }
          check(0)
          decisions.forEach((decision, index) => {
            if (update.ended) throw new Error('campaign replay ended')
            if (decision.type !== 'move' && decision.type !== 'switch' && decision.type !== 'forfeit') throw new Error('campaign decision')
            update = decision.type === 'forfeit' ? next.forfeit() : next.choose(decision)
            check(index + 1)
          })
          engine = next
          campaignSeed = init.battleSeed
          campaignEnd = update.ended ?? null
          return { type: 'campaign-resumed', requestId: command.requestId, battleSeed: campaignSeed, update }
        }
        case 'campaign-choose':
        case 'campaign-forfeit': {
          if (!engine || campaignSeed === null || command.battleSeed !== campaignSeed) throw new Error('campaign identity')
          const update = command.type === 'campaign-choose' ? engine.choose(command.choice) : engine.forfeit()
          campaignEnd = update.ended ?? null
          return { type: 'campaign-update', requestId: command.requestId, battleSeed: campaignSeed, update }
        }
        case 'campaign-finish': {
          const { definition, state, battleSeed } = command.input
          if (!engine || campaignSeed === null || battleSeed !== campaignSeed || !campaignEnd) throw new Error('campaign result')
          const next = finishCampaignBattle(definition, state, campaignEnd, battleSeed)
          const ended = campaignEnd
          engine = null
          campaignSeed = null
          campaignEnd = null
          return { type: 'campaign-finished', requestId: command.requestId, battleSeed, state: next, ended }
        }
        case 'init':
          engine = createBattleEngine(command.init)
          campaignSeed = null
          campaignEnd = null
          return { type: 'update', ...engine.start() }
        case 'choose':
        case 'forfeit': {
          if (!engine || campaignSeed !== null) return { type: 'error', message: es.errors.engine }
          const update = command.type === 'choose' ? engine.choose(command.choice) : engine.forfeit()
          return { type: 'update', ...update }
        }
      }
    } catch {
      return 'requestId' in command
        ? { type: 'campaign-error', requestId: command.requestId, message: es.errors.engine }
        : { type: 'error', message: es.errors.engine }
    }
  }
  return handle
}
