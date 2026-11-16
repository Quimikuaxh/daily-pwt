/**
 * Objetos de la locke de N2/B2 (PRD §0, 13/11/2026): equipables, bayas y objetos de evolución por tramo, y el canje de PB (tienda del
 * Metro Batalla). Fuentes: la página de objetos de Serebii (`items.shtml`: cada objeto con sus zonas, enlazadas a su página, y las
 * tiendas marcadas) y la de Metro Batalla (`battlesubway.shtml`: la tienda de PB con sus precios). El tramo de cada zona sale de la guía
 * de WikiDex por medallas, como en el calendario de MT (`build-n2b2-calendar.mjs`).
 *
 * Reglas, las de Hoenn: una unidad por fuente en los equipables; bayas y tiendas (con dinero), sin límite; los objetos de evolución, una
 * unidad por tipo en toda la campaña. Cuentan los objetos ocultos (Zahorí) y los de una sola versión (las dos versiones, PRD §0). Fuera:
 * lo de después de la Liga, lo aleatorio (nubes de polvo), lo semanal o de temporada y lo que pide una condición aparte. Las tiendas de PB
 * (Estación de Metro y PWT) van al canje.
 *
 * Uso: npm run gen:n2b2-items [-- --offline] [-- --refresh]
 */
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { Dex } from '@pkmn/sim'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'
import { getPage } from './lib/pwt-http.mjs'
import { BEFORE, MILESTONES } from './build-n2b2-calendar.mjs'

export const N2B2_ITEMS = fromRoot('data', 'nuzlocke', 'unova-n2b2-items.json')
const PAGES = {
  items: { source: 'serebii', key: 'n2b2-items', url: 'https://www.serebii.net/black2white2/items.shtml' },
  subway: { source: 'serebii', key: 'n2b2-subway', url: 'https://www.serebii.net/black2white2/battlesubway.shtml' },
}
const dex = Dex.forGen(5)

/** Página de zona de Serebii → tramo (guía de WikiDex por medallas), `post` (después de la Liga) o `bp` (tienda de PB). */
export const ZONE_PAGES = {
  route19: BEFORE.cheren, route20: BEFORE.cheren,
  virbankcomplex: BEFORE.hiedra, pokestarstudios: BEFORE.hiedra,
  casteliacity: BEFORE.camus, casteliasewers: BEFORE.camus, relicpassage: BEFORE.camus,
  route4: BEFORE.camila, desertresort: BEFORE.camila, reliccastle: BEFORE.camila, nimbasacity: BEFORE.camila, route16: BEFORE.camila,
  lostlornforest: BEFORE.camila,
  route5: BEFORE.yakon, driftveilcity: BEFORE.yakon,
  route6: BEFORE.gerania, chargestonecave: BEFORE.gerania, mistraltoncave: BEFORE.gerania, mistraltoncity: BEFORE.gerania,
  route7: BEFORE.lirio, celestialtower: BEFORE.lirio, lentimastown: BEFORE.lirio, strangehouse: BEFORE.lirio, reversalmountain: BEFORE.lirio,
  undellatown: BEFORE.lirio, undellabay: BEFORE.lirio, route13: BEFORE.lirio, lacunosatown: BEFORE.lirio, route11: BEFORE.lirio,
  opelucidcity: BEFORE.lirio, route9: BEFORE.lirio,
  // La Fragata Plasma se visita antes de Gerania y antes de la Liga; como con la MT67, la última visita.
  route22: BEFORE.liga, seasidecave: BEFORE.liga, plasmafrigate: BEFORE.liga, giantchasm: BEFORE.liga, route23: BEFORE.liga,
  victoryroadb2w2: BEFORE.liga,
  gearstation: 'bp', pwt: 'bp',
  route1: 'post', route8: 'post', route18: 'post', nuvematown: 'post', accumulatown: 'post', striatoncity: 'post', dreamyard: 'post', pinwheelforest: 'post',
  icirruscity: 'post', mooroficirrus: 'post', dragonspiraltower: 'post', twistmountain: 'post', wellspringcave: 'post', abundantshrine: 'post',
  abyssalruins: 'post', claytunnel: 'post', clayroad: 'post', undergroundruins: 'post', rebirthmoutnain: 'post', relicpath: 'post',
  p2laboratory: 'post', blackcity: 'post', whiteforest: 'post',
}

