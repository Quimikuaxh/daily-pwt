/**
 * Imagen de las pantallas de un `ConsoleStage` (pantalla final para compartir de la campaña, 12/11/2026): se vuelven a pintar en un
 * canvas a la resolución del juego las imágenes y los textos (canvas de GameText) de cada `.console-screen`, en su sitio, y se amplía
 * sin suavizar. Solo imágenes y canvas: fondos CSS, ventanas de GameWindow y transformaciones no salen, así que las pantallas que se
 * exportan se componen solo con imágenes y textos. *Descartado:* html-to-image y similares (dependencia nueva y suavizan el pixel art).
 */

/** Caja de un elemento en píxeles del juego dentro de su pantalla (`k`: escala de la consola). */
export function gameBox(element: DOMRect, screen: DOMRect, k: number): { x: number; y: number; w: number; h: number } {
  return { x: Math.round((element.left - screen.left) / k), y: Math.round((element.top - screen.top) / k), w: Math.round(element.width / k), h: Math.round(element.height / k) }
}

const visible = (element: Element) => {
  const style = getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0
}

/** Las pantallas de `stage`, una debajo de otra, a `zoom` aumentos. */
export function exportScreens(stage: HTMLElement, zoom: number): HTMLCanvasElement {
  const screens = [...stage.querySelectorAll('.console-screen')] as HTMLElement[]
  const first = screens[0]?.getBoundingClientRect()
  const k = first ? first.width / Number(getComputedStyle(stage).getPropertyValue('--screen-w').replace('px', '') || 240) : 1
  const w = Math.round((first?.width ?? 0) / k)
  const h = Math.round((first?.height ?? 0) / k)
  const base = document.createElement('canvas')
  base.width = w
  base.height = h * screens.length
  const g = base.getContext('2d')
  screens.forEach((screen, i) => {
    const rect = screen.getBoundingClientRect()
    for (const element of screen.querySelectorAll('img, canvas')) {
      if (!visible(element)) continue
      const box = gameBox(element.getBoundingClientRect(), rect, k)
      const source = element as HTMLImageElement | HTMLCanvasElement
      // Los sprites de hoja (frente de 64 × 128) enseñan su primer fotograma: se copia la esquina de arriba del tamaño del elemento.
      const sw = Math.min(box.w, source instanceof HTMLImageElement ? source.naturalWidth : source.width)
      const sh = Math.min(box.h, source instanceof HTMLImageElement ? source.naturalHeight : source.height)
      if (sw > 0 && sh > 0) g?.drawImage(source, 0, 0, sw, sh, box.x, box.y + h * i, sw, sh)
    }
  })
  const out = document.createElement('canvas')
  out.width = base.width * zoom
  out.height = base.height * zoom
  const o = out.getContext('2d')
  if (o) {
    o.imageSmoothingEnabled = false
    o.drawImage(base, 0, 0, out.width, out.height)
  }
  return out
}

/** Comparte la imagen con el menú del sistema si deja adjuntar archivos; si no (o se cancela por error), la descarga. */
export async function shareOrDownload(canvas: HTMLCanvasElement, fileName: string, text: string, download = false): Promise<'shared' | 'downloaded'> {
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'))
  if (!blob) throw new Error('No se pudo crear la imagen')
  const file = new File([blob], fileName, { type: 'image/png' })
  if (!download && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
