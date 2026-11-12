/**
 * Gritos de la tercera generación para la campaña de Hoenn (Jose, 12/11/2026): las muestras originales de Esmeralda
 * (`sound/direct_sound_samples/cries/<especie>.wav` de pret/pokeemerald, 8 bits a 10 512 Hz) de las 386 especies, en AAC como los
 * efectos (`build-audio.mjs`), en `public/audio/cries-emerald/<id>.m4a`, con su índice en `src/generated/emerald/cries.json`. El juego
 * las toca a su velocidad (pitch 15360, CRY_MODE_NORMAL); al debilitarse, más graves (14440, el `FAINT_CRY_RATE` del motor).
 *
 *   npm run gen:emerald-cries -- RUTA_POKEEMERALD
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'
import { ffprobeDuration, SFX_ARGS } from './build-audio.mjs'

const OUT_DIR = fromRoot('public', 'audio', 'cries-emerald')
const INDEX_PATH = fromRoot('src', 'generated', 'emerald', 'cries.json')
const SPRITES = fromRoot('src', 'generated', 'emerald', 'sprites.json')

/** Fichero del decompilado → id de la especie (`ho_oh` → `hooh`, `nidoran_f` → `nidoranf`, `mr_mime` → `mrmime`). */
export const cryId = (file) => file.replace(/\.wav$/, '').replace(/_/g, '')

/** Las especies de la campaña (las de `sprites.json`) con su muestra; las que no tienen, error. */
export function planCries(files, species) {
  const byId = new Map(files.filter((file) => file.endsWith('.wav')).map((file) => [cryId(file), file]))
  const missing = species.filter((id) => !byId.has(id))
  if (missing.length) throw new Error(`Sin grito en el decompilado: ${missing.join(', ')}`)
  return species.map((id) => ({ id, file: byId.get(id) }))
}

function main() {
  const root = process.argv[2]
  const dir = root && resolve(root, 'sound', 'direct_sound_samples', 'cries')
  if (!dir || !existsSync(dir)) throw new Error('Uso: npm run gen:emerald-cries -- RUTA_POKEEMERALD')
  const species = Object.keys(JSON.parse(readFileSync(SPRITES, 'utf8'))).sort()
  mkdirSync(OUT_DIR, { recursive: true })
  const index = {}
  for (const { id, file } of planCries(readdirSync(dir), species)) {
    const target = resolve(OUT_DIR, `${id}.m4a`)
    if (!existsSync(target)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', resolve(dir, file), ...SFX_ARGS, target])
    index[id] = { path: `audio/cries-emerald/${id}.m4a`, durationSec: Math.round(ffprobeDuration(target) * 1000) / 1000 }
  }
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`)
  console.log(`Gritos de Esmeralda: ${Object.keys(index).length}`)
}

if (isMain(import.meta.url)) main()