/** Condición entre paréntesis tras una zona: `null` cuenta; un texto es el motivo de que esa fuente quede fuera. */
export const CONDITIONS = {
  'With Dowsing Machine': null,
  'White 2 Only': null,
  'Black 2 Only': null,
  'Battle Company': null,
  Dustcloud: 'aleatorio (nubes de polvo)',
  'Tuesday - Defeat Three Trainers on Royal Unova': 'semanal',
  'Winter Only': 'de temporada',
  'Guitarist - Good Ending': 'minijuego de Pokéwood',
  'Show Kricketot & Whismur': 'enseñar Pokémon concretos',
  'Show Level 50-98 Pokémon to Fan Club Owner': 'enseñar Pokémon concretos',
  'After capturing Latios/Latias': 'capturar un legendario',
  'From Gorm': 'después de la Liga',
  'Show Genesect - Black 2': 'después de la Liga',
  'Show Genesect - White 2': 'después de la Liga',
}

const evolutionItems = new Set(dex.species.all().filter((species) => species.evoItem).map((species) => dex.items.get(species.evoItem).id))
/** Equipables cuyo efecto el simulador programa en el ataque o el clima, no en el objeto (sin manejador propio). */
const EFFECT_ELSEWHERE = new Set(['bindingband', 'gripclaw', 'lightclay', 'heatrock', 'damprock', 'icyrock', 'smoothrock', 'fullincense', 'laggingtail', 'ringtarget'])
/** Equipable con efecto en combate: con algún manejador del simulador, gema o de la lista anterior. */
export function hasBattleEffect(id) {
  const item = dex.items.get(id)
  return item.exists && (item.isGem || EFFECT_ELSEWHERE.has(item.id) || Object.keys(item).some((key) => key.startsWith('on') && typeof item[key] === 'function'))
}
/** Objeto de evolución, baya o equipable con efecto en combate; `null` para el resto (Poké Balls, fósiles, objetos de valor). */
export function kindOf(id) {
  const item = dex.items.get(id)
  if (!item.exists) return null
  if (evolutionItems.has(item.id)) return 'evolution'
  if (item.isBerry) return 'berry'
  return hasBattleEffect(item.id) ? 'held' : null
}

/** Fuentes de un objeto: cada zona con si es tienda y su condición. */
export function parseItemSources(cell) {
  const sources = []
  let shop = false
  for (const match of cell.matchAll(/(<b>Shop<\/b>)|pokearth\/unova\/([a-z0-9-]+)\.shtml|\(([^)]*)\)/g)) {
    if (match[1]) shop = true
    else if (match[2]) sources.push({ zone: match[2], shop, condition: null })
    else if (sources.length) sources[sources.length - 1].condition = match[3]
  }
  return sources
}

export function parseItemsPage(html) {
  return html.split('<tr height="32">').slice(1).flatMap((row) => {
    const id = /itemdex\/([a-z0-9-]+)\.shtml/.exec(row)?.[1]
    const kind = id && kindOf(id)
    if (!kind) return []
    return [{ id: dex.items.get(id).id, kind, sources: parseItemSources(row.split('<td class="fooinfo">')[3] ?? '') }]
  })
}

/** Objetos recios retirados del canje de campaña. Sus fuentes del recorrido siguen en el calendario. */
const POWER_ITEMS = new Set(['powerbracer', 'powerbelt', 'powerlens', 'powerband', 'poweranklet', 'powerweight'])
const isSubwayOffer = (id) => hasBattleEffect(id) && !POWER_ITEMS.has(id)

