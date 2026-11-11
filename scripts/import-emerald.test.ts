import { describe, expect, it } from 'vitest'
import { importScript } from '../src/test-utils/paths'

const { buildEmeraldCatalog, parseEmeraldTeam } = await importScript('scripts/import-emerald.mjs')

const sourceTrainer = 'TRAINER_ROXANNE_1'
const trainerEntry = (trainer: string) => `
    [${trainer}] =
    {
        .party = ITEM_CUSTOM_MOVES(sParty_Example),
    },
`
const trainersSource = trainerEntry(sourceTrainer)
const partiesSource = `
static const struct TrainerMonItemCustomMoves sParty_Example[] = {
    {
    .iv = 100,
    .lvl = 12,
    .species = SPECIES_GEODUDE,
    .heldItem = ITEM_NONE,
    .moves = {MOVE_TACKLE, MOVE_DEFENSE_CURL, MOVE_ROCK_THROW, MOVE_ROCK_TOMB}
    },
    {
    .iv = 100,
    .lvl = 12,
    .species = SPECIES_GEODUDE,
    .heldItem = ITEM_NONE,
    .moves = {MOVE_TACKLE, MOVE_DEFENSE_CURL, MOVE_ROCK_THROW, MOVE_ROCK_TOMB}
    },
    {
    .iv = 200,
    .lvl = 15,
    .species = SPECIES_NOSEPASS,
    .heldItem = ITEM_ORAN_BERRY,
    .moves = {MOVE_BLOCK, MOVE_HARDEN, MOVE_TACKLE, MOVE_ROCK_TOMB}
    }
};
`

const campaignTrainers = [
  'TRAINER_ROXANNE_1', 'TRAINER_BRAWLY_1', 'TRAINER_WATTSON_1', 'TRAINER_FLANNERY_1',
  'TRAINER_NORMAN_1', 'TRAINER_WINONA_1', 'TRAINER_TATE_AND_LIZA_1', 'TRAINER_JUAN_1',
  'TRAINER_SIDNEY', 'TRAINER_PHOEBE', 'TRAINER_GLACIA', 'TRAINER_DRAKE', 'TRAINER_WALLACE',
]

describe('importación de equipos de Esmeralda', () => {
  it('conserva el orden, los miembros repetidos y los datos de cada set', () => {
    const geodude = {
      species: 'geodude', level: 12, item: null, iv: 12,
      moves: ['tackle', 'defensecurl', 'rockthrow', 'rocktomb'],
    }
    expect(parseEmeraldTeam(sourceTrainer, trainersSource, partiesSource)).toEqual([
      geodude,
      geodude,
      { species: 'nosepass', level: 15, item: 'oranberry', iv: 24, moves: ['block', 'harden', 'tackle', 'rocktomb'] },
    ])
  })

  it('omite los huecos MOVE_NONE sin completar el set con otros movimientos', () => {
    const source = partiesSource.replace('MOVE_BLOCK, MOVE_HARDEN', 'MOVE_NONE, MOVE_NONE')
    expect(parseEmeraldTeam(sourceTrainer, trainersSource, source)[2].moves).toEqual(['tackle', 'rocktomb'])
  })

  it.each([
    ['0', 0], ['100', 12], ['200', 24], ['255', 31],
  ])('convierte el byte de IV %s al valor %i de Esmeralda', (raw, iv) => {
    const source = partiesSource.replace('.iv = 100', `.iv = ${raw}`)
    expect(parseEmeraldTeam(sourceTrainer, trainersSource, source)[0].iv).toBe(iv)
  })

  it('rechaza un entrenador que no consta en la cabecera', () => {
    expect(() => parseEmeraldTeam(sourceTrainer, '', partiesSource)).toThrow(sourceTrainer)
  })

  it('rechaza un equipo enlazado que no consta en la cabecera', () => {
    expect(() => parseEmeraldTeam(sourceTrainer, trainersSource, '')).toThrow()
  })

  it('rechaza un equipo sin integrantes', () => {
    const source = 'static const struct TrainerMonItemCustomMoves sParty_Example[] = {};'
    expect(() => parseEmeraldTeam(sourceTrainer, trainersSource, source)).toThrow()
  })

  it('rechaza equipos sin movimientos explícitos', () => {
    const source = trainersSource.replace('ITEM_CUSTOM_MOVES', 'NO_ITEM_DEFAULT_MOVES')
    expect(() => parseEmeraldTeam(sourceTrainer, source, partiesSource)).toThrow()
  })

  it.each([
    ['.lvl = 12', '.lvl = 0'],
    ['.lvl = 12', '.lvl = 101'],
    ['.iv = 100', '.iv = 256'],
    ['.species = SPECIES_GEODUDE', '.species = SPECIES_GARCHOMP'],
    ['.heldItem = ITEM_ORAN_BERRY', '.heldItem = ITEM_LIFE_ORB'],
    ['MOVE_TACKLE', 'MOVE_MOONBLAST'],
  ])('rechaza un miembro con el campo inválido %s → %s', (field, invalid) => {
    const source = partiesSource.replace(field, invalid)
    expect(() => parseEmeraldTeam(sourceTrainer, trainersSource, source)).toThrow()
  })
})

describe('catálogo de Hoenn Esmeralda', () => {
  // Comparte un equipo de prueba y desordena la cabecera para comprobar el orden de la campaña.
  const source = [...campaignTrainers].reverse().map(trainerEntry).join('\n')

  it('identifica la región, edición y revisión de origen', () => {
    expect(buildEmeraldCatalog(source, partiesSource)).toMatchObject({
      schemaVersion: 1,
      region: 'hoenn',
      edition: 'emerald',
      source: { revision: '731ad5bfd6e6f265508d0efcca0ba42f9dcf5881' },
    })
  })

  it('ordena los ocho gimnasios, los cuatro miembros del Alto Mando y el campeón', () => {
    const { encounters } = buildEmeraldCatalog(source, partiesSource)
    expect(encounters.map(({ sourceTrainer, kind }: { sourceTrainer: string; kind: string }) => [sourceTrainer, kind])).toEqual(
      campaignTrainers.map((trainer, index) => [trainer, index < 8 ? 'gym' : index < 12 ? 'elite' : 'champion']),
    )
  })
})
