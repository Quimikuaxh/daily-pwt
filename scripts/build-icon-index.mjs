import { writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gen5, toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'

const OUTPUT_PATH = fromRoot('src', 'generated', 'icon-index.json')

/**
 * Posición de cada especie en la hoja de iconos de Showdown (`public/ui/battle/party/icons-sheet.png`: 12 columnas de 40x30).
 * En las especies base el índice es el número de Pokédex; las formas con icono propio no están en Gen 5 base y no se usan en el juego.
 * Clave = `spriteId` del dex (el mismo nombre que el sprite).
 */
export function buildIconIndex() {
  const index = {}
  for (const entry of [...gen5.species].sort((a, b) => a.num - b.num)) {
    const spriteId = toId(entry.baseSpecies) + (entry.forme ? `-${toId(entry.forme)}` : '')
    if (entry.num > 0 && !entry.forme) index[spriteId] = entry.num
  }
  return index
}

if (isMain(import.meta.url)) {
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(buildIconIndex())}\n`)
  console.log(`Escrito ${OUTPUT_PATH}`)
}
