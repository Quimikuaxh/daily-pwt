import { describe, expect, it } from 'vitest'
import { importScript } from '../src/test-utils/paths'

// UT-191 · Gritos de Esmeralda: fichero del decompilado → especie, y error si falta alguna.
describe('scripts/build-emerald-cries.mjs', () => {
  it('empareja los ficheros con las especies y avisa de las que faltan', async () => {
    const { cryId, planCries } = await importScript('scripts/build-emerald-cries.mjs')
    expect(['ho_oh.wav', 'nidoran_f.wav', 'mr_mime.wav'].map(cryId)).toEqual(['hooh', 'nidoranf', 'mrmime'])
    expect(planCries(['abra.wav', 'ho_oh.wav', 'unused_265.wav'], ['abra', 'hooh'])).toEqual([{ id: 'abra', file: 'abra.wav' }, { id: 'hooh', file: 'ho_oh.wav' }])
    expect(() => planCries(['abra.wav'], ['abra', 'kadabra'])).toThrow(/kadabra/)
  })
})
