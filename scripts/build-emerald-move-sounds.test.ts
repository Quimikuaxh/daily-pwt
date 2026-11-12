import { describe, expect, it } from 'vitest'
import { importScript, readJson } from '../src/test-utils/paths'

// UT-205 (Jose, 12/11/2026): sonidos de los ataques sacados de los guiones de animación de pokeemerald.
describe('scripts/build-emerald-move-sounds.mjs', () => {
  it('toma los efectos con su fotograma, sigue saltos, llamadas, bucles y ramas de dos turnos', async () => {
    const { parseBlocks, soundsOf, sfxId, parseSongs } = await importScript('scripts/build-emerald-move-sounds.mjs')
    const blocks = parseBlocks([
      'Move_A:', '\tplaysewithpan SE_M_SWIFT, SOUND_PAN_ATTACKER', '\tdelay 10', '\tcall Sub', '\tloopsewithpan SE_M_HIT, SOUND_PAN_TARGET, 4, 2', '\tend',
      'Sub:', '\twaitforvisualfinish', '\tplaysewithpan SE_M_SWAGGER, 0', '\treturn',
      'Move_B:', '\tchoosetwoturnanim BSetUp, BHit', 'BSetUp:', '\tplaysewithpan SE_M_X, 0', '\tend', 'BHit:', '\tdelay 3', '\tpanse SE_M_SURF, 0, 0, +2, 0', '\tend',
    ].join('\n'))
    expect(soundsOf(blocks, 'Move_A').out).toEqual([[0, 'SE_M_SWIFT'], [22, 'SE_M_SWAGGER'], [22, 'SE_M_HIT'], [26, 'SE_M_HIT']])
    expect(soundsOf(blocks, 'Move_B').out).toEqual([[3, 'SE_M_SURF']])
    expect(sfxId('SE_M_MEGA_KICK2')).toBe('emerald-se-m-mega-kick2')
    expect(parseSongs('#define SE_M_SURF 160 // x')).toEqual({ SE_M_SURF: 160 })
  })

  it('el mapa generado solo usa efectos del manifiesto de audio', () => {
    const sounds = readJson('src', 'generated', 'emerald', 'move-sounds.json') as Record<string, [number, string][]>
    const ids = new Set((readJson('data', 'audio.json') as { sfx: { id: string }[] }).sfx.map((item) => item.id))
    expect(Object.keys(sounds).length).toBeGreaterThan(300)
    for (const list of Object.values(sounds)) for (const [frame, id] of list) { expect(ids.has(id)).toBe(true); expect(frame).toBeGreaterThanOrEqual(0) }
    expect(sounds.tackle).toEqual([[6, 'emerald-se-m-comet-punch']])
  })
})
