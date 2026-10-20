import { createWorkerHandler, type ClientMessage, type WorkerCommand } from './messages'

const handle = createWorkerHandler()
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerCommand>) => void) | null
  postMessage(message: ClientMessage): void
}

scope.onmessage = (event) => scope.postMessage(handle(event.data))
