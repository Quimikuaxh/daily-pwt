import { describe, expect, it } from 'vitest'
import { createWorkerClient, type WorkerLike } from '../battle/client'
import { createWorkerHandler } from '../battle/messages'
import { recordingClient, type ReplayData } from './replayData'
import { encodeReplay, decodeReplay } from './replayCodec'
import { realChallenge } from '../ui/battle/party/partyFixtures'
import { filler } from '../test-utils/teams'
import { shareText } from '../ui/share/shareText'
import { replayLink } from '../ui/replay/replayLink'
import type { DayRecord } from '../storage/gameStore'

describe('identidades al guardar y compartir repeticiones', () => {
  it('guarda el sufijo solo en referencias de protocolo y conserva nombres y metadatos limpios', async () => {
    const handler = createWorkerHandler()
    const worker: WorkerLike = { onmessage: null, onerror: null, onmessageerror: null, terminate() {},
      postMessage(command) { this.onmessage?.({ data: handler(structuredClone(command)) } as MessageEvent) } }
    const recording = recordingClient(createWorkerClient(() => worker))
    recording.client.subscribe(() => {})
    const team = [filler('geodude'), filler('geodude')]
    recording.client.init({ battleSeed: 'public-identities', player: team, rival: team, ai: 'trivial', maxTurns: 10 })
    recording.client.choose({ type: 'switch', slot: 2 })
    recording.client.forfeit()
    const steps = recording.steps()
    const ended = steps.at(-1)!.ended!
    const replay: ReplayData = { version: 1, challenge: { ...realChallenge, playerTeam: team, rivalTeam: team },
      battleSeed: 'public-identities', ai: 'trivial', playerLead: 0, steps, ended }
    const decoded = await decodeReplay(await encodeReplay(replay))
    expect(decoded).toEqual(replay)
    expect(JSON.stringify(decoded.challenge)).not.toMatch(/__\d+|member\d+/)
    expect(JSON.stringify(decoded)).not.toMatch(/member\d+/)
    expect(decoded.steps.flatMap(step => step.lines).join('\n')).toMatch(/geodude__1/)
    for (const step of decoded.steps) {
      expect(step).not.toHaveProperty('request')
      expect(Object.keys(step).sort()).toEqual((step.ended ? ['ended', 'lines', 'view'] : ['lines', 'view']).sort())
      expect(JSON.stringify(step.view)).not.toMatch(/__\d+/)
      for (const line of step.lines) {
        expect(line.replace(/p[12][a-c]?: [a-z0-9]+__\d+/g, 'reference')).not.toMatch(/__\d+/)
      }
    }
    const record: DayRecord = { date: realChallenge.date, challengeNumber: realChallenge.number,
      trainerId: realChallenge.trainer.id, variantId: realChallenge.variant.id, dataVersion: realChallenge.dataVersion,
      status: 'lost', startedAt: '2026-11-10T10:00:00Z', finishedAt: '2026-11-10T10:01:00Z',
      turns: ended.turns, survivors: ended.playerAlive, rivalFainted: ended.rivalFainted,
      playerFainted: ended.playerFainted, endReason: ended.reason, voidReason: null, battle: null }
    const text = shareText(record, 0)!
    expect(text).toContain('Daily PWT')
    expect(text).not.toMatch(/__\d+|geodude|member\d+/i)
    const link = replayLink('abcdefghij')
    expect(link).toContain('?replay=abcdefghij')
    expect(link).not.toMatch(/__\d+|geodude|member\d+/i)
  })
})
