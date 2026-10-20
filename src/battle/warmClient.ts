import type { BattleClient, ClientMessage } from './client'

const REWARM_DELAY_MS = 5000

/**
 * El worker carga ~1 MB gzip del simulador (ARQUITECTURA §8): se crea por adelantado, tras pintar Hoy, para que
 * "Combatir" no espere a la descarga. Cada combate usa un worker propio y desechable; al entregar uno se prepara el siguiente.
 * Un fallo del worker antes de que nadie escuche se guarda y se entrega al primer suscriptor.
 */
export function createWarmClientFactory(createClient: () => BattleClient): { warmUp: () => void; take: () => BattleClient } {
  let spare: BattleClient | null = null

  function prepareSpare(): BattleClient {
    const client = createClient()
    const earlyMessages: ClientMessage[] = []
    const stopCollecting = client.subscribe((message) => earlyMessages.push(message))
    return {
      ...client,
      subscribe(listener) {
        stopCollecting()
        earlyMessages.forEach(listener)
        return client.subscribe(listener)
      },
    }
  }

  function warmUp() {
    spare ??= prepareSpare()
  }

  return {
    warmUp,
    take() {
      const client = spare ?? prepareSpare()
      spare = null
      setTimeout(warmUp, REWARM_DELAY_MS)
      return client
    },
  }
}
