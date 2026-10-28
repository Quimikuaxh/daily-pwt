import { describe, it, expect } from 'vitest'
import { existsInRoot, importScript, readJson } from '../src/test-utils/paths'

type Manifest = { sources: Record<string, unknown>; music: { id: string; source: string; file: string; loopStartSec?: number; loopEndSec?: number }[]; sfx: { id: string; source: string; entry: string }[] }
type Index = Record<'music' | 'sfx', Record<string, { path: string; durationSec: number; loopStartSec?: number; loopEndSec?: number }>>
type Trainer = { id: string; category: 'leader' | 'champion'; region: string }

const manifest = (): Manifest => readJson('data', 'audio.json')

describe('scripts/build-audio.mjs', () => {
  it('el manifiesto es válido: música por https desde el OST y efectos desde el ZIP', async () => {
    const { planAudio } = await importScript('scripts/build-audio.mjs')
    const plans = planAudio(manifest())
    expect(plans.filter((plan: { kind: string }) => plan.kind === 'music')).toHaveLength(13)
    expect(plans.filter((plan: { kind: string }) => plan.kind === 'sfx')).toHaveLength(18)
    const kanto = plans.find((plan: { id: string }) => plan.id === 'gym-kanto')
    expect(kanto.url).toBe('https://archive.org/download/pkmn-bw2-soundtrack/Disc%202/04%20-%20Battle!%20(Gym%20Leader%20-%20Kanto).flac')
  })

  it('rechaza ids duplicados, ids no seguros y orígenes desconocidos', async () => {
    const { planAudio } = await importScript('scripts/build-audio.mjs')
    const base = manifest()
    const first = base.music[0]
    expect(() => planAudio({ ...base, music: [first, first] })).toThrow(/duplicado/)
    expect(() => planAudio({ ...base, music: [{ ...first, id: '../x' }] })).toThrow(/no válido/)
    expect(() => planAudio({ ...base, sfx: [{ ...base.sfx[0], source: 'inventado' }] })).toThrow(/Origen desconocido/)
    expect(() => planAudio({ ...base, music: [{ ...first, loopEndSec: undefined }] })).toThrow(/bucle/)
    expect(() => planAudio({ ...base, music: [{ ...first, loopStartSec: 30, loopEndSec: 20 }] })).toThrow(/bucle/)
  })

  // UT-75 · Puntos de bucle (DEC-57).
  it('las 10 pistas de combate tienen puntos de bucle dentro de la pista y fuera del fundido; el jingle de victoria, no', () => {
    const index = readJson<Index>('src', 'generated', 'audio-index.json')
    for (const [id, entry] of Object.entries(index.music)) {
      if (id === 'victory-pwt') {
        expect(entry.loopStartSec, id).toBeUndefined()
        continue
      }
      const { loopStartSec = NaN, loopEndSec = NaN, durationSec } = entry
      // Más de 30 s: el tema de rival de Cheren (Negro y Blanco) da la vuelta cada 38 s; los de N2/B2, cada 44 s o más.
      expect(loopEndSec - loopStartSec, id).toBeGreaterThan(30)
      expect(loopStartSec, id).toBeGreaterThan(5)
      expect(loopEndSec, id).toBeLessThan(durationSec - 10)
    }
  })

  it('cada entrenador tiene su tema (el suyo propio, o `gym-<región>` o `champion-<región>`) y todo el audio está generado', async () => {
    const { trainerMusicOf } = await importScript('scripts/build-audio.mjs')
    const index = readJson<Index & { trainers: Record<string, string> }>('src', 'generated', 'audio-index.json')
    const trainers = readJson<{ trainers: Trainer[] }>('data', 'trainers.json').trainers
    expect(trainers.length).toBeGreaterThan(50)
    for (const trainer of trainers) {
      expect(index.music[index.trainers[trainer.id] ?? `${trainer.category === 'leader' ? 'gym' : 'champion'}-${trainer.region}`], trainer.id).toBeDefined()
    }
    // Temas propios (Jose, 28/10/2026): Mirto y Cheren, con los de Negro y Blanco.
    expect(index.trainers).toEqual({ mirto: 'champion-alder', cheren: 'rival-cheren' })
    expect(() => trainerMusicOf({ ...manifest(), trainers: { mirto: 'inventado' } } as never)).toThrow(/Tema desconocido/)
    const ids = { music: manifest().music.map((item) => item.id), sfx: manifest().sfx.map((item) => item.id) }
    for (const kind of ['music', 'sfx'] as const) {
      expect(Object.keys(index[kind]).sort()).toEqual([...ids[kind]].sort())
      for (const entry of Object.values(index[kind])) {
        expect(existsInRoot('public', entry.path), entry.path).toBe(true)
        expect(entry.durationSec).toBeGreaterThan(0)
      }
    }
  })
})
