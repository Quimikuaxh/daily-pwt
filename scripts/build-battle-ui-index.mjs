import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'

const BATTLE_UI_DIR = fromRoot('public', 'ui', 'battle')
const OUTPUT_PATH = fromRoot('src', 'generated', 'battle-ui-images.json')
// Fondos de combate alternativos: el juego solo pinta `bg/pwt.png`.
const UNUSED_BACKGROUNDS = /^bg\/(?!pwt\.png$)/

function listPngs(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return listPngs(path)
    return name.endsWith('.png') ? [relative(BATTLE_UI_DIR, path).split('\\').join('/')] : []
  })
}

/** Gráficos de interfaz del combate (public/ui/battle) que se precargan desde Hoy, ordenados para que el fichero sea estable. */
export function buildBattleUiIndex() {
  return listPngs(BATTLE_UI_DIR).filter((path) => !UNUSED_BACKGROUNDS.test(path)).sort()
}

if (isMain(import.meta.url)) {
  const images = buildBattleUiIndex()
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(images)}\n`)
  console.log(`Escrito ${OUTPUT_PATH} (${images.length} imágenes)`)
}
