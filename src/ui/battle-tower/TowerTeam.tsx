import { useMemo } from 'react'
import type { GameData } from '../../core/types'
import type { TowerRun } from '../../core/battle-tower/tower'
import { calcStats } from '../../core/stats'
import { esTower as t } from '../../i18n/esTower'
import { partyMembers } from '../battle/party/partyModel'
import { PartyScreen } from '../battle/party/PartyScreen'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'

type Props = {
  /** Título de la página: va dentro de la columna de la consola para alinearse con su borde izquierdo. */
  title: string
  data: GameData
  run: TowerRun
  onOrder: (ids: string[]) => void
  onStart: () => void
  onExit: () => void
}

const RESERVED_HEIGHT = 172

export function TowerTeam({ title, data, run, onOrder, onStart, onExit }: Props) {
  const members = useMemo(() => {
    const pokemon = run.team.map((set, index) => {
      const species = data.dex.species[set.species]
      const hp = species ? calcStats(species.baseStats, set.ivs, set.evs, set.nature, set.level).hp : 0
      return {
        ident: `p1: ${set.species}`,
        details: `${set.species}, L${set.level}${set.gender ? `, ${set.gender}` : ''}`,
        condition: `${hp}/${hp}`, active: index === 0,
      }
    })
    return partyMembers({ side: { id: 'p1', name: '', pokemon } }, null, data, run.team)
  }, [data, run.team])

  function swap(fromSlot: number, toSlot: number) {
    const from = fromSlot - 1
    const to = toSlot - 1
    const order = run.team.map(member => member.species)
    if (!order[from] || !order[to]) return
    const moved = order[from]
    order[from] = order[to]
    order[to] = moved
    onOrder(order)
  }

  return (
    <div className="tower-team-console">
      <h1>{title}</h1>
      <ConsoleStage theme={n2b2Theme} reservedHeight={RESERVED_HEIGHT} screens={[]} whole={
        <PartyScreen members={members} data={data} forced={false} enabled onChoose={() => {}} onClose={onExit}
          readOnly={{ prompt: t.drag, label: t.team }}
          reorder={{ action: t.move, destination: t.destination, onSwap: swap }} />
      } />
      <button type="button" className="btn btn-primary" onClick={onStart}>{t.start}</button>
    </div>
  )
}
