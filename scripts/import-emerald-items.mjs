import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { isMain } from './lib/cli.mjs'
import { EMERALD_REVISION, gen3, readEmeraldSource } from './lib/emerald-source.mjs'
import { itemRoute } from './lib/emerald-item-route.mjs'
import { fromRoot } from './lib/paths.mjs'

export const EMERALD_ITEMS = fromRoot('data', 'nuzlocke', 'hoenn-emerald-items.json')
export const EMERALD_ITEM_LOCK = fromRoot('data', 'nuzlocke', 'emerald-item-source-lock.json')
const campaignPath = fromRoot('data', 'nuzlocke', 'hoenn-emerald.json')
const id = token => token.toLowerCase().replaceAll('_', '')
const unique = values => [...new Set(values)]
const decisionTypes = new Set(['random-reward', 'wild-held', 'scanner-choice', 'friendship-reward', 'postgame'])

export async function loadEmeraldItemSources(sourceDir) {
  const lock = JSON.parse(await readFile(EMERALD_ITEM_LOCK, 'utf8'))
  if (lock.revision !== EMERALD_REVISION) throw new Error('Revisión del manifiesto de objetos inválida')
  // Lectura secuencial: evita lanzar más de mil peticiones si se usa la fuente remota.
  const sources = {}
  for (const [path, hash] of Object.entries(lock.files)) sources[path] = await readEmeraldSource(path, hash, sourceDir)
  return sources
}

function scriptBlocks(sources) {
  const blocks = new Map()
  for (const [path, text] of Object.entries(sources)) {
    if (!path.endsWith('.inc')) continue
    const labels = [...text.matchAll(/^(\w+)::?[^\S\n]*\n/gm)]
    labels.forEach((match, index) => {
      const body = text.slice(match.index + match[0].length, labels[index + 1]?.index ?? text.length)
      const line = text.slice(0, match.index).split('\n').length
      blocks.set(match[1], { label: match[1], path, line, body })
    })
  }
  return blocks
}

function machineItems(source) {
  const items = {}
  for (const [kind, count] of [['TM', 50], ['HM', 8]]) {
    const body = source.match(new RegExp(`#define FOREACH_${kind}\\(F\\) ([\\s\\S]*?)(?=\\n\\s*#)`))?.[1] ?? ''
    const tokens = [...body.matchAll(/F\((\w+)\)/g)].map(match => match[1])
    if (tokens.length !== count) throw new Error(`Número de ${kind} inválido`)
    tokens.forEach((token, index) => {
      items[`ITEM_${kind}_${token}`] = { id: `${kind.toLowerCase()}${String(index + 1).padStart(2, '0')}`, move: id(token) }
    })
  }
  return items
}

function references(block, blocks) {
  return unique([...block.body.matchAll(/^\s*(?:goto\w*|call\w*|case|map_script\w*|trainerbattle\w*)\s+([^\n@]+)/gm)]
    .flatMap(([, args]) => args.match(/\b\w+\b/g) ?? []).filter(token => blocks.has(token)))
}

function ancestors(target, reverse) {
  const visited = new Set([target])
  const queue = [target]
  for (let index = 0; index < queue.length; index++) {
    for (const parent of reverse.get(queue[index]) ?? []) {
      if (!visited.has(parent)) { visited.add(parent); queue.push(parent) }
    }
  }
  return visited
}

function flagEvidence(sources, flags) {
  const evidence = []
  for (const [path, text] of Object.entries(sources)) {
    if (!path.endsWith('.inc')) continue
    text.split('\n').forEach((line, index) => {
      if (/^\s*(?:setflag|clearflag|goto_if_|call_if_|checkflag)/.test(line) &&
        [...flags].some(flag => line.match(/\bFLAG_\w+/g)?.includes(flag))) {
        evidence.push({ path, line: index + 1, command: line.trim() })
      }
    })
  }
  return evidence
}

