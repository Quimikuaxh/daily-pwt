import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromRoot, importScript, readJson } from '../src/test-utils/paths'

const { EMERALD_ITEMS, EMERALD_ITEM_LOCK, buildEmeraldItems, validateEmeraldItems, loadEmeraldItemSources } = await importScript('scripts/import-emerald-items.mjs')
const { readEmeraldSource } = await importScript('scripts/lib/emerald-source.mjs')
const catalog = JSON.parse(readFileSync(EMERALD_ITEMS, 'utf8'))
const lock = JSON.parse(readFileSync(EMERALD_ITEM_LOCK, 'utf8'))

describe('extracción de objetos de Esmeralda (evidencia, sin desbloqueos de campaña)', () => {
  it('cubre 134 objetos, 70 equipables, nueve de canje y los 13 combates', () => {
    expect(Object.keys(catalog.items)).toHaveLength(134)
    expect(Object.values(catalog.items).filter((item: any) => item.held)).toHaveLength(70)
    expect(catalog.exchange).toHaveLength(9)
    expect(catalog.milestones).toHaveLength(13)
    expect(() => validateEmeraldItems(catalog)).not.toThrow()
    expect(Object.values(lock.files)).toEqual(expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64}$/)]))
    expect(lock.files['include/constants/tms_hms.h']).toBe('649802a5a5fa8ce042d748e14770007a29f6a4fadc626f2bf8f2101436b0cb4a')
  })

  it('distingue recibir Corte y Destello de poder usarlos fuera de combate', () => {
    expect(catalog.items.hm01).toMatchObject({ earliestBefore: 'petra', fieldUse: { after: 'petra', badgeFlag: 'FLAG_BADGE01_GET' } })
    expect(catalog.items.hm05).toMatchObject({ earliestBefore: 'marcial', fieldUse: { after: 'marcial', badgeFlag: 'FLAG_BADGE02_GET' } })
    expect(catalog.items.hm01.sources[0].eventSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ map: 'RustboroCity_CuttersHouse', script: 'RustboroCity_CuttersHouse_EventScript_Cutter' }),
    ]))
  })

  it('cruza la bandera que oculta al NPC de Bomba Lodo con Norman', () => {
    expect(catalog.items.tm36.earliestBefore).toBe('alana')
    expect(catalog.items.tm36.sources[0].flagEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'data/scripts/new_game.inc', command: 'setflag FLAG_HIDE_DEWFORD_HALL_SLUDGE_BOMB_MAN' }),
      expect.objectContaining({ path: 'data/maps/PetalburgCity_Gym/scripts.inc', command: 'clearflag FLAG_HIDE_DEWFORD_HALL_SLUDGE_BOMB_MAN' }),
    ]))
  })

  it('encuentra las MT ocultas, las tiendas y los premios por fichas', () => {
    expect(catalog.items.tm32.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ map: 'Route113', type: 'suelo', event: 'bg_events[6]' }),
      expect.objectContaining({ map: 'MauvilleCity_GameCorner', type: 'tienda' }),
    ]))
    expect(catalog.items.tm14.sources[0]).toMatchObject({ type: 'tienda', map: 'LilycoveCity_DepartmentStore_4F' })
  })

  it('conserva exclusiones, Recogida y especies con objetos sin concederlos', () => {
    expect(catalog.items.deepseatooth).toMatchObject({ earliestBefore: null, sources: [expect.objectContaining({ decision: 'scanner-choice', earliestBefore: 'galano' })] })
    expect(catalog.items.tm49).toMatchObject({ earliestBefore: null, sources: [expect.objectContaining({ type: 'posliga' })] })
    expect(catalog.items.tm26.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ decision: 'random-reward', earliestBefore: null, source: expect.objectContaining({ minLevel: 91 }) }),
    ]))
    expect(catalog.items.metalcoat.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ decision: 'wild-held', event: 'SPECIES_MAGNEMITE', source: expect.objectContaining({ wildMaps: expect.arrayContaining(['MAP_NEW_MAUVILLE_INSIDE']) }) }),
    ]))
    expect(catalog.items.upgrade).toMatchObject({ earliestBefore: null, sources: [], absence: expect.any(String) })
  })

  it('no adelanta los intercambios de piedras al acceso a sus fragmentos', () => {
    expect(Object.keys(catalog.resources)).toHaveLength(4)
    expect(catalog.resources.yellowshard.earliestBefore).toBe('alana')
    expect(catalog.resources.blueshard.earliestBefore).toBe('galano')
    expect(catalog.items.waterstone.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ resource: 'blueshard', earliestBefore: 'galano' }),
    ]))
    const broken = structuredClone(catalog)
    broken.items.waterstone.sources.find((source: any) => source.resource).earliestBefore = 'alana'
    expect(() => validateEmeraldItems(broken)).toThrow('intercambio anterior a su fragmento')
  })

  it('extrae scripts, referencias y campos anidados de especie de forma determinista', () => {
    const machines = (kind: string) => Object.values(catalog.items).filter((item: any) => item.id.startsWith(kind.toLowerCase()))
      .map((item: any) => `F(${item.token.replace(`ITEM_${kind}_`, '')})`).join(' ')
    const sources = {
      'include/constants/tms_hms.h': `#define FOREACH_TM(F) ${machines('TM')}\n#define FOREACH_HM(F) ${machines('HM')}\n#endif`,
      'src/data/pokemon/evolution.h': Object.values(catalog.items).filter((item: any) => ['thunderstone', 'moonstone', 'firestone', 'leafstone', 'sunstone', 'waterstone', 'kingsrock', 'metalcoat', 'dragonscale', 'upgrade', 'deepseatooth', 'deepseascale'].includes(item.id)).map((item: any) => `EVO_ITEM, ${item.token}`).join('\n'),
      'src/data/items.h': Object.values(catalog.items).filter((item: any) => item.held)
        .map((item: any) => `[${item.token}] = {\n        .holdEffect = HOLD_EFFECT_TEST,\n    },`).join('\n') +
        '\n[ITEM_POTION] = {\n        .holdEffect = HOLD_EFFECT_NONE,\n    },',
      'include/constants/berry.h': '#define BERRY_TREE_ROUTE_102_ORAN 1\n#define BERRY_TREE_ROUTE_102_SOIL 2',
      'src/data/battle_frontier/battle_frontier_exchange_corner.h': `sFrontierExchangeCorner_HoldItems[] = { ${catalog.exchange.map((entry: any) => entry.token).join(', ')}, ITEM_LIST_END }`,
      'data/maps/BattleFrontier_ExchangeServiceCorner/scripts.inc': catalog.exchange.map((entry: any) =>
        `Buy${entry.item}::\n\tsetvar VAR_0x8008, ${entry.price}\n\tsetvar VAR_0x8009, ${entry.token}\n\tend\n`).join('\n'),
      'data/maps/Route102/map.json': JSON.stringify({ name: 'Route102', object_events: [
        { graphics_id: 'OBJ_EVENT_GFX_BERRY_TREE', trainer_sight_or_berry_tree_id: '1' },
        { graphics_id: 'OBJ_EVENT_GFX_BERRY_TREE', trainer_sight_or_berry_tree_id: 'BERRY_TREE_ROUTE_102_ORAN' },
        { graphics_id: 'OBJ_EVENT_GFX_BERRY_TREE', trainer_sight_or_berry_tree_id: '2' },
      ] }),
      'src/party_menu.c': ['CUT', 'FLASH', 'ROCK_SMASH', 'STRENGTH', 'SURF', 'FLY', 'DIVE', 'WATERFALL'].map((move, index) => `FIELD_MOVE_${move}, // FLAG_BADGE0${index + 1}_GET`).join('\n'),
      'src/battle_script_commands.c': 'sRarePickupItems[] = { ITEM_KINGS_ROCK }',
      'src/data/wild_encounters.json': '{"wild_encounter_groups":[]}',
      'src/data/pokemon/species_info.h': '    [SPECIES_MAGNEMITE] =\n    {\n        .types = {TYPE_STEEL, TYPE_ELECTRIC},\n        .itemRare = ITEM_METAL_COAT,\n    },',
      'src/trainer_hill.c': '', 'src/battle_pyramid.c': '',
      'data/maps/RustboroCity_CuttersHouse/map.json': JSON.stringify({ name: 'RustboroCity_CuttersHouse', object_events: [{ script: 'Cutter', flag: 'FLAG_HIDE_CUTTER' }] }),
      'data/maps/RustboroCity_CuttersHouse/scripts.inc': 'Cutter::\n\tgoto_if_unset FLAG_RECEIVED_HM_CUT, Gift\n\tend\nGift::\n\tgiveitem ITEM_HM_CUT\n\tend\n',
    }
    const encounters = catalog.milestones.map((id: string) => ({ id, team: [{ level: 15 }] }))
    const first = buildEmeraldItems(sources, encounters)
    expect(JSON.stringify(buildEmeraldItems(sources, encounters))).toBe(JSON.stringify(first))
    expect(first.items.hm01.sources[0].eventSources[0].script).toBe('Cutter')
    expect(first.items.metalcoat.sources[0].event).toBe('SPECIES_MAGNEMITE')
    expect(first.items.potion).toBeUndefined()
    expect(first.items.oranberry).toMatchObject({ held: 'berry', earliestBefore: 'petra' })
    expect(first.items.oranberry.sources).toHaveLength(2)
    expect(first.items.oranberry.sources.map((source: any) => source.type)).toEqual(['árbol', 'árbol'])
    expect(first.items.quickclaw.held).toBe('held')
    expect(first.exchange).toEqual(catalog.exchange)
  })

  it('rechaza una fuente local cuyo SHA no coincide', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'emerald-items-'))
    try {
      writeFileSync(join(dir, 'changed.inc'), 'giveitem ITEM_HM_CUT\n')
      await expect(readEmeraldSource('changed.inc', '0'.repeat(64), dir)).rejects.toThrow('SHA-256 distinto')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('rechaza adelantar un hito o incorporar una recompensa pendiente al resumen', () => {
    const broken = structuredClone(catalog)
    broken.items.hm03.earliestBefore = 'petra'
    expect(() => validateEmeraldItems(broken)).toThrow('primer hito inconsistente')
    broken.items.hm03.earliestBefore = 'alana'
    broken.items.deepseatooth.earliestBefore = 'galano'
    expect(() => validateEmeraldItems(broken)).toThrow('primer hito inconsistente')
  })
})

