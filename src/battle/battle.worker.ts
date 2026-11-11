import { createWorkerHandler, type BattleWorkerMessage, type BattleWorkerCommand } from './messages'

const handle = createWorkerHandler()
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BattleWorkerCommand>) => void) | null
  postMessage(message: BattleWorkerMessage): void
}

scope.onmessage = (event) => scope.postMessage(handle(event.data))
