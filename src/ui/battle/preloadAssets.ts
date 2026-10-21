import { useEffect, useState } from 'react'
import type { Challenge, GameData } from '../../core/types'
import battleUiImages from '../../generated/battle-ui-images.json'
import { speciesSprite, trainerSprite } from '../common/spriteUrls'
import { uiAsset } from '../common/uiAssets'

const DIGITS = Array.from({ length: 10 }, (_, digit) => digit)

/**
 * Imágenes que la caja de datos cambia en pleno combate. Un `<img>` al que se le cambia el `src` sigue pintando la imagen anterior
 * hasta que llega la nueva: sin precarga, la primera vez que sale un dígito, un color de barra o un icono de estado se ve un instante
 * el valor viejo (los PS pasan de 150 a 2 mostrando un «1» y luego el «2»). Se piden primero, desde Hoy, antes de empezar el combate.
 */
export const BATTLE_DATABOX_IMAGES: readonly string[] = [
  ...DIGITS.flatMap((digit) => [uiAsset(`digits/hp-${digit}.png`), uiAsset(`digits/level-${digit}.png`)]),
  ...['green', 'yellow', 'red'].map((color) => uiAsset(`hp/fill-${color}.png`)),
  ...['brn', 'frz', 'par', 'psn', 'slp', 'tox'].map((status) => uiAsset(`status/${status}.png`)),
]

/** Resto de gráficos de interfaz del combate (fondos de equipo y datos, placas, iconos, botones, intro, bola y destello). `npm run gen:ui-index`. */
export const BATTLE_UI_IMAGES: readonly string[] = (battleUiImages as string[]).map(uiAsset)

type ImageLike = { src: string; complete?: boolean; fetchPriority?: string; decoding?: string; decode?: () => Promise<void> }
type ImageFactory = () => ImageLike

const loaded = new Map<string, ImageLike>()

/** Pide una imagen con prioridad baja y la deja decodificada; se guarda la referencia para que el navegador no la descarte. */
function requestImage(url: string, createImage: ImageFactory): Promise<void> {
  const existing = loaded.get(url)
  if (existing) return existing.decode?.().catch(() => undefined) ?? Promise.resolve()
  const image = createImage()
  image.fetchPriority = 'low'
  image.decoding = 'async'
  image.src = url
  loaded.set(url, image)
  return image.decode?.().catch(() => undefined) ?? Promise.resolve()
}

// Sin requestIdleCallback (Safari, jsdom) se encola como microtarea: no es un temporizador y no retrasa nada visible.
const runWhenIdle = (task: () => void): void => {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') window.requestIdleCallback(task, { timeout: 2000 })
  else void Promise.resolve().then(task)
}

/** Dígitos, barras y estados enseguida; el resto de la interfaz cuando el navegador esté ocioso. No bloquea la pantalla. */
export function preloadBattleImages(createImage: ImageFactory = () => new Image()): void {
  for (const url of BATTLE_DATABOX_IMAGES) void requestImage(url, createImage)
  runWhenIdle(() => {
    for (const url of BATTLE_UI_IMAGES) void requestImage(url, createImage)
  })
  // El código de la pantalla de datos (con las descripciones) es un trozo aparte: se baja en reposo, no al abrir Datos. Solo en navegadores con requestIdleCallback.
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => void import('./party/SummaryScreen'))
  }
}

/** URLs de sprites del reto de hoy: frente y espalda de los 6 rivales y los 6 propios, y el entrenador rival. Nunca los del resto del pool. */
export function challengeSpriteUrls(challenge: Challenge, data: GameData): string[] {
  const species = [...challenge.rivalTeam, ...challenge.playerTeam].map((set) => set.species)
  const urls = [...new Set(species)].flatMap((id) => [speciesSprite(data.dex, id, 'front'), speciesSprite(data.dex, id, 'back')])
  return [...urls.filter((url): url is string => url !== null), trainerSprite(challenge.trainer.sprite)]
}

export function preloadChallengeSprites(challenge: Challenge, data: GameData, createImage: ImageFactory = () => new Image()): void {
  const urls = challengeSpriteUrls(challenge, data)
  runWhenIdle(() => {
    for (const url of urls) void requestImage(url, createImage)
  })
}

/** Precarga los sprites del reto de hoy cuando se muestra Hoy. */
export function usePreloadChallengeSprites(challenge: Challenge, data: GameData): void {
  useEffect(() => {
    preloadChallengeSprites(challenge, data)
  }, [challenge, data])
}

/** Resuelve cuando todas están decodificadas, o al cabo de `timeoutMs` (nunca deja una pantalla sin abrir por una imagen que falla). */
export function imagesReady(urls: readonly string[], timeoutMs = 1500, createImage: ImageFactory = () => new Image()): Promise<void> {
  const all = Promise.all(urls.map((url) => requestImage(url, createImage))).then(() => undefined)
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  return Promise.race([all, timeout])
}

/** `true` cuando las imágenes de una pantalla están listas: hasta entonces se mantiene la pantalla anterior en vez de enseñar la nueva a medio cargar. */
export function useImagesReady(urls: readonly string[], active: boolean): boolean {
  const key = urls.join('|')
  // Lo que nunca se pidió (no hubo precarga) no se espera: no hay nada que mejorar y se mantiene el comportamiento de siempre.
  const [readyKey, setReadyKey] = useState(() => (urls.every((url) => loaded.get(url)?.complete !== false) ? key : ''))
  useEffect(() => {
    if (!active || readyKey === key) return
    let cancelled = false
    void imagesReady(urls).then(() => {
      if (!cancelled) setReadyKey(key)
    })
    return () => {
      cancelled = true
    }
    // `urls` va resumida en `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, readyKey])
  return readyKey === key
}

export const PARTY_SCREEN_IMAGES: readonly string[] = BATTLE_UI_IMAGES.filter((url) => /\/(party|icons|status|digits|hp|types-blank|types|categories)\//.test(url))
export const SUMMARY_SCREEN_IMAGES: readonly string[] = BATTLE_UI_IMAGES.filter((url) => /\/(summary|types-blank|types|categories|icons|hp|status|digits)\//.test(url))
