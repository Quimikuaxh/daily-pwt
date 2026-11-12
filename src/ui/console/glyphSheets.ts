/** Máscaras de la fuente del juego cargadas y teñidas, en caché (GameText, DEC-95). */

const images: Map<string, Promise<HTMLImageElement>> = new Map()
const tinted: Map<string, HTMLCanvasElement> = new Map()

/** Imágenes ya cargadas: con ellas el texto se pinta en el mismo fotograma en que se monta (sin el parpadeo de esperar a la promesa). */
const loaded = new Map<string, HTMLImageElement>()
export const loadedImage = (src: string): HTMLImageElement | null => loaded.get(src) ?? null

export function loadImage(src: string): Promise<HTMLImageElement> {
  let promise = images.get(src)
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => { loaded.set(src, img); resolve(img) }
      img.onerror = () => reject(new Error(`No carga ${src}`))
      img.src = src
    })
    images.set(src, promise)
  }
  return promise
}

/** Máscara teñida de un color (composición `destination-in`, sin leer píxeles), en caché por fuente, capa y color. */
export function tint(mask: HTMLImageElement, key: string, color: string): HTMLCanvasElement | null {
  const cached = tinted.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = mask.width
  canvas.height = mask.height
  const g = canvas.getContext('2d')
  if (!g) return null
  g.fillStyle = color
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(mask, 0, 0)
  tinted.set(key, canvas)
  return canvas
}
