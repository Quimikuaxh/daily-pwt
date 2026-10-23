/**
 * Motor de sonido (DEC-57): Web Audio con un `AudioContext` que se crea (o se reanuda) en la primera interacción del usuario, una
 * ganancia maestra con el volumen y el silencio de Ajustes, y otra para la música (sus fundidos). Música y efectos se descargan solo
 * cuando se piden (o se precargan) y se guardan decodificados por id. Sin Web Audio (tests, navegadores viejos) no hace nada ni lanza.
 */

export type MusicEntry = { path: string; durationSec: number; loopStartSec?: number; loopEndSec?: number }
export type SfxEntry = { path: string; durationSec: number }
export type AudioIndex = { music: Record<string, MusicEntry>; sfx: Record<string, SfxEntry> }

/** Lo que el motor usa de Web Audio: así los tests pueden darle uno falso. */
export type AudioContextLike = Pick<BaseAudioContext, 'currentTime' | 'destination' | 'state' | 'createGain' | 'createBufferSource' | 'decodeAudioData'> & {
  resume: () => Promise<void>
}

type Options = {
  index: AudioIndex
  /** Raíz del sitio (`import.meta.env.BASE_URL`, `/daily-pwt/`). */
  baseUrl: string
  /** Crea el contexto; `null` si el navegador no tiene Web Audio. */
  createContext: () => AudioContextLike | null
  fetchBytes: (url: string) => Promise<ArrayBuffer>
  /** Dónde se escucha la primera interacción (`window`). */
  unlockTarget: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null
}

/** Fundido en la costura del bucle: los últimos ms antes de `loopEnd` se mezclan con lo que suena antes de `loopStart` (DEC-57). */
export const LOOP_CROSSFADE_MS = 40
/** Fundido al parar la música si no se pide otro. */
export const DEFAULT_FADE_MS = 400
const UNLOCK_EVENTS = ['pointerdown', 'keydown'] as const

/** Volumen de Ajustes (0-100) a ganancia: curva cuadrática, que se percibe más pareja que la lineal. */
export const volumeToGain = (volume: number): number => (Math.min(100, Math.max(0, volume)) / 100) ** 2

/**
 * Prepara la costura del bucle en el propio buffer: en los `LOOP_CROSSFADE_MS` anteriores a `loopEnd` va entrando lo que suena antes de
 * `loopStart`. Al saltar de `loopEnd` a `loopStart` la señal sigue sin corte aunque las dos vueltas del OST no sean idénticas.
 */
export function crossfadeLoopSeam(buffer: Pick<AudioBuffer, 'numberOfChannels' | 'sampleRate' | 'getChannelData'>, loopStartSec: number, loopEndSec: number): void {
  const rate = buffer.sampleRate
  const fade = Math.round((LOOP_CROSSFADE_MS / 1000) * rate)
  const start = Math.round(loopStartSec * rate)
  const end = Math.round(loopEndSec * rate)
  if (start < fade || end <= start) return
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    if (end > data.length) return
    for (let i = 0; i < fade; i += 1) {
      const weight = (i + 1) / fade
      data[end - fade + i] = data[end - fade + i] * (1 - weight) + data[start - fade + i] * weight
    }
  }
}

