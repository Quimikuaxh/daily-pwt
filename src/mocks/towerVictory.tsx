/**
 * Victoria de la Torre Batalla (solo desarrollo: `maquetas.html?v=torre-victoria`): la pantalla real con una serie sorteada con
 * `newTowerRun`. Maqueta aprobada el 17/11/2026 (opción A, docs/maquetas/torre/victoria.png).
 */
import { loadGameData } from '../data/gameData'
import { newTowerRun } from '../core/battle-tower/tower'
import { TowerVictory } from '../ui/battle-tower/TowerVictory'
import '../ui/battle-tower/tower.css'

const data = loadGameData()
const run = { ...newTowerRun('maqueta-victoria', data), phase: 'won' as const, index: 6 }

export function TowerVictoryMock() {
  return (
    <main className="tower-main">
      <TowerVictory data={data} run={run} title="Torre Batalla" playerName="Jose" onNewSeries={() => undefined} onExit={() => undefined} />
    </main>
  )
}
