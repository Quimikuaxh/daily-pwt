/**
 * Calendario de MT y MO de la locke de N2/B2 (PRD §0, «Locke de N2/B2: MT, tutores y canje», 13/11/2026). Sin código fuente del juego:
 * la lista y la ubicación de cada MT/MO salen de Serebii (`tmhm.shtml`) y el tramo de cada ubicación, de la guía de WikiDex, que está
 * dividida por medallas («Medalla Base» = todo lo que se recorre antes de Cheren, etc.). La tabla `ZONES` es esa correspondencia,
 * escrita a mano; una ubicación que no esté en ella hace fallar el generador.
 *
 * Reglas, las mismas que en Hoenn: cuenta desde el tramo en que se llega a su zona; un premio de líder, desde el tramo siguiente a ese
 * líder; fuera lo de después de la Liga, las MT de la PWT (PB) y los tutores. Las de tienda cuentan (en la campaña no hay dinero).
 *
 * Uso: npm run gen:n2b2-calendar [-- --offline] [-- --refresh]
 */
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { isMain } from './lib/cli.mjs'
import { gen5 } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'
import { getPage } from './lib/pwt-http.mjs'
import { N2B2_ENCOUNTERS } from './import-n2b2.mjs'

export const N2B2_CALENDAR = fromRoot('data', 'nuzlocke', 'unova-n2b2-calendar.json')
const TM_PAGE = { source: 'serebii', key: 'n2b2-tmhm', url: 'https://www.serebii.net/black2white2/tmhm.shtml' }

/** Hitos en orden: el tramo n es lo que hay antes del rival n. */
export const MILESTONES = N2B2_ENCOUNTERS.map((encounter) => encounter.id)
export const BEFORE = { cheren: 0, hiedra: 1, camus: 2, camila: 3, yakon: 4, gerania: 5, lirio: 6, ciprian: 7, liga: 8 }

/**
 * Zona de Serebii (inicio del texto de ubicación, en inglés) → tramo, según el capítulo de la guía de WikiDex en que se recorre.
 * `post`: después de la Liga; `pwt`: canje de PB en el Pokémon World Tournament (excluidas, PRD §0).
 */
export const ZONES = [
  ['Aspertia City - Defeat Cheren', 'reward:cheren'],
  ['Aspertia City - From Bianca', BEFORE.cheren],
  ['Floccesy Ranch', BEFORE.cheren],
  // MT53 (Energibola) en Pueblo Engobe, al otro lado del agua (Serebii: en la ciudad se usa Surf): desde que se tiene Surf (MO03,
  // tramo de Gerania), volviendo como en Hoenn al abrir una MO.
  ['Aspertia City', BEFORE.gerania],
  ['Virbank City - Defeat Roxie', 'reward:hiedra'],
  ['Virbank City - From Roxie', 'reward:hiedra'],
  ['Virbank Complex', BEFORE.hiedra],
  ['Castelia City - Defeat Burgh', 'reward:camus'],
  ['Castelia City', BEFORE.camus],
  ['Castelia Sewers', BEFORE.camus],
  ['Route 4', BEFORE.camila],
  ['Relic Castle', BEFORE.camila],
  ['Nimbasa City - Defeat Elesa', 'reward:camila'],
  ['Nimbasa City', BEFORE.camila],
  ['Route 16', BEFORE.camila],
  ['Lostlorn Forest', BEFORE.camila],
  ['Route 5 - From Bianca', BEFORE.yakon],
  ['Driftveil City - Defeat Clay', 'reward:yakon'],
  ['Driftveil City Market', BEFORE.yakon],
  ['Route 6', BEFORE.gerania],
  ['Mistralton City - Defeat Skyla', 'reward:gerania'],
  ['Mistralton City', BEFORE.gerania],
  ['Mistralton PokéMart', BEFORE.gerania],
  ['Mistralton Cave', BEFORE.gerania],
  ['Route 7', BEFORE.lirio],
  ['Celestial Tower', BEFORE.lirio],
  ['Lentimas Town', BEFORE.lirio],
  ['Reversal Mountain - Show Researcher', 'condition'],
  ['Reversal Mountain', BEFORE.lirio],
  ['Undella Town - From Rival', BEFORE.lirio],
  ['Route 13', BEFORE.lirio],
  ['Lacunosa', BEFORE.lirio],
  ['Route 9 Department Store', BEFORE.lirio],
  ['Opelucid City - Defeat Drayden', 'reward:lirio'],
  ['Marine Tube', BEFORE.ciprian],
  ['Humilau City - Defeat Marlon', 'reward:ciprian'],
  ['Seaside Cave', BEFORE.liga],
  ['Team Plasma Frigate', BEFORE.liga],
  ['Giant Chasm', BEFORE.liga],
  ['Route 23', BEFORE.liga],
  ['Victory Road', BEFORE.liga],
  ['Pokémon World Tournament', 'pwt'],
  ['Striaton City', 'post'],
  ['Dragonspiral Tower', 'post'],
  ['Route 18', 'post'],
  ['Pinwheel Forest', 'post'],
  ['Route 15', 'post'],
  ['Route 8', 'post'],
  ['Tubeline Bridge', 'post'],
  ['Wellspring Cave', 'post'],
  ["N's Castle", 'post'],
  ['Twist Mountain', 'post'],
  ['Moor of Iccirus', 'post'],
  ['Dreamyard', 'post'],
  ['Abundant Shrine', 'post'],
]

