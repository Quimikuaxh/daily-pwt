import { describe, expect, it, vi } from 'vitest'
import { createAudioEngine, crossfadeLoopSeam, LOOP_CROSSFADE_MS, volumeToGain, type AudioContextLike, type AudioIndex } from './audioEngine'

// UT-76 · Motor de sonido (DEC-57) con un AudioContext falso.
const index: AudioIndex = {
  music: {
    'gym-kanto': { path: 'audio/music/gym-kanto.m4a', durationSec: 112, loopStartSec: 26.27, loopEndSec: 70.63 },
    'victory-pwt': { path: 'audio/music/victory-pwt.m4a', durationSec: 38 },
  },
  sfx: { faint: { path: 'audio/sfx/faint.m4a', durationSec: 0.5 } },
}

type FakeSource = { buffer: unknown; loop: boolean; loopStart: number; loopEnd: number; started: boolean; stoppedAt: number | null; connect: () => void; start: () => void; stop: (at?: number) => void }

function fakeContext() {
  const sources: FakeSource[] = []
  const gains: { gain: { value: number; ramps: number[] } }[] = []
  const decoded: string[] = []
  const context = {
    currentTime: 10,
    destination: {},
    state: 'suspended',
    resume: vi.fn(async () => undefined),
    createGain() {
      const gain = {
        value: 1,
        ramps: [] as number[],
        setValueAtTime() {},
        linearRampToValueAtTime(value: number) {
          gain.ramps.push(value)
        },
      }
      const node = { gain, connect() {} }
      gains.push(node)
      return node
    },
    createBufferSource() {
      const source: FakeSource = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        started: false,
        stoppedAt: null,
        connect() {},
        start() {
          source.started = true
        },
        stop(at = 0) {
          source.stoppedAt = at
        },
      }
      sources.push(source)
      return source
    },
    async decodeAudioData(data: ArrayBuffer) {
      const name = new TextDecoder().decode(data)
      decoded.push(name)
      const channel = new Float32Array(48000 * 120)
      return { name, numberOfChannels: 1, sampleRate: 48000, getChannelData: () => channel }
    },
  }
  return { context: context as unknown as AudioContextLike, sources, gains, decoded }
}

function setup(withContext = true) {
  const fake = fakeContext()
  const listeners = new Map<string, () => void>()
  const target = {
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  }
  const fetchBytes = vi.fn(async (url: string) => new TextEncoder().encode(url).buffer as ArrayBuffer)
  const engine = createAudioEngine({ index, baseUrl: '/daily-pwt/', createContext: () => (withContext ? fake.context : null), fetchBytes, unlockTarget: target as unknown as EventTarget })
  const interact = () => listeners.get('pointerdown')?.()
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  return { engine, fake, fetchBytes, listeners, interact, settle }
}

