import { describe, expect, it } from 'vitest'
import type { ResolvedSet } from '../../../core/types'
import { createBattleEngine } from '../../../battle/engine'
import type { EngineUpdate } from '../../../battle/protocol'
import { ReplayClient } from '../../../replay/replayClient'
import { encodeReplay, decodeReplay } from '../../../replay/replayCodec'
import type { ReplayData } from '../../../replay/replayData'
import { partyMembers, requestFromView, rivalMembers } from './partyModel'
import { realData, realTeam, realChallenge } from './partyFixtures'

const team: ResolvedSet[] = [realTeam[0], { ...realTeam[0], item: '', nature: 'Brave', moves: [...realTeam[1].moves] }]
const create = () => createBattleEngine({ battleSeed: 'party-identity', playerLead: 1, player: team, rival: team, ai: 'trivial', maxTurns: 50 })

describe('partyModel con especies repetidas', () => {
  it('lee set, objeto, estadísticas y PP por identidad aun al reordenar el request', () => {
    const engine = create()
    const start = engine.start()
    const members = partyMembers(start.request, start.view, realData, team)
    expect(members.map(m => m.itemId)).toEqual([team[1].item, team[0].item])
    expect(members.map(m => m.moves.map(move => move.id))).toEqual([team[1].moves, team[0].moves])
    expect(members[0].stats).not.toEqual(members[1].stats)
    const update = engine.choose({ type: 'switch', slot: 2 })
    expect(partyMembers(update.request, update.view, realData, team).map(m => m.itemId)).toEqual(team.map(set => set.item))
    const used = engine.choose({ type: 'move', slot: 1 })
    const active = partyMembers(used.request, used.view, realData, team).find(m => m.active)!
    const viewActive = used.view.player.team[used.view.player.active]
    expect(active.moves.map(m => m.pp)).toEqual(viewActive.moves?.map(m => m.pp))
    expect(rivalMembers(start.view, realData, team).map(m => m.itemId)).toEqual(team.map(set => set.item))
  })

  it('codec y reproducción conservan identidades y reconstruyen los sets con el inicial cambiado', async () => {
    const engine = create()
    const steps: EngineUpdate[] = [engine.start(), engine.choose({ type: 'switch', slot: 2 })]
    const replay: ReplayData = { version: 1, challenge: { ...realChallenge, playerTeam: team, rivalTeam: team },
      battleSeed: 'party-identity', playerLead: 1, ai: 'trivial',
      steps: steps.map(({ lines, view }) => ({ lines, view })), ended: null }
    const decoded = await decodeReplay(await encodeReplay(replay))
    expect(decoded).toEqual(replay)
    const client = new ReplayClient(decoded.steps)
    let count = 0
    client.subscribe(message => {
      if (message.type !== 'update') return
      const original = steps[count++]
      const request = requestFromView(message.view, team)
      const members = partyMembers(request, message.view, realData, team)
      const expected = partyMembers(original.request, original.view, realData, team)
      expect(members.map(m => [m.itemId, m.stats, m.moves, m.active])).toEqual(
        message.view.player.team.map(mon => {
          const requestIndex = original.request!.side.pokemon.findIndex(p => p.ident.endsWith(`__${mon.teamIndex}`))
          const member = expected[requestIndex]
          return [member.itemId, member.stats, member.moves, member.active]
        }))
      expect(request?.side.pokemon.map(p => p.ident)).toEqual(['p1: ' + team[0].species + '__1', 'p1: ' + team[0].species + '__0'])
    })
    client.init()
    client.next()
    expect(count).toBe(2)
  })
})
