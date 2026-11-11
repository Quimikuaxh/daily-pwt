/**
 * Sprites de mapa de pie de lado para el escenario previo a la pancarta VS (RF-137): recorta de las hojas de The Spriters Resource (vía
 * Internet Archive) la celda de 32 x 32 de cada entrenador de `data/trainer-side-sprites.json` y pone su fondo transparente. Escribe
 * public/sprites/trainers/<id>-side.png (mirando a la izquierda) y public/ui/battle/trainers/<id>-side.png (Nate y Rosa, a la derecha).
 *
 * Uso: npm run gen:trainer-side (necesita red; los PNG se versionan).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng, cropImage } from './lib/png.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const manifest = JSON.parse(readFileSync(`${ROOT}data/trainer-side-sprites.json`, 'utf8'))

/** Celda con el color de su esquina como transparente. */
export function sideCell(sheet, [x, y]) {
  const cell = cropImage(sheet, [x, y, 32, 32])
  const [r, g, b] = cell.rgba.subarray(0, 3)
  for (let i = 0; i < cell.rgba.length; i += 4) {
    if (cell.rgba[i] === r && cell.rgba[i + 1] === g && cell.rgba[i + 2] === b) cell.rgba[i + 3] = 0
  }
  return cell
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sheets = {}
  for (const [name, sheet] of Object.entries(manifest.sheets)) {
    const response = await fetch(sheet.url, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
    sheets[name] = decodePng(Buffer.from(await response.arrayBuffer()))
    if (sheets[name].width !== sheet.width || sheets[name].height !== sheet.height) throw new Error(`${name}: tamaño inesperado`)
  }
  for (const [id, { sheet, cell }] of Object.entries(manifest.trainers)) writeFileSync(`${ROOT}public/sprites/trainers/${id}-side.png`, encodePng(sideCell(sheets[sheet], cell)))
  for (const [id, { sheet, cell }] of Object.entries(manifest.players)) writeFileSync(`${ROOT}public/ui/battle/trainers/${id}-side.png`, encodePng(sideCell(sheets[sheet], cell)))
  console.log(`Sprites de lado: ${Object.keys(manifest.trainers).length} entrenadores y ${Object.keys(manifest.players).length} protagonistas.`)
}