const runNode = promisify(execFile)
const sourceDir = process.env.EMERALD_SRC
it.skipIf(!sourceDir)('DEC-94: --check reproduce el catálogo desde las fuentes fijadas sin escribir', async () => {
  const before = readFileSync(EMERALD_ITEMS)
  const sources = await loadEmeraldItemSources(sourceDir!)
  const { encounters } = readJson<any>('data', 'nuzlocke', 'hoenn-emerald.json')
  expect(`${JSON.stringify(buildEmeraldItems(sources, encounters), null, 2)}\n`).toBe(before.toString('utf8'))
  await runNode(process.execPath, [fromRoot('scripts/import-emerald-items.mjs'), '--source-dir', sourceDir!, '--check'], { encoding: 'utf8', timeout: 60_000 })
  expect(readFileSync(EMERALD_ITEMS)).toEqual(before)
}, 60_000)

it('DEC-94: fija los nueve precios del canje y conserva las fuentes de bayas y equipables', () => {
  expect(catalog.exchange.map(({ item, price }: any) => [item, price])).toEqual([
    ['leftovers', 48], ['whiteherb', 48], ['quickclaw', 48], ['mentalherb', 48],
    ['brightpowder', 64], ['choiceband', 64], ['kingsrock', 64], ['focusband', 64], ['scopelens', 64],
  ])
  expect(catalog.items.oranberry.sources).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'árbol', map: 'Route102', earliestBefore: 'petra',
      source: expect.objectContaining({ tree: 'BERRY_TREE_ROUTE_102_ORAN' }) }),
  ]))
  expect(catalog.items.silkscarf).toMatchObject({ held: 'held', earliestBefore: 'marcial' })
  for (const path of ['src/data/items.h', 'include/constants/berry.h',
    'src/data/battle_frontier/battle_frontier_exchange_corner.h']) expect(lock.files[path]).toMatch(/^[a-f0-9]{64}$/)
})
