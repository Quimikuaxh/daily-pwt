import { describe, it, expect } from 'vitest'
import { importScript } from '../../src/test-utils/paths'

type Image = { width: number; height: number; rgba: Uint8Array }
const twoByTwo = (): Image => ({
  width: 2,
  height: 2,
  rgba: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 128]),
})

describe('scripts/lib/png.mjs', () => {
  it('codifica y decodifica sin perder un solo píxel', async () => {
    const { decodePng, encodePng } = await importScript('scripts/lib/png.mjs')
    const decoded = decodePng(encodePng(twoByTwo()))
    expect(decoded.width).toBe(2)
    expect(Array.from(decoded.rgba)).toEqual(Array.from(twoByTwo().rgba))
  })

  it('recorta sin reescalar y rechaza cajas fuera de la imagen', async () => {
    const { cropImage } = await importScript('scripts/lib/png.mjs')
    const cropped = cropImage(twoByTwo(), [1, 0, 1, 2])
    expect(Array.from(cropped.rgba)).toEqual([4, 5, 6, 255, 10, 11, 12, 128])
    expect(() => cropImage(twoByTwo(), [1, 1, 2, 1])).toThrow(/fuera de la imagen/)
  })

  it('hace transparentes solo los colores indicados y los rectángulos borrados', async () => {
    const { makeColorsTransparent, eraseBoxes } = await importScript('scripts/lib/png.mjs')
    const keyed = makeColorsTransparent(twoByTwo(), [[4, 5, 6]])
    expect(Array.from(keyed.rgba.filter((_: number, index: number) => index % 4 === 3))).toEqual([255, 0, 255, 128])
    const erased = eraseBoxes(twoByTwo(), [[0, 1, 1, 1]])
    expect(Array.from(erased.rgba.filter((_: number, index: number) => index % 4 === 3))).toEqual([255, 255, 0, 128])
  })

  it('rechaza lo que no es un PNG', async () => {
    const { decodePng } = await importScript('scripts/lib/png.mjs')
    expect(() => decodePng(Buffer.from('<html>error</html>'))).toThrow(/firma inválida/)
  })

  // Limpieza de capturas (fondo de la pantalla de datos) y tiras de fotogramas (Poké Ball).
  const grid = (width: number, height: number, color: (x: number, y: number) => [number, number, number]): Image => {
    const rgba = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rgba.set([...color(x, y), 255], (y * width + x) * 4)
    return { width, height, rgba }
  }
  const pixel = (image: Image, x: number, y: number) => Array.from(image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3))

  it('cleanImage: `tile` repite el mosaico anclado en su esquina y lee solo del original', async () => {
    const { cleanImage } = await importScript('scripts/lib/png.mjs')
    const image = grid(8, 2, (x) => [x % 4 === 0 ? 255 : 10, 0, 0])
    const dirty = { ...image, rgba: new Uint8Array(image.rgba) }
    dirty.rgba.set([0, 255, 0, 255], 4 * 5)
    const cleaned = cleanImage(dirty, { tile: [{ from: [0, 0, 4, 2], box: [4, 0, 4, 2] }] })
    expect(pixel(cleaned, 4, 0)).toEqual([255, 0, 0])
    expect(pixel(cleaned, 5, 0)).toEqual([10, 0, 0])
  })

  it('cleanImage: `clip` limita la operación a una diagonal de 45° (min <= x - y <= max)', async () => {
    const { cleanImage } = await importScript('scripts/lib/png.mjs')
    const image = grid(4, 4, () => [1, 1, 1])
    const cleaned = cleanImage(image, { fill: [{ box: [0, 0, 4, 4], color: [9, 9, 9], clip: [-1, 1] }] })
    expect(pixel(cleaned, 0, 0)).toEqual([9, 9, 9])
    expect(pixel(cleaned, 1, 0)).toEqual([9, 9, 9])
    expect(pixel(cleaned, 2, 0)).toEqual([1, 1, 1])
    expect(pixel(cleaned, 0, 2)).toEqual([1, 1, 1])
  })

  it('cleanImage: `fill` con `from` toma el color de ese píxel y `clone` copia una caja tal cual', async () => {
    const { cleanImage } = await importScript('scripts/lib/png.mjs')
    const image = grid(4, 1, (x) => [x * 10, 0, 0])
    const cleaned = cleanImage(image, { fill: [{ box: [2, 0, 2, 1], from: [1, 0] }], clone: [{ from: [0, 0, 1, 1], to: [1, 0] }] })
    expect(pixel(cleaned, 1, 0)).toEqual([0, 0, 0])
    expect(pixel(cleaned, 2, 0)).toEqual([10, 0, 0])
  })

  it('cleanImage rechaza cajas fuera de la imagen', async () => {
    const { cleanImage } = await importScript('scripts/lib/png.mjs')
    expect(() => cleanImage(grid(2, 2, () => [0, 0, 0]), { fill: [{ box: [1, 1, 2, 2], color: [0, 0, 0] }] })).toThrow(/fuera de la imagen/)
  })

  it('stripImage pega recortes del mismo tamaño en una tira y rechaza tamaños distintos', async () => {
    const { stripImage } = await importScript('scripts/lib/png.mjs')
    const image = grid(4, 2, (x) => [x, 0, 0])
    const strip = stripImage(image, [[3, 0, 1, 2], [0, 0, 1, 2]])
    expect([strip.width, strip.height]).toEqual([2, 2])
    expect([pixel(strip, 0, 0), pixel(strip, 1, 1)]).toEqual([[3, 0, 0], [0, 0, 0]])
    expect(() => stripImage(image, [[0, 0, 1, 2], [1, 0, 2, 2]])).toThrow(/mismo tamaño|medir lo mismo/)
  })

  it('opaqueBox da la caja de los píxeles con alfa y null si todo es transparente', async () => {
    const { opaqueBox } = await importScript('scripts/lib/png.mjs')
    expect(opaqueBox(twoByTwo())).toEqual([0, 0, 2, 2])
    const rgba = new Uint8Array(3 * 3 * 4)
    expect(opaqueBox({ width: 3, height: 3, rgba })).toBeNull()
    rgba[(2 * 3 + 1) * 4 + 3] = 1
    expect(opaqueBox({ width: 3, height: 3, rgba })).toEqual([1, 2, 1, 1])
  })
})
