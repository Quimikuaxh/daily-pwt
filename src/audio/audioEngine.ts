/**
 * Motor de sonido (DEC-57): Web Audio con un `AudioContext` que se crea (o se reanuda) en la primera interacción del usuario, una
 * ganancia maestra con el volumen y el silencio de Ajustes, y otra para la música (sus fundidos). Música y efectos se descargan solo
 * cuando se piden (o se precargan) y se guardan decodificados por id. Sin Web Audio (tests, navegadores viejos) no hace nada ni lanza.
 */

export type MusicEntry = { path: string; durationSec: number; loopStartSec?: number; loopEndSec?: number }
export type SfxEntry = { path: string; durationSec: number }
/** `cries`: gritos de los Pokémon por `spriteId` (`gen:cries`, `src/generated/cries-index.json`); vacío hasta descargarlos. */
export type AudioIndex = { music: Record<string, MusicEntry>; sfx: Record<string, SfxEntry>; cries?: Record<string, SfxEntry> }

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
/** Al salir de rojo, la de vida baja se apaga en este tiempo (decisión de Jose, 30/10/2026)… */
export const PINCH_EXIT_FADE_MS = 800
/** …y la del rival vuelve desde bajo y sube durante más tiempo, para que se note que vuelve (decisión de Jose, 30/10/2026). */
export const MUSIC_RETURN_FADE_IN_MS = 1500
/** Cambio de tema con transición (el del último Pokémon del rival, decisión de Jose, 30/10/2026): uno se apaga mientras entra el otro. */
export const MUSIC_CHANGE_FADE_MS = 800
/** Grito al debilitarse: más lento y grave que al salir (como en N2/B2). */
export const FAINT_CRY_RATE = 0.8
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
  /** Música de vida baja: mientras se pida, suena ella en vez de `wantedMusic`. */
  let wantedPinch: string | null = null
  /** Por dónde iba la música cortada por la de vida baja: al quitarla, sigue desde ahí. */
  let resumeAt: { id: string; offsetSec: number } | null = null
  /** `startedAt` (reloj del contexto) y `offsetSec` (segundo de la pista en ese momento): con ellos se sabe por dónde va. */
  let playing: { id: string; source: AudioBufferSourceNode; gain: GainNode; startedAt: number; offsetSec: number } | null = null
  /** Quien quiere saber cuándo deja de estar bloqueado el sonido (el aviso «Toca para activar el sonido» del visor). */
  const unlockListeners = new Set<() => void>()
  const bytes = new Map<string, Promise<ArrayBuffer | null>>()
  const buffers = new Map<string, Promise<AudioBuffer | null>>()

  const entryOf = (key: string): MusicEntry | SfxEntry | undefined => {
    const [kind, id] = key.split(':') as ['music' | 'sfx' | 'cry', string]
    return kind === 'cry' ? index.cries?.[id] : index[kind]?.[id]
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

  /** Sonido de una vez (efecto o grito) a la velocidad `rate` (1, normal; menos, más grave). */
  function playOnce(key: string, rate: number) {
    if (!unlocked || !context) return
    void bufferOf(key).then((buffer) => {
      const ctx = context
      if (!buffer || !ctx || !master) return
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = rate
      source.connect(master)
      source.start()
    })
  }

  function applyVolume() {
    if (master) master.gain.value = muted ? 0 : volumeToGain(volume)
  }

  /** Lo que debe sonar: la de vida baja si está pedida; si no, la pedida. */
  const effectiveMusic = () => wantedPinch ?? wantedMusic

  /** Segundo de la pista por el que va lo que suena, contando las vueltas del bucle. */
  function positionOf(current: NonNullable<typeof playing>): number {
    const elapsed = current.offsetSec + ((context?.currentTime ?? current.startedAt) - current.startedAt)
    const entry = index.music[current.id]
    if (entry?.loopStartSec === undefined || entry.loopEndSec === undefined || elapsed < entry.loopEndSec) return elapsed
    return entry.loopStartSec + ((elapsed - entry.loopStartSec) % (entry.loopEndSec - entry.loopStartSec))
  }

  /** `fadeInMs`: entra subiendo desde 0 (la del rival al volver de la de vida baja); `fadeOutMs`: la que sonaba se apaga en ese tiempo. */
  function startWantedMusic(fadeInMs = 0, fadeOutMs = 0) {
    const id = effectiveMusic()
    if (!id || !context || playing?.id === id) return
    void bufferOf(`music:${id}`).then((buffer) => {
      const ctx = context
      if (!buffer || !ctx || !musicGain || effectiveMusic() !== id || playing?.id === id) return
      stopPlaying(fadeOutMs)
      // Vuelta de la de vida baja: la música sigue por donde iba; todo lo demás empieza desde el principio.
      const offsetSec = resumeAt?.id === id ? resumeAt.offsetSec : 0
      if (resumeAt?.id === id) resumeAt = null
      const entry = index.music[id]
      const source = ctx.createBufferSource()
      source.buffer = buffer
      if (entry?.loopStartSec !== undefined && entry.loopEndSec !== undefined) {
        source.loop = true
        source.loopStart = entry.loopStartSec
        source.loopEnd = entry.loopEndSec
      }
      const gain = ctx.createGain()
      if (fadeInMs > 0) {
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeInMs / 1000)
      }
      gain.connect(musicGain)
      source.connect(gain)
      source.start(0, offsetSec)
      playing = { id, source, gain, startedAt: ctx.currentTime, offsetSec }
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
    // Lo que ya se precargó sin contexto (solo los bytes) se decodifica ahora: así la de vida baja suena en cuanto se pide.
    for (const key of [...bytes.keys()]) void bufferOf(key)
    for (const listener of [...unlockListeners]) listener()
    unlockListeners.clear()
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
    preload(music: readonly string[], sfx: readonly string[], cries: readonly string[] = []) {
      for (const key of [...music.map((id) => `music:${id}`), ...sfx.map((id) => `sfx:${id}`), ...cries.map((id) => `cry:${id}`)]) {
        if (context) void bufferOf(key)
        else void bytesOf(key)
      }
    },
    /** Música en bucle (o una vez si no tiene puntos de bucle). Si aún no hay interacción, empieza en cuanto la haya. */
    /**
     * Con `crossfadeMs`, la que sonaba se apaga mientras esta entra subiendo (el tema del último Pokémon). Si está sonando la de vida
     * baja, sigue ella: esta suena al quitarla, desde el principio (no se había llegado a oír).
     */
    playMusic(id: string, { crossfadeMs = 0 }: { crossfadeMs?: number } = {}) {
      if (wantedMusic === id && (playing?.id === id || !unlocked)) return
      wantedMusic = id
      startWantedMusic(crossfadeMs, crossfadeMs)
    },
    stopMusic(fadeMs = DEFAULT_FADE_MS) {
      wantedMusic = null
      wantedPinch = null
      resumeAt = null
      stopPlaying(fadeMs)
    },
    /** Efecto de una vez. Antes de la primera interacción no suena (no se guarda para después). */
    playSfx(id: string) {
      playOnce(`sfx:${id}`, 1)
    },
    /**
     * Grito de un Pokémon (`spriteId`) al salir al campo o, con `faint`, al debilitarse: más grave, como en el juego (Jose, 31/10/2026).
     * Sin grito descargado, nada.
     */
    playCry(id: string, { faint = false }: { faint?: boolean } = {}) {
      playOnce(`cry:${id}`, faint ? FAINT_CRY_RATE : 1)
    },
    /**
     * Música de vida baja (decisión de Jose, 30/10/2026): con un id, corta la música que suena y pone esa desde el principio, en bucle;
     * con `null`, la funde (`PINCH_EXIT_FADE_MS`) mientras la música vuelve por donde iba, subiendo desde bajo
     * (`MUSIC_RETURN_FADE_IN_MS`). Pedida otra vez, vuelve a empezar desde el principio. Si se pide antes de la primera interacción,
     * suena en cuanto la haya: es un estado del combate, no un suceso.
     */
    setPinchMusic(id: string | null) {
      if (id === wantedPinch) return
      if (id !== null && wantedPinch === null && playing && playing.id === wantedMusic) resumeAt = { id: playing.id, offsetSec: positionOf(playing) }
      const leaving = id === null
      wantedPinch = id
      // Al entrar, corte seco; al salir, fundido cruzado.
      stopPlaying(leaving ? PINCH_EXIT_FADE_MS : 0)
      startWantedMusic(leaving ? MUSIC_RETURN_FADE_IN_MS : 0)
    },
    /**
     * El navegador no deja sonar nada hasta el primer toque o tecla en la página. `listener` se llama una vez, cuando llega; si ya
     * llegó, no se llama. Devuelve cómo dejar de escuchar.
     */
    onUnlock(listener: () => void): () => void {
      if (!unlocked) unlockListeners.add(listener)
      return () => unlockListeners.delete(listener)
    },
    isUnlocked: () => unlocked,
    /** Para los tests y la depuración. */
    state: () => ({ unlocked, volume, muted, music: playing?.id ?? null, wantedMusic, pinch: wantedPinch }),
  }
}

export type AudioEngine = ReturnType<typeof createAudioEngine>
