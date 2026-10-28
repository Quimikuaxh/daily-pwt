import type { BattleClient, ClientMessage } from '../battle/client'
import type { AiKind, EngineEnd } from '../battle/protocol'
import type { Challenge } from '../core/types'

type UpdateMessage = Extract<ClientMessage, { type: 'update' }>

/** Un paso de la repetición: lo que el motor mandó a la pantalla (líneas ya filtradas y estado tras el paso), sin la petición. */
export type ReplayStep = Omit<UpdateMessage, 'request' | 'type'>

/**
 * Repetición de un oficial (F5, DEC-67): el reto con los dos equipos, lo necesario para montar la pantalla igual (inicial, semilla para el
 * avatar) y los pasos. No vuelve a simular: se ve igual aunque cambien los datos o `@pkmn/sim`.
 */
export type ReplayData = {
  version: 1
  challenge: Challenge
  playerLead: number
  battleSeed: string
  ai: AiKind
  steps: ReplayStep[]
  ended: EngineEnd | null
}

/**
 * Envuelve el cliente del combate y apunta cada paso que llega a la pantalla. Al reanudar un oficial, el motor vuelve a emitir todos los
 * pasos desde el principio, así que la grabación queda completa también tras recargar.
 */
export function recordingClient(client: BattleClient): { client: BattleClient; steps: () => ReplayStep[] } {
  let steps: ReplayStep[] = []
  return {
    steps: () => steps,
    // Métodos delegados uno a uno: el cliente puede ser una clase y `...client` no copiaría sus métodos.
    client: {
      choose: (choice) => client.choose(choice),
      forfeit: () => client.forfeit(),
      terminate: () => client.terminate(),
      init(init) {
        steps = []
        client.init(init)
      },
      subscribe(listener) {
        return client.subscribe((message) => {
          if (message.type === 'update') steps.push({ lines: message.lines, view: message.view, ...(message.ended ? { ended: message.ended } : {}) })
          listener(message)
        })
      },
    },
  }
}