/** Tienda de PB del Metro Batalla: objeto y precio de los equipables del canje. */
export function parseSubwayShop(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ').replace(/(\|\s*)+/g, '|')
  const shop = text.slice(text.indexOf('|Item|Price|'), text.indexOf('|Game Names|'))
  return [...shop.matchAll(/\|([A-Za-z' .-]+)\|(\d+)BP/gi)]
    .map((match) => ({ item: dex.items.get(match[1]).id, price: Number(match[2]) }))
    // Los equipables, también los que además hacen evolucionar (Garra Afilada, Colmillo Agudo); fuera piedras y vitaminas.
    .filter((entry) => isSubwayOffer(entry.item))
}

function placeSource(source) {
  const where = ZONE_PAGES[source.zone]
  if (where === undefined) throw new Error(`Zona de Serebii sin tramo en ZONE_PAGES: «${source.zone}»`)
  if (source.condition !== null && !(source.condition in CONDITIONS)) throw new Error(`Condición sin regla en CONDITIONS: «${source.condition}»`)
  const reason = source.condition !== null ? CONDITIONS[source.condition] : null
  if (where === 'bp') return { excluded: 'tienda de PB (canje)' }
  if (where === 'post') return { excluded: 'después de la Liga' }
  if (reason) return { excluded: reason }
  return { before: MILESTONES[where], zone: source.zone, shop: source.shop }
}

const earliest = (sources) => sources.reduce((best, source) => (MILESTONES.indexOf(source.before) < MILESTONES.indexOf(best.before) ? source : best))

export async function buildN2b2Items({ offline = false, refresh = false } = {}) {
  const html = {}
  const source = {}
  for (const [name, page] of Object.entries(PAGES)) {
    html[name] = (await getPage(page, { pins: {}, offline, refresh })).html
    source[name] = { url: page.url, sha256: createHash('sha256').update(html[name]).digest('hex') }
  }
  const held = {}
  const evolution = {}
  const excluded = {}
  for (const item of parseItemsPage(html.items)) {
    const placed = item.sources.map(placeSource)
    const usable = placed.filter((entry) => entry.before)
    if (!usable.length) {
      const reasons = placed.map((entry) => POWER_ITEMS.has(item.id) && entry.excluded === 'tienda de PB (canje)'
        ? 'objeto recio retirado del canje' : entry.excluded)
      excluded[item.id] = [...new Set(reasons)].join('; ') || 'sin fuente'
      continue
    }
    const first = earliest(usable)
    if (item.kind === 'evolution') evolution[item.id] = { before: first.before, zone: first.zone }
    else {
      const shop = usable.filter((entry) => entry.shop)
      const infinite = item.kind === 'berry' || shop.length > 0
      held[item.id] = {
        kind: item.kind,
        before: first.before,
        ...(infinite ? { infinite: true, from: (shop.length ? earliest(shop) : first).zone } : {}),
        units: infinite ? [] : usable.map((entry) => ({ before: entry.before, zone: entry.zone })),
      }
    }
  }
  return {
    schemaVersion: 1,
    rulesVersion: 'unova-n2b2-items:2026-11-13',
    // Aprobado por Jose el 13/11/2026 (docs/nuzlocke/CALENDARIO-N2B2.md), con 8 PB por gimnasio y 3 sin bajas.
    approval: '2026-11-13',
    exchangePoints: { perGym: 8, flawlessBonus: 3 },
    source,
    milestones: MILESTONES,
    held,
    evolution,
    excluded,
    exchange: parseSubwayShop(html.subway),
  }
}

export function validateN2b2Items(items) {
  if (items?.schemaVersion !== 1 || JSON.stringify(items.milestones) !== JSON.stringify(MILESTONES)) throw new Error('unova-n2b2-items.json: cabecera o hitos inválidos')
  for (const [id, entry] of [...Object.entries(items.held), ...Object.entries(items.evolution)]) {
    if (!kindOf(id) || !MILESTONES.includes(entry.before)) throw new Error(`${id}: objeto o hito inválido`)
  }
  if (!items.exchange.length || items.exchange.some((entry) => !isSubwayOffer(entry.item) || !Number.isInteger(entry.price) || entry.price < 1)) {
    throw new Error('unova-n2b2-items.json: canje inválido')
  }
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { offline: { type: 'boolean' }, refresh: { type: 'boolean' } } })
  const items = await buildN2b2Items(values)
  validateN2b2Items(items)
  await writeFile(N2B2_ITEMS, `${JSON.stringify(items, null, 2)}\n`)
  console.log(`unova-n2b2-items.json: ${Object.keys(items.held).length} equipables y bayas, ${Object.keys(items.evolution).length} de evolución, ${Object.keys(items.excluded).length} fuera, ${items.exchange.length} en el canje`)
}