/** Extrae evidencia; las anotaciones de ruta no autorizan desbloqueos de campaña. */
export function buildEmeraldItems(sources, encounters) {
  const definitions = machineItems(sources['include/constants/tms_hms.h'])
  for (const [, token] of sources['src/data/pokemon/evolution.h'].matchAll(/EVO_(?:ITEM|TRADE_ITEM),\s*ITEM_(\w+)/g)) {
    definitions[`ITEM_${token}`] = { id: id(token) }
  }
  // Objetos equipables (Jose, 11/11/2026): los que tienen efecto al llevarlos en src/data/items.h, bayas de combate incluidas.
  const heldEffects = {}
  for (const [, token, body] of sources['src/data/items.h'].matchAll(/\[(ITEM_\w+)\]\s*=\s*\{([\s\S]*?)\n    \},/g)) {
    const effect = body.match(/holdEffect = (HOLD_EFFECT_\w+)/)?.[1]
    if (!effect || effect === 'HOLD_EFFECT_NONE') continue
    heldEffects[token] = effect
    definitions[token] ??= { id: id(token.slice(5)) }
    definitions[token].held = token.endsWith('_BERRY') ? 'berry' : 'held'
  }
  const resourceTokens = ['RED', 'BLUE', 'YELLOW', 'GREEN'].map(color => `ITEM_${color}_SHARD`)
  for (const token of resourceTokens) definitions[token] = { id: id(token.slice(5)) }
  const blocks = scriptBlocks(sources)
  const reverse = new Map()
  for (const block of blocks.values()) {
    for (const target of references(block, blocks)) {
      if (!reverse.has(target)) reverse.set(target, [])
      reverse.get(target).push(block.label)
    }
  }
  const maps = Object.entries(sources).filter(([path]) => /^data\/maps\/[^/]+\/map.json$/.test(path))
    .map(([path, text]) => ({ path, ...JSON.parse(text) }))
  const acquisitions = []
  function add(token, origin, type, route, evidence) {
    if (!definitions[token]) return
    acquisitions.push({ item: definitions[token].id, token, type, ...route, ...origin, ...evidence })
  }
  for (const block of blocks.values()) {
    const lines = block.body.split('\n')
    lines.forEach((line, index) => {
      const match = line.match(/^\s*(giveitem|finditem|additem|\.2byte)\s+(ITEM_\w+)\b/) ??
        line.match(/^\s*(setvar)\s+VAR_0x8009,\s*(ITEM_\w+)\b/)
      if (!match || !definitions[match[2]]) return
      const [, command, token] = match
      if (command === '.2byte' && !block.label.includes('Pokemart')) return
      const parents = ancestors(block.label, reverse)
      let mapName = block.path.match(/^data\/maps\/([^/]+)\//)?.[1]
      const eventSources = []
      for (const map of maps) {
        for (const kind of ['object_events', 'coord_events', 'bg_events']) {
          (map[kind] ?? []).forEach((event, eventIndex) => {
            if (parents.has(event.script) && (!mapName || map.name === mapName)) {
              eventSources.push({ map: map.name, path: map.path, kind, index: eventIndex, ...event })
            }
          })
        }
      }
      mapName ??= eventSources[0]?.map
      if (!mapName) throw new Error(`Adquisición sin mapa: ${block.label}`)
      const contextBlocks = [...parents].map(label => blocks.get(label)).filter(parent =>
        parent.path === block.path || parent.path === `data/maps/${mapName}/scripts.inc`)
      const controlEvidence = contextBlocks.flatMap(parent => parent.body.split('\n').flatMap((command, offset) =>
        /^\s*(?:goto_if_|call_if_|checkitem|checkflag|setflag|clearflag|setvar|compare|special|trainerbattle|map_script_2)/.test(command)
          ? [{ path: parent.path, line: parent.line + offset + 1, command: command.trim() }] : []))
      const flags = new Set([...controlEvidence.flatMap(entry => entry.command.match(/\bFLAG_\w+/g) ?? []),
        ...eventSources.map(event => event.flag).filter(flag => flag?.startsWith('FLAG_'))])
      const route = itemRoute(mapName, block.label, token)
      const type = route.decision === 'postgame' ? 'posliga' : route.decision === 'scanner-choice' ? 'excluyente' :
        command === 'finditem' ? 'suelo' : command === '.2byte' || mapName.endsWith('GameCorner') ? 'tienda' : 'regalo'
      add(token, { map: mapName, event: block.label }, type, route, {
        source: { path: block.path, line: block.line + index + 1, command: line.trim() },
        eventSources, controlEvidence, flagEvidence: flagEvidence(sources, flags),
      })
    })
  }
  for (const map of maps) {
    for (const [index, event] of (map.bg_events ?? []).entries()) {
      if (!definitions[event.item]) continue
      add(event.item, { map: map.name, event: `bg_events[${index}]` }, 'suelo', itemRoute(map.name, '', event.item), {
        source: { path: map.path, event: { ...event } }, eventSources: [], controlEvidence: [],
        flagEvidence: flagEvidence(sources, new Set([event.flag])),
      })
    }
  }
  // Árboles de bayas con baya plantada al empezar (include/constants/berry.h: BERRY_TREE_<RUTA>_<BAYA>[_n]; «SOIL» es tierra vacía).
  const treeNames = new Map([...sources['include/constants/berry.h'].matchAll(/#define (BERRY_TREE_\w+)\s+(\d+)/g)].map(([, name, value]) => [value, name]))
  for (const map of maps) {
    for (const [index, event] of (map.object_events ?? []).entries()) {
      if (!String(event.graphics_id).includes('BERRY_TREE')) continue
      const raw = String(event.trainer_sight_or_berry_tree_id)
      const tree = raw.startsWith('BERRY_TREE_') ? raw : treeNames.get(raw)
      const berry = tree?.match(/^BERRY_TREE_ROUTE_\d+_([A-Z]+)(?:_\d+)?$/)?.[1]
      if (!berry || berry === 'SOIL') continue
      add(`ITEM_${berry}_BERRY`, { map: map.name, event: `object_events[${index}]` }, 'árbol', itemRoute(map.name, '', `ITEM_${berry}_BERRY`), {
        source: { path: map.path, event: { ...event }, tree }, eventSources: [], controlEvidence: [], flagEvidence: [],
      })
    }
  }
  // Canje del Frente Batalla (objetos equipables y su precio en PB): catálogo para la tienda de Puntos Batalla de la campaña.
  const exchangeList = sources['src/data/battle_frontier/battle_frontier_exchange_corner.h'].match(/sFrontierExchangeCorner_HoldItems\[\]\s*=\s*\{([^}]+)\}/)?.[1]
  const exchangeScript = sources['data/maps/BattleFrontier_ExchangeServiceCorner/scripts.inc']
  const exchange = [...(exchangeList ?? '').matchAll(/ITEM_\w+/g)].map(([token]) => token).filter(token => token !== 'ITEM_LIST_END').map(token => {
    const price = exchangeScript.match(new RegExp(`setvar VAR_0x8008, (\\d+)\\n\\s*setvar VAR_0x8009, ${token}\\b`))?.[1]
    if (!price || !definitions[token]) throw new Error(`Canje sin precio: ${token}`)
    return { item: definitions[token].id, token, price: Number(price) }
  })
  if (exchange.length !== 9) throw new Error('Canje de objetos equipables inválido')
  const pickupPath = 'src/battle_script_commands.c'
  const pickup = sources[pickupPath].match(/sRarePickupItems\[\]\s*=\s*\{([^}]+)\}/)?.[1]
  if (!pickup) throw new Error('Tabla de Recogida ausente')
  const pickupTokens = [...pickup.matchAll(/ITEM_\w+/g)].map(match => match[0])
  pickupTokens.forEach((token, index) => {
    if (!definitions[token]) return
    const minLevel = Math.max(1, (index - 1) * 10 + 1)
    const earliest = encounters.find(encounter => Math.max(...encounter.team.map(mon => mon.level)) >= minLevel)?.id ?? null
    add(token, { map: null, event: 'sRarePickupItems' }, 'premio aleatorio', {
      earliestBefore: earliest, requirements: ['ABILITY_PICKUP', `nivel mínimo ${minLevel}`, 'tirada de Recogida'], decision: 'random-reward',
    }, { source: { path: pickupPath, tableIndex: index, minLevel } })
  })
  const wildGroups = JSON.parse(sources['src/data/wild_encounters.json']).wild_encounter_groups.filter(group => group.for_maps)
  const wilds = wildGroups.flatMap(group => group.encounters)
  const rods = wildGroups.flatMap(group => group.fields ?? []).find(field => field.type === 'fishing_mons')?.groups ?? {}
  for (const [, species, body] of sources['src/data/pokemon/species_info.h'].matchAll(/^    \[SPECIES_(\w+)\]\s*=\s*\{([\s\S]*?)^    \},/gm)) {
    for (const [, frequency, token] of body.matchAll(/\.item(Common|Rare)\s*=\s*(ITEM_\w+)/g)) {
      if (!definitions[token] || resourceTokens.includes(token)) continue
      const locations = wilds.flatMap(encounter => Object.entries(encounter).flatMap(([method, table]) =>
        (table?.mons ?? []).flatMap((mon, slot) => mon.species === `SPECIES_${species}` ? [{
          map: encounter.map, method, slot, minLevel: mon.min_level, maxLevel: mon.max_level,
          ...itemRoute(maps.find(map => map.id === encounter.map)?.name, '', token),
          ...(method === 'fishing_mons' ? { rod: Object.entries(rods).find(([, slots]) => slots.includes(slot))?.[0], rodSource: 'data/maps/MossdeepCity_House3/scripts.inc' } : {}),
        }] : [])))
      const earliest = encounters.find(encounter => locations.some(location => location.earliestBefore === encounter.id))?.id ?? null
      // Conserva también especies sin encuentro salvaje: su tabla no demuestra obtención en Esmeralda.
      add(token, { map: null, event: `SPECIES_${species}` }, 'premio aleatorio', {
        earliestBefore: earliest, requirements: ['objeto equipado salvaje', `frecuencia ${frequency}`, ...(locations.length ? ['encuentro y objeto aleatorios'] : ['sin encuentro salvaje en Esmeralda'])], decision: 'wild-held',
      }, { source: { path: 'src/data/pokemon/species_info.h', species, frequency, wildMaps: unique(locations.map(location => location.map)), locations } })
    }
  }
  for (const path of ['src/trainer_hill.c', 'src/battle_pyramid.c']) {
    const pattern = path.includes('trainer_hill') ? /static const u16 (sPrizeList\w+)\[\]\s*=\s*\{([^}]+)\}/g :
      /static const u16 (sPickupItemsLvl50|sPickupItemsLvlOpen)[^=]*=\s*\{([\s\S]*?)\};/g
    for (const [, table, body] of sources[path].matchAll(pattern)) {
      for (const token of unique(body.match(/ITEM_\w+/g) ?? [])) {
        const map = path.includes('trainer_hill') ? 'TrainerHill_Entrance' : 'BattleFrontier_BattlePyramidFloor'
        add(token, { map, event: table }, 'posliga', {
          earliestBefore: null, requirements: ['FLAG_SYS_GAME_CLEAR', 'premios de instalación',
            ...(path.includes('battle_pyramid') ? ['solo bolsa de la Pirámide; no se conserva al salir'] : [])], decision: 'postgame',
        }, { source: { path, table } })
      }
    }
  }
  const badgeMoves = [...sources['src/party_menu.c'].matchAll(/FIELD_MOVE_(\w+),\s*\/\/ FLAG_BADGE(\d+)_GET/g)]
  const entries = Object.entries(definitions).map(([token, definition]) => {
    const found = acquisitions.filter(source => source.token === token)
    const certain = found.filter(source => !source.decision && source.earliestBefore)
    const earliest = encounters.find(encounter => certain.some(source => source.earliestBefore === encounter.id))?.id ?? null
    const badge = token.startsWith('ITEM_HM_') && badgeMoves.find(([, move]) => token === `ITEM_HM_${move}`)?.[2]
    return [definition.id, { ...definition, token, earliestBefore: earliest, sources: found,
      ...(badge ? { fieldUse: { badgeFlag: `FLAG_BADGE${badge}_GET`, after: encounters[Number(badge) - 1].id, source: 'src/party_menu.c' } } : {}),
      ...(found.length ? {} : { absence: 'Sin adquisición identificada en las fuentes examinadas; no equivale a disponibilidad.' }),
    }]
  })
  const items = Object.fromEntries(entries.filter(([, entry]) => !resourceTokens.includes(entry.token)))
  const resources = Object.fromEntries(entries.filter(([, entry]) => resourceTokens.includes(entry.token)))
  const result = {
    schemaVersion: 1, source: { revision: EMERALD_REVISION, lock: 'emerald-item-source-lock.json' },
    scope: 'Evidencia de obtención con combates en orden y exploración opcional sin glitches. No autoriza desbloqueos de campaña.',
    milestones: encounters.map(encounter => encounter.id), items, resources, exchange,
    geographyEvidence: ['data/layouts/Route124/map.bin', 'data/layouts/Route126/map.bin', 'data/layouts/Underwater_Route124/map.bin', 'data/layouts/Underwater_Route126/map.bin'],
  }
  validateEmeraldItems(result)
  return result
}

export function validateEmeraldItems(catalog) {
  if (catalog?.schemaVersion !== 1 || catalog.source?.revision !== EMERALD_REVISION ||
    catalog.milestones?.length !== 13 || !catalog.items || Object.keys(catalog.items).length !== 134 ||
    Object.values(catalog.items).filter(item => item.held).length !== 70 || catalog.exchange?.length !== 9) throw new Error(`Cabecera de objetos inválida (${Object.keys(catalog.items ?? {}).length} objetos, ${Object.values(catalog.items ?? {}).filter(item => item.held).length} equipables, ${catalog.exchange?.length} de canje)`)
  const validMilestone = value => value === null || catalog.milestones.includes(value)
  for (const [key, item] of Object.entries({ ...catalog.items, ...catalog.resources })) {
    if (item.id !== key || !/^ITEM_\w+$/.test(item.token) || !validMilestone(item.earliestBefore) || !Array.isArray(item.sources)) throw new Error(`${key}: objeto inválido`)
    if (item.move && !gen3.moves.get(item.move)) throw new Error(`${key}: movimiento inválido`)
    for (const source of item.sources) {
      if (source.item !== key || source.token !== item.token || !validMilestone(source.earliestBefore) ||
        !['suelo', 'regalo', 'tienda', 'árbol', 'premio aleatorio', 'excluyente', 'posliga'].includes(source.type) ||
        !source.event || !source.source?.path || !Array.isArray(source.requirements) ||
        (source.decision && !decisionTypes.has(source.decision))) throw new Error(`${key}: adquisición inválida`)
      if (source.resource && (!catalog.resources?.[source.resource]?.earliestBefore ||
        catalog.milestones.indexOf(source.earliestBefore) < catalog.milestones.indexOf(catalog.resources[source.resource].earliestBefore))) {
        throw new Error(`${key}: intercambio anterior a su fragmento`)
      }
    }
    const expected = catalog.milestones.find(milestone => item.sources.some(source => !source.decision && source.earliestBefore === milestone)) ?? null
    if (item.earliestBefore !== expected) throw new Error(`${key}: primer hito inconsistente`)
    if (key.startsWith('hm') && (!item.fieldUse || !catalog.milestones.includes(item.fieldUse.after))) throw new Error(`${key}: permiso de MO ausente`)
  }
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { 'source-dir': { type: 'string' }, check: { type: 'boolean', default: false } } })
  const sources = await loadEmeraldItemSources(values['source-dir'])
  const { encounters } = JSON.parse(await readFile(campaignPath, 'utf8'))
  const catalog = buildEmeraldItems(sources, encounters)
  const bytes = `${JSON.stringify(catalog, null, 2)}\n`
  if (values.check) {
    if (await readFile(EMERALD_ITEMS, 'utf8') !== bytes) throw new Error('La extracción de objetos versionada no es reproducible')
  } else {
    await mkdir(dirname(EMERALD_ITEMS), { recursive: true })
    await writeFile(EMERALD_ITEMS, bytes)
  }
  console.log(`Esmeralda: ${Object.keys(catalog.items).length} objetos, ${Object.values(catalog.items).reduce((n, item) => n + item.sources.length, 0)} fuentes; ${values.check ? 'reproducción exacta' : 'evidencia extraída'}`)
}
