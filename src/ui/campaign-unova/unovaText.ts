/**
 * Ancho del texto de los menús de Teselia (pokemon-dp.ttf a 13 px), para partir descripciones en líneas. En el navegador lo mide un
 * lienzo; sin lienzo (jsdom), una media de 5,5 px por letra, la de la fuente a ese tamaño.
 */
let context: CanvasRenderingContext2D | null | undefined

export function textWidth13(text: string): number {
  if (context === undefined) {
    try {
      context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    } catch {
      context = null
    }
    if (context) context.font = '13px Game'
  }
  return context ? context.measureText(text).width : text.length * 5.5
}