const EXCLUDED_REASON = {
  pwt: 'MT de la PWT (canje de PB), excluidas',
  post: 'después de la Liga',
  condition: 'condición aparte (capturar todos los Pokémon de la cueva), excluida',
}

/** MT/MO con su ataque y su ubicación, en el orden de Serebii (la primera fila de cada número). */
export function parseTmhm(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '|').replace(/&amp;/g, '&').replace(/&eacute;/g, 'é')
    .replace(/\s+/g, ' ').replace(/(\|\s*)+/g, '|')
  const parts = text.split('|').map((part) => part.trim())
  const rows = new Map()
  parts.forEach((part, i) => {
    const match = /^(TM|HM)(\d\d)$/.exec(part)
    if (!match || rows.has(part)) return
    rows.set(part, { id: `${match[1].toLowerCase()}${match[2]}`, move: parts[i + 1], location: parts[i + 6] })
  })
  return [...rows.values()]
}

/** Tramo de una ubicación (índice en `MILESTONES`) o la razón de que quede fuera. Falla si la zona no está en `ZONES`. */
export function placeOf(location) {
  const zone = ZONES.find(([prefix]) => location.startsWith(prefix))
  if (!zone) throw new Error(`Ubicación sin tramo en ZONES: «${location}»`)
  const where = zone[1]
  if (typeof where === 'number') return { before: MILESTONES[where] }
  if (where.startsWith('reward:')) return { before: MILESTONES[MILESTONES.indexOf(where.slice('reward:'.length)) + 1] }
  return { excluded: EXCLUDED_REASON[where] }
}

export async function buildN2b2Calendar({ offline = false, refresh = false } = {}) {
  const { html } = await getPage(TM_PAGE, { pins: {}, offline, refresh })
  const machines = {}
  const excluded = {}
  for (const row of parseTmhm(html)) {
    const move = gen5.moves.get(row.move)?.id
    if (!move) throw new Error(`${row.id}: ataque desconocido «${row.move}»`)
    const place = placeOf(row.location)
    if (place.excluded) excluded[row.id] = { move, location: row.location, reason: place.excluded }
    else machines[row.id] = { before: place.before, move, location: row.location }
  }
  return {
    schemaVersion: 1,
    rulesVersion: 'unova-n2b2:2026-11-13',
    // Aprobado por Jose el 13/11/2026 (docs/nuzlocke/CALENDARIO-N2B2.md). Un cambio de reglas o de zonas pide aprobarlo de nuevo.
    approval: '2026-11-13',
    source: { url: TM_PAGE.url, sha256: createHash('sha256').update(html).digest('hex'), zones: 'Guía de Pokémon Negro 2 y Blanco 2 de WikiDex, por medallas' },
    milestones: MILESTONES,
    machines,
    excluded,
  }
}

export function validateN2b2Calendar(calendar) {
  if (calendar?.schemaVersion !== 1 || JSON.stringify(calendar.milestones) !== JSON.stringify(MILESTONES)) throw new Error('unova-n2b2-calendar.json: cabecera o hitos inválidos')
  const ids = [...Object.keys(calendar.machines), ...Object.keys(calendar.excluded)]
  if (ids.length !== 101 || new Set(ids).size !== 101) throw new Error('unova-n2b2-calendar.json: se esperan las 95 MT y 6 MO, cada una una vez')
  for (const [id, entry] of Object.entries(calendar.machines)) {
    if (!MILESTONES.includes(entry.before)) throw new Error(`${id}: hito inválido`)
    if (gen5.moves.get(entry.move)?.id !== entry.move) throw new Error(`${id}: ataque inválido`)
  }
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { offline: { type: 'boolean' }, refresh: { type: 'boolean' } } })
  const calendar = await buildN2b2Calendar(values)
  validateN2b2Calendar(calendar)
  await writeFile(N2B2_CALENDAR, `${JSON.stringify(calendar, null, 2)}\n`)
  console.log(`unova-n2b2-calendar.json: ${Object.keys(calendar.machines).length} MT/MO en el calendario, ${Object.keys(calendar.excluded).length} fuera`)
}
