import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMain } from './lib/cli.mjs'
import { gen5 } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'
import { toSlug } from './lib/slug.mjs'

/**
 * Iconos de los objetos (Jose, 06/11/2026): los de la bolsa de 3.ª a 5.ª gen. del repositorio de sprites de PokeAPI
 * (`sprites/items/<slug>.png`, 30 x 30), solo de los objetos que llevan los sets del juego (rivales y pool del jugador), en
 * `public/sprites/items/<id>.png`. Los usa la ficha del objeto de los paneles laterales (RF-44c). Lo ya bajado no se vuelve a bajar.
 */
const ICONS_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items'
const OUT_DIR = fromRoot('public', 'sprites', 'items')
const PAUSE_MS = 150
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47])

/** Objetos que llevan los sets de los rivales y del pool del jugador. */
export function usedItemIds() {
  const { trainers } = JSON.parse(readFileSync(fromRoot('data', 'trainers.json'), 'utf8'))
  const pool = JSON.parse(readFileSync(fromRoot('data', 'player-sets.json'), 'utf8'))
  const sets = [...trainers.flatMap((trainer) => trainer.variants.flatMap((variant) => variant.team)), ...pool]
  return [...new Set(sets.map((set) => set.item).filter(Boolean))].sort()
}

/** Nombre del icono en PokeAPI: el del objeto en minúsculas con guiones (Air Balloon -> air-balloon). */
export function iconSlug(itemId) {
  const item = gen5.items.get(itemId)
  if (!item?.exists) throw new Error(`Objeto desconocido: ${itemId}`)
  return toSlug(item.name)
}

const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const items = usedItemIds()
  const missing = []
  for (const itemId of items) {
    const target = resolve(OUT_DIR, `${itemId}.png`)
    if (existsSync(target)) continue
    const response = await fetch(`${ICONS_URL}/${iconSlug(itemId)}.png`, { signal: AbortSignal.timeout(20_000) }).catch(() => null)
    await sleep(PAUSE_MS)
    const body = response?.ok ? Buffer.from(await response.arrayBuffer()) : null
    if (!body || !body.subarray(0, 4).equals(PNG_SIGNATURE)) {
      missing.push(itemId)
      continue
    }
    writeFileSync(target, body)
    console.log(`  ${itemId}`)
  }
  console.log(`Iconos de objetos: ${items.length - missing.length} de ${items.length}.`)
  if (missing.length) {
    console.error(`Sin icono en PokeAPI: ${missing.join(', ')}`)
    process.exitCode = 1
  }
}

if (isMain(import.meta.url)) await main()