describe('motor de sonido', () => {
  it('no suena nada hasta la primera interacción; la música pedida antes empieza al tocar', async () => {
    const { engine, fake, interact, settle, listeners } = setup()
    engine.playMusic('gym-kanto')
    engine.playSfx('faint')
    await settle()
    expect(fake.sources).toHaveLength(0)
    expect(engine.state().unlocked).toBe(false)
    interact()
    await settle()
    expect(engine.state()).toMatchObject({ unlocked: true, music: 'gym-kanto' })
    expect(fake.sources.filter((source) => source.started)).toHaveLength(1)
    expect(fake.context.resume).toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })

  it('la música de combate va en bucle con sus puntos; el jingle suena una vez', async () => {
    const { engine, fake, interact, settle } = setup()
    interact()
    engine.playMusic('gym-kanto')
    await settle()
    expect(fake.sources[0]).toMatchObject({ loop: true, loopStart: 26.27, loopEnd: 70.63, started: true })
    engine.playMusic('victory-pwt')
    await settle()
    expect(fake.sources[0].stoppedAt).not.toBeNull()
    expect(fake.sources[1]).toMatchObject({ loop: false, started: true })
  })

  it('volumen y silencio en la ganancia maestra, al instante', () => {
    const { engine, fake, interact } = setup()
    interact()
    const master = fake.gains[0].gain
    engine.configure({ volume: 70, muted: false })
    expect(master.value).toBeCloseTo(volumeToGain(70))
    engine.configure({ volume: 70, muted: true })
    expect(master.value).toBe(0)
    engine.configure({ volume: 100, muted: false })
    expect(master.value).toBe(1)
    expect(volumeToGain(0)).toBe(0)
    expect(volumeToGain(150)).toBe(1)
  })

  it('parar la música la funde y no vuelve a sonar aunque llegue tarde la descarga', async () => {
    const { engine, fake, interact, settle } = setup()
    interact()
    engine.playMusic('gym-kanto')
    await settle()
    engine.stopMusic(300)
    expect(fake.sources[0].stoppedAt).toBeCloseTo(10.3)
    expect(fake.gains.some((node) => node.gain.ramps.includes(0))).toBe(true)
    engine.playMusic('victory-pwt')
    engine.stopMusic()
    await settle()
    expect(fake.sources.filter((source) => source.started)).toHaveLength(1)
    expect(engine.state().music).toBeNull()
  })

  it('cada audio se descarga y decodifica una sola vez, con la ruta bajo la raíz del sitio', async () => {
    const { engine, fake, fetchBytes, interact, settle } = setup()
    engine.preload(['gym-kanto'], ['faint'])
    interact()
    engine.playSfx('faint')
    engine.playSfx('faint')
    engine.playMusic('gym-kanto')
    await settle()
    expect(fetchBytes.mock.calls.map(([url]) => url).sort()).toEqual(['/daily-pwt/audio/music/gym-kanto.m4a', '/daily-pwt/audio/sfx/faint.m4a'])
    expect(fake.decoded.sort()).toEqual(['/daily-pwt/audio/music/gym-kanto.m4a', '/daily-pwt/audio/sfx/faint.m4a'])
    expect(fake.sources.filter((source) => source.started)).toHaveLength(3)
  })

  it('el pitido de vida baja va en bucle hasta pedir null; pedido antes de la interacción, empieza al tocar', async () => {
    const { engine, fake, interact, settle } = setup()
    engine.setLoopSfx('faint')
    await settle()
    expect(fake.sources).toHaveLength(0)
    interact()
    await settle()
    expect(fake.sources[0]).toMatchObject({ loop: true, started: true })
    expect(engine.state().loop).toBe('faint')
    engine.setLoopSfx('faint')
    await settle()
    expect(fake.sources).toHaveLength(1)
    engine.setLoopSfx(null)
    await settle()
    expect(fake.sources[0].stoppedAt).not.toBeNull()
    expect(engine.state().loop).toBeNull()
  })

  it('sin Web Audio no hace nada ni lanza; un audio que no se descarga se queda mudo', async () => {
    const { engine, interact, settle } = setup(false)
    interact()
    expect(() => {
      engine.configure({ volume: 50, muted: false })
      engine.preload(['gym-kanto'], ['faint'])
      engine.playMusic('gym-kanto')
      engine.playSfx('faint')
      engine.stopMusic()
    }).not.toThrow()
    const broken = setup()
    broken.fetchBytes.mockRejectedValue(new Error('red'))
    broken.interact()
    broken.engine.playSfx('faint')
    await settle()
    expect(broken.fake.sources).toHaveLength(0)
  })
})

describe('crossfadeLoopSeam', () => {
  it('antes de loopEnd va entrando lo que suena antes de loopStart, para que el salto no corte', () => {
    const rate = 1000
    const data = new Float32Array(10 * rate)
    data.fill(1, 0, 3 * rate)
    data.fill(-1, 3 * rate)
    crossfadeLoopSeam({ numberOfChannels: 1, sampleRate: rate, getChannelData: () => data }, 2, 8)
    const fade = (LOOP_CROSSFADE_MS / 1000) * rate
    expect(data[8 * rate - 1]).toBeCloseTo(1)
    expect(data[8 * rate - fade - 1]).toBe(-1)
    expect(Math.abs(data[8 * rate - fade / 2])).toBeLessThan(0.1)
  })
})
