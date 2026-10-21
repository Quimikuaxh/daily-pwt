import { useEffect, useState } from 'react'
import { newBattleSeed } from './battle/seed'
import type { BattleClient } from './battle/client'
import type { EngineEnd } from './battle/protocol'
import type { Challenge, GameData } from './core/types'
import { readTestHooks } from './testHooks'
import { BattleScreen } from './ui/battle/BattleScreen'
import { preloadBattleImages } from './ui/battle/preloadAssets'
import { ResultScreen } from './ui/result/ResultScreen'
import { TodayScreen } from './ui/today/TodayScreen'

type AppProps = {
  data: GameData | null
  createClient: () => BattleClient
}

type Battle = { challenge: Challenge; leadIndex: number; seed: string; client: BattleClient }

/** DEC-16: today -> battle -> result -> (today | battle), sin router. El combate conserva el reto con el que empezó. */
type Screen =
  | { name: 'today' }
  | { name: 'battle'; battle: Battle }
  | { name: 'result'; challenge: Challenge; leadIndex: number; ended: EngineEnd }

export default function App({ data, createClient }: AppProps) {
  const [hooks] = useState(() => readTestHooks(window.location.search))
  const [screen, setScreen] = useState<Screen>({ name: 'today' })
  const [battlesStarted, setBattlesStarted] = useState(0)

  useEffect(() => preloadBattleImages(), [])

  function startBattle(challenge: Challenge, leadIndex: number) {
    const ordinal = battlesStarted + 1
    setBattlesStarted(ordinal)
    const seed = hooks.seed ? (ordinal === 1 ? hooks.seed : `${hooks.seed}-${ordinal}`) : newBattleSeed()
    setScreen({ name: 'battle', battle: { challenge, leadIndex, seed, client: createClient() } })
  }

  if (screen.name === 'battle') {
    const { battle } = screen
    return (
      <BattleScreen
        key={battle.seed}
        client={battle.client}
        data={data as GameData}
        challenge={battle.challenge}
        playerLead={battle.leadIndex}
        battleSeed={battle.seed}
        ai={hooks.ai}
        onFinish={(ended) => setScreen({ name: 'result', challenge: battle.challenge, leadIndex: battle.leadIndex, ended })}
        onExit={() => setScreen({ name: 'today' })}
      />
    )
  }

  if (screen.name === 'result') {
    const { challenge, leadIndex, ended } = screen
    return (
      <ResultScreen
        ended={ended}
        onBackToToday={() => setScreen({ name: 'today' })}
        onRematch={() => startBattle(challenge, leadIndex)}
      />
    )
  }

  return <TodayScreen data={data} onStart={startBattle} dateOverride={hooks.date} />
}
