import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { createWorkerClient } from './battle/client'
import { createWarmClientFactory } from './battle/warmClient'
import { cloudConfig } from './cloud/config'
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

/** F4: Supabase y su capa van en otro fichero, fuera de la ruta crítica (E2E-21). Sin configuración, nada. */
function loadCloudIfConfigured() {
  const config = cloudConfig()
  return config ? import('./cloud/supabaseCloud').then((module) => module.loadCloud(config)) : null
}

const clients = createWarmClientFactory(createWorkerClient)
const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 800))
idle(() => clients.warmUp())
// Las ventanas de la cabecera van aparte (E2E-21); se traen en reposo para que abrirlas sea inmediato.
idle(() => {
  void import('./ui/stats/StatsDialog')
  void import('./ui/menu/HelpDialog')
  void import('./ui/menu/SettingsDialog')
})

// Sin StrictMode a propósito: doble montaje de BattleScreen terminaría el worker del combate en el primer montaje.
createRoot(document.getElementById('root') as HTMLElement).render(<App data={loadDataOrNull()} createClient={clients.take} cloud={loadCloudIfConfigured()} />)
