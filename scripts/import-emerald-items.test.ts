import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importScript } from '../src/test-utils/paths'

const { EMERALD_ITEMS, EMERALD_ITEM_LOCK, buildEmeraldItems, validateEmeraldItems } = await importScript('scripts/import-emerald-items.mjs')
const { readEmeraldSource } = await importScript('scripts/lib/emerald-source.mjs')
const catalog = JSON.parse(readFileSync(EMERALD_ITEMS, 'utf8'))
const lock = JSON.parse(readFileSync(EMERALD_ITEM_LOCK, 'utf8'))

describe('extracción de objetos de Esmeralda (evidencia, sin desbloqueos de campaña)', () => {
  it('cubre 50 MT, 8 MO, 12 objetos de evolución y los 13 combates', () => {
    expect(Object.keys(catalog.items)).toHaveLength(70)
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
      'src/data/pokemon/evolution.h': Object.values(catalog.items).filter((item: any) => !item.move).map((item: any) => `EVO_ITEM, ${item.token}`).join('\n'),
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
