import { describe, expect, it } from 'vitest'
import { translateLine } from './translate'
import { realData } from '../ui/battle/party/partyFixtures'

const ctx = { names: realData.names, trainer: { nameEs: 'Petra', category: 'leader', gender: 'F' } } as const
const lines = [
  '|switch|p2a: geodude__1|Geodude, L12|100/100',
  '|drag|p1a: ditto__0|Ditto, L15|50/50',
  '|move|p1a: ditto__0|Transform|p2a: geodude__1',
  '|-transform|p1a: ditto__0|p2a: geodude__1',
  '|-transform|p1a: ditto__0|p2a: missingno__1',
  '|-damage|p1a: ditto__0|10/50|[from] ability: Rough Skin|[of] p2a: geodude__1',
  '|-heal|p1a: ditto__0|20/50|[from] drain|[of] p2a: geodude__1',
  '|-ability|p1a: ditto__0|Sturdy|[from] ability: Trace|[of] p2a: geodude__1',
  '|-item|p1a: ditto__0|Oran Berry|[from] move: Trick|[of] p2a: geodude__1',
  '|-status|p2a: geodude__1|par', '|-curestatus|p2a: geodude__1|par',
  '|-start|p2a: geodude__1|confusion', '|-end|p2a: geodude__1|confusion',
  '|faint|p2a: geodude__1',
]

describe('las identidades no forman parte del texto de combate', () => {
  it.each(lines)('traduce las referencias de %s igual que antes del sufijo', line => {
    const text = translateLine(line, ctx)
    expect(text).not.toBeNull()
    expect(text).not.toMatch(/__\d+|member\d+/)
    expect(text).toBe(translateLine(line.replace(/__\d+/g, ''), ctx))
  })
})