export function createAudioEngine({ index, baseUrl, createContext, fetchBytes, unlockTarget }: Options) {
  let context: AudioContextLike | null = null
  let master: GainNode | null = null
  let musicGain: GainNode | null = null
  let volume = 70
  let muted = false
  let unlocked = false
  /** Pista pedida (suene ya o espere a la interacción o a la descarga). */
  let wantedMusic: string | null = null
  let playing: { id: string; source: AudioBufferSourceNode; gain: GainNode } | null = null
  const bytes = new Map<string, Promise<ArrayBuffer | null>>()
  const buffers = new Map<string, Promise<AudioBuffer | null>>()

  const entryOf = (key: string): MusicEntry | SfxEntry | undefined => {
    const [kind, id] = key.split(':') as ['music' | 'sfx', string]
    return index[kind]?.[id]
  }

  function bytesOf(key: string): Promise<ArrayBuffer | null> {
    let pending = bytes.get(key)
    if (!pending) {
      const entry = entryOf(key)
      pending = entry ? fetchBytes(baseUrl + entry.path).catch(() => null) : Promise.resolve(null)
      bytes.set(key, pending)
    }
    return pending
  }

  /** Decodifica una vez por id (hace falta el contexto). Un fallo de red o de formato deja ese sonido mudo, sin romper nada. */
  function bufferOf(key: string): Promise<AudioBuffer | null> {
    const ctx = context
    if (!ctx) return Promise.resolve(null)
    let pending = buffers.get(key)
    if (!pending) {
      pending = bytesOf(key).then(async (data) => {
        if (!data) return null
        try {
          // decodeAudioData se queda con el ArrayBuffer: se le pasa una copia para poder decodificar otra vez si hiciera falta.
          const buffer = await ctx.decodeAudioData(data.slice(0))
          const entry = entryOf(key) as MusicEntry | undefined
          if (entry?.loopStartSec !== undefined && entry.loopEndSec !== undefined) crossfadeLoopSeam(buffer, entry.loopStartSec, entry.loopEndSec)
          return buffer
        } catch {
          return null
        }
      })
      buffers.set(key, pending)
    }
    return pending
  }

  function applyVolume() {
    if (master) master.gain.value = muted ? 0 : volumeToGain(volume)
  }

  function startWantedMusic() {
    const id = wantedMusic
    if (!id || !context || playing?.id === id) return
    void bufferOf(`music:${id}`).then((buffer) => {
      const ctx = context
      if (!buffer || !ctx || !musicGain || wantedMusic !== id || playing?.id === id) return
      stopPlaying(0)
      const entry = index.music[id]
      const source = ctx.createBufferSource()
      source.buffer = buffer
      if (entry?.loopStartSec !== undefined && entry.loopEndSec !== undefined) {
        source.loop = true
        source.loopStart = entry.loopStartSec
        source.loopEnd = entry.loopEndSec
      }
      const gain = ctx.createGain()
      gain.connect(musicGain)
      source.connect(gain)
      source.start()
      playing = { id, source, gain }
    })
  }

  function stopPlaying(fadeMs: number) {
    const current = playing
    playing = null
    if (!current || !context) return
    const now = context.currentTime
    try {
      if (fadeMs > 0) {
        current.gain.gain.setValueAtTime(current.gain.gain.value, now)
        current.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000)
        current.source.stop(now + fadeMs / 1000)
      } else current.source.stop()
    } catch {
      // Ya parada.
    }
  }

  function unlock() {
    if (unlocked) return
    if (!context) {
      try {
        context = createContext()
      } catch {
        context = null
      }
      if (!context) return
      master = context.createGain()
      master.connect(context.destination)
      musicGain = context.createGain()
      musicGain.connect(master)
      applyVolume()
    }
    unlocked = true
    for (const type of UNLOCK_EVENTS) unlockTarget?.removeEventListener(type, unlock)
    void context.resume().catch(() => undefined)
    startWantedMusic()
  }

  for (const type of UNLOCK_EVENTS) unlockTarget?.addEventListener(type, unlock)

  return {
    /** Volumen (0-100) y silencio de Ajustes; se aplican al instante a lo que suena. */
    configure(settings: { volume: number; muted: boolean }) {
      volume = settings.volume
      muted = settings.muted
      applyVolume()
    },
    /** Descarga (y, con contexto, decodifica) antes de que haga falta: la pista del rival y los efectos al entrar al combate. */
    preload(music: readonly string[], sfx: readonly string[]) {
      for (const key of [...music.map((id) => `music:${id}`), ...sfx.map((id) => `sfx:${id}`)]) {
        if (context) void bufferOf(key)
        else void bytesOf(key)
      }
    },
    /** Música en bucle (o una vez si no tiene puntos de bucle). Si aún no hay interacción, empieza en cuanto la haya. */
    playMusic(id: string) {
      if (wantedMusic === id && (playing?.id === id || !unlocked)) return
      wantedMusic = id
      startWantedMusic()
    },
    stopMusic(fadeMs = DEFAULT_FADE_MS) {
      wantedMusic = null
      stopPlaying(fadeMs)
    },
    /** Efecto de una vez. Antes de la primera interacción no suena (no se guarda para después). */
    playSfx(id: string) {
      if (!unlocked || !context) return
      void bufferOf(`sfx:${id}`).then((buffer) => {
        const ctx = context
        if (!buffer || !ctx || !master) return
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(master)
        source.start()
      })
    },
    /** Para los tests y la depuración. */
    state: () => ({ unlocked, volume, muted, music: playing?.id ?? null, wantedMusic }),
  }
}

export type AudioEngine = ReturnType<typeof createAudioEngine>
