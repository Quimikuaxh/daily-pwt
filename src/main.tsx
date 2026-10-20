import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { createWorkerClient } from './battle/client'
import { createWarmClientFactory } from './battle/warmClient'
import { loadGameData } from './data/gameData'
import type { GameData } from './core/types'

function loadDataOrNull(): GameData | null {
  try {
    return loadGameData()
  } catch {
    // Hoy enseña el error de datos en español (REQUISITOS §5); no hay nada más que hacer aquí.
    return null
  }
}

const clients = createWarmClientFactory(createWorkerClient)
const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 800))
idle(() => clients.warmUp())

// Sin StrictMode a propósito: doble montaje de BattleScreen terminaría el worker del combate en el primer montaje.
createRoot(document.getElementById('root') as HTMLElement).render(<App data={loadDataOrNull()} createClient={clients.take} />)
