/**
 * Victoria de la Torre Batalla (solo desarrollo): la pantalla real con datos sorteados. `maquetas.html?v=torre-victoria`, la de una serie
 * (maqueta A, docs/maquetas/torre/victoria.png); `?v=torre-final`, la de los 53 (maqueta A, docs/maquetas/torre/victoria-final.png).
 */
import { loadGameData } from '../data/gameData'
import { newTowerRun, towerTrainerTotal } from '../core/battle-tower/tower'
import { TowerVictory } from '../ui/battle-tower/TowerVictory'
import '../ui/battle-tower/tower.css'

const data = loadGameData()
const run = { ...newTowerRun('maqueta-victoria', data), phase: 'won' as const, index: 6 }
// Racha completa de ejemplo: los demás entrenadores como vencidos antes de la serie final.
const total = towerTrainerTotal(data)
const others = data.trainers.filter((trainer) => (trainer.category === 'leader' || trainer.category === 'champion') && trainer.variants.length > 0
  && !run.rivals.some((rival) => rival.trainer.id === trainer.id)).map((trainer) => trainer.id)
const complete = { ...run, series: 7, beaten: others }

export function TowerVictoryMock({ final = false }: { final?: boolean }) {
  return (
    <main className="tower-main">
      <TowerVictory data={data} run={final ? complete : run} title="Torre Batalla" playerName="Jose" beaten={final ? total : 7} total={total}
        onContinue={final ? undefined : () => undefined} onNewSeries={() => undefined} onExit={() => undefined} />
    </main>
  )
}
