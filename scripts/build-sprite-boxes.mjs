import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gifOpaqueBox } from './lib/gif.mjs'
import { fromRoot } from './lib/paths.mjs'
import { decodePng, opaqueBox } from './lib/png.mjs'

const SIDES = ['front', 'back']
const OUTPUT_PATH = fromRoot('src', 'generated', 'sprite-boxes.json')

function boxesIn(directory) {
  const result = {}
  for (const fileName of readdirSync(directory).filter((name) => name.endsWith('.gif')).sort()) {
    const { width, height, box } = gifOpaqueBox(readFileSync(`${directory}/${fileName}`))
    if (box) result[fileName.slice(0, -4)] = [...box, width, height]
  }
  return result
}

/**
 * Caja visible (no transparente) de cada sprite animado de Pokémon y de entrenador: `{ front|back|trainer: { spriteId: [x, y, w, h, anchoTotal, altoTotal] }, substitute: { front|back: [...] } }`.
 * Los GIF de Showdown traen márgenes transparentes distintos por especie; la UI ancla el sprite por esta caja, no por el GIF.
 */
export function buildSpriteBoxes() {
  const boxes = {}
  for (const side of SIDES) {
    const directory = fromRoot('public', 'sprites', 'pokemon', side)
    boxes[side] = boxesIn(directory)
  }
  boxes.trainer = boxesIn(fromRoot('public', 'sprites', 'trainers'))
  // El muñeco del sustituto (PNG, recortado por gen:sprites): el jugador lo apoya por su alto, como a los Pokémon.
  boxes.substitute = {}
  for (const side of SIDES) {
    const image = decodePng(readFileSync(fromRoot('public', 'sprites', 'substitute', `${side}.png`)))
    boxes.substitute[side] = [...opaqueBox(image), image.width, image.height]
  }
  return boxes
}

if (isMain(import.meta.url)) {
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(buildSpriteBoxes())}\n`)
  console.log(`Escrito ${OUTPUT_PATH}`)
}
