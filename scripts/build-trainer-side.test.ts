import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { existsInRoot, fromRoot, importScript, readJson } from '../src/test-utils/paths'
import trainers from '../data/trainers.json'
import manifest from '../data/trainer-side-sprites.json'

describe('gen:trainer-side (RF-137)', () => {
  it('sideCell recorta 32 x 32 sin reescalar y hace transparente el color de la esquina de la celda', async () => {
    const { sideCell } = await importScript('scripts/build-trainer-side.mjs')
    const width = 40
    const rgba = new Uint8Array(width * 40 * 4)
    for (let i = 0; i < rgba.length; i += 4) rgba.set([9, 8, 7, 255], i)
    const set = (x: number, y: number, color: number[]) => rgba.set(color, (y * width + x) * 4)
    set(3, 5, [1, 2, 3, 255]) // Esquina del recorte, distinta de la esquina de la hoja.
    set(10, 11, [1, 2, 3, 255]) // Mismo fondo en otro punto, también se elimina.
    set(34, 36, [1, 2, 4, 128]) // Último píxel, color cercano: conservar RGB y alfa.
    const original = rgba.slice()
    const cell = sideCell({ width, height: 40, rgba }, [3, 5])
    expect([cell.width, cell.height, cell.rgba.length]).toEqual([32, 32, 32 * 32 * 4])
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const source = Array.from(original.subarray(((y + 5) * width + x + 3) * 4, ((y + 5) * width + x + 3) * 4 + 4))
      if (source.slice(0, 3).join() === '1,2,3') source[3] = 0
      expect(Array.from(cell.rgba.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 4))).toEqual(source)
    }
    expect(rgba).toEqual(original)
  })

  it('el manifiesto cubre todos los entrenadores y los dos protagonistas; las celdas caben en sus hojas y cada PNG existe', async () => {
    const { decodePng } = await importScript('scripts/lib/png.mjs')
    expect(Object.keys(manifest.trainers).sort()).toEqual(trainers.trainers.map((trainer) => trainer.sprite).sort())
    expect(Object.keys(manifest.players).sort()).toEqual(['nate', 'rosa'])
    for (const [entries, dir] of [[manifest.trainers, 'sprites/trainers'], [manifest.players, 'ui/battle/trainers']] as const) {
      for (const [id, entry] of Object.entries(entries)) {
        const sheet = manifest.sheets[entry.sheet as keyof typeof manifest.sheets]
        expect(sheet, id).toBeDefined()
        const [x, y] = entry.cell
        expect(x, id).toBeGreaterThanOrEqual(0)
        expect(y, id).toBeGreaterThanOrEqual(0)
        expect(x + 32, id).toBeLessThanOrEqual(sheet.width)
        expect(y + 32, id).toBeLessThanOrEqual(sheet.height)
        const file = `${id}-side.png`
        expect(existsInRoot('public', dir, file), file).toBe(true)
        const image = decodePng(readFileSync(fromRoot('public', dir, file)))
        expect([image.width, image.height], file).toEqual([32, 32])
        expect(image.rgba[3], `${file}: esquina transparente`).toBe(0)
        expect(image.rgba.some((alpha: number, i: number) => i % 4 === 3 && alpha > 0), `${file}: contiene un sprite`).toBe(true)
      }
    }
    expect(readJson('package.json').scripts['gen:trainer-side']).toBe('node scripts/build-trainer-side.mjs')
  })
})
