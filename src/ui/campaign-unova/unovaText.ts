/**
 * Ancho del texto de los menús de Teselia (pokemon-dp.ttf a 13 px), para partir descripciones en líneas. En el navegador lo mide un
 * lienzo; sin lienzo (jsdom), una media de 0,42 del tamaño por letra, la de la fuente.
 */
let context: CanvasRenderingContext2D | null | undefined

/** Ancho del texto a `size` px (13, el de los menús; 16, el de la franja de mensajes del combate). */
export function textWidthAt(size: number, text: string): number {
  if (context === undefined) {
    try {
      context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    } catch {
      context = null
    }
  }
  if (!context) return text.length * size * 0.42
  context.font = `${size}px Game`
  return context.measureText(text).width
}

export const textWidth13 = (text: string): number => textWidthAt(13, text)
