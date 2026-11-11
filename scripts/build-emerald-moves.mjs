/**
 * Movimientos de la campaña de Hoenn para la pantalla Movimientos (D7): los que aprende algún Pokémon por nivel o MT/MO en
 * `hoenn-emerald-progression.json`, con tipo, potencia, precisión y PP de Gen 3 (@pkmn/dex), categoría de Gen 3 (por tipo) y la
 * descripción inglesa del juego con sus saltos (src/data/text/move_descriptions.h de pret/pokeemerald, revisión fijada), que es la
 * referencia de la española redactada en data/nuzlocke/emerald-move-descriptions-es.json (no hay fuente con las del juego en español).
 *
 *   npm run gen:emerald-moves                                  descarga la cabecera de la revisión fijada
 *   npm run gen:emerald-moves -- --source-dir RUTA_POKEEMERALD  sin red
 *   npm run gen:emerald-moves -- --check                        compara con lo versionado sin escribir
 */
import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { isMain } from './lib/cli.mjs'
import { gen3, readEmeraldSource } from './lib/emerald-source.mjs'
import { toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'

const DESCRIPTIONS = ['src/data/text/move_descriptions.h', 'd0226af5a3a52774ac218ba993ec8b744e9c5d7c200edc6327c9c35234300b55']
export const EMERALD_MOVES = fromRoot('src', 'generated', 'emerald', 'moves.json')
const PROGRESSION = fromRoot('data', 'nuzlocke', 'hoenn-emerald-progression.json')
/** En Gen 3 la categoría la decide el tipo. */
const PHYSICAL_TYPES = new Set(['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel'])
// El nombre inglés cambió a plural en los identificadores del simulador (como en import-emerald-progression).
const moveId = (token) => gen3.moves.get(toId(token === 'SMELLING_SALT' ? 'SMELLING_SALTS' : token))?.id

/** `sXDescription = _("a\n" "b")` → { sXDescription: 'a\nb' }, y la tabla de punteros MOVE_X → texto. */
export function parseDescriptions(source) {
  const texts = new Map()
  for (const match of source.matchAll(/static const u8 (\w+)\[\]\s*=\s*_\(([\s\S]*?)\);/g)) {
    const parts = [...match[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((part) => part[1])
    texts.set(match[1], parts.join('').replace(/\\n/g, '\n').replace(/\\(["\\])/g, '$1'))
  }
  const byMove = {}
  for (const match of source.matchAll(/\[MOVE_(\w+) - 1\]\s*=\s*(\w+)/g)) {
    const id = moveId(match[1])
    if (id && texts.has(match[2])) byMove[id] = texts.get(match[2])
  }
  return byMove
}

export function buildMoves(progression, descriptions) {
  const ids = new Set()
  for (const species of Object.values(progression.species)) {
    for (const entry of species.levelUp) ids.add(entry.move)
    for (const move of species.machines) ids.add(move)
  }
  const moves = {}
  for (const id of [...ids].sort()) {
    const move = gen3.moves.get(id)
    if (!move?.exists) throw new Error(`Movimiento desconocido en Gen 3: ${id}`)
    if (!descriptions[id]) throw new Error(`Sin descripción en move_descriptions.h: ${id}`)
    moves[id] = {
      type: move.type,
      category: move.category === 'Status' ? 'Status' : PHYSICAL_TYPES.has(move.type) ? 'Physical' : 'Special',
      power: move.basePower || null,
      accuracy: move.accuracy === true ? null : move.accuracy,
      pp: move.pp,
      en: descriptions[id],
    }
  }
  return moves
}

async function main() {
  const { values } = parseArgs({ options: { 'source-dir': { type: 'string' }, check: { type: 'boolean' } } })
  const source = await readEmeraldSource(DESCRIPTIONS[0], DESCRIPTIONS[1], values['source-dir'])
  const progression = JSON.parse(await readFile(PROGRESSION, 'utf8'))
  const text = `${JSON.stringify(buildMoves(progression, parseDescriptions(source)), null, 2)}\n`
  if (values.check) {
    const current = await readFile(EMERALD_MOVES, 'utf8').catch(() => '')
    if (current !== text) throw new Error('src/generated/emerald/moves.json no coincide con su regeneración')
    console.log('moves.json reproducido byte a byte')
    return
  }
  await writeFile(EMERALD_MOVES, text)
  console.log(`${Object.keys(JSON.parse(text)).length} movimientos`)
}

if (isMain(import.meta.url)) await main()
