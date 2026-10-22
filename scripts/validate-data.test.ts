import { describe, it, expect } from 'vitest'
import { importScript, readJson } from '../src/test-utils/paths'

const { setProblems, scheduleProblems, trainerProblems, validateData } = await importScript('scripts/validate-data.mjs')

// DEC-38 · PRD §8.3. El validador debe aceptar los datos reales y rechazar cada clase de dato roto.
const names = readJson('src', 'generated', 'names-es.json')
const rules = readJson('src', 'core', 'pwt-rules.json')
const context = { names, rules }
const legalSet = () => ({ species: 'garchomp', level: 50, item: 'lifeorb', abilities: ['roughskin'], moves: ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], verified: true })
const withChange = (change: Record<string, unknown>) => ({ ...legalSet(), ...change })

describe('validate-data: sets', () => {
  it('acepta un set legal', async () => {
    expect(await setProblems(legalSet(), 'x', context)).toEqual([])
  })

  it.each([
    ['especie inexistente', { species: 'sylveon' }, /especie inexistente/],
    ['legendario prohibido', { species: 'kyogre', abilities: ['drizzle'], moves: ['surf', 'icebeam', 'thunder', 'calmmind'] }, /prohibida en el PWT/],
    ['objeto inexistente', { item: 'notanitem' }, /objeto inexistente/],
    ['objeto prohibido (Rocío Bondad)', { item: 'souldew' }, /objeto prohibido/],
    ['movimiento prohibido (Caída Libre)', { moves: ['skydrop', 'outrage', 'stoneedge', 'swordsdance'] }, /movimiento prohibido/],
    ['movimiento de Gen 6', { moves: ['moonblast', 'outrage', 'stoneedge', 'swordsdance'] }, /inexistente en Gen 5/],
    ['movimiento que la especie no aprende', { moves: ['spore', 'outrage', 'stoneedge', 'swordsdance'] }, /no aprende/],
    ['habilidad ajena a la especie', { abilities: ['levitate'] }, /no es de garchomp/],
    ['3 movimientos', { moves: ['earthquake', 'outrage', 'stoneedge'] }, /3 movimientos/],
    ['movimientos repetidos', { moves: ['earthquake', 'earthquake', 'stoneedge', 'swordsdance'] }, /repetidos/],
    ['nivel 100', { level: 100 }, /nivel 100/],
  ])('rechaza: %s', async (_label, change, expected) => {
    expect((await setProblems(withChange(change), 'x', context)).join('\n')).toMatch(expected)
  })

  it('rechaza un nombre en español que falta', async () => {
    const withoutName = { ...names, moves: { ...names.moves, earthquake: undefined } }
    expect((await setProblems(legalSet(), 'x', { names: withoutName, rules })).join('\n')).toMatch(/falta el nombre en español del movimiento/)
  })
})

describe('validate-data: entrenadores y calendario', () => {
  const trainersFile = readJson('data', 'trainers.json')
  const brock = () => structuredClone(trainersFile.trainers.find((trainer: { id: string }) => trainer.id === 'brock'))

  it('acepta un entrenador real', () => {
    expect(trainerProblems(brock())).toEqual([])
  })

  it('rechaza un líder con una sola variante, sin variantes, IV incorrectos, equipo de 5 y alwaysLeadsWith ausente', () => {
    const oneVariant = brock()
    oneVariant.variants = oneVariant.variants.slice(0, 1)
    expect(trainerProblems(oneVariant).join('\n')).toMatch(/1 variantes \(mínimo 2\)/)
    const none = brock()
    none.variants = []
    expect(trainerProblems(none).join('\n')).toMatch(/sin variantes/)
    const wrongIvs = brock()
    wrongIvs.ivs = 31
    expect(trainerProblems(wrongIvs).join('\n')).toMatch(/ivs 31/)
    const fiveMembers = brock()
    fiveMembers.variants[0].team.pop()
    expect(trainerProblems(fiveMembers).join('\n')).toMatch(/5 Pokémon/)
    const missingLead = brock()
    missingLead.alwaysLeadsWith = 'pikachu'
    expect(trainerProblems(missingLead).join('\n')).toMatch(/alwaysLeadsWith/)
  })

  it('el calendario real es válido y uno con un entrenador desconocido o fuera de frontera de ciclo no', () => {
    const ids = new Set<string>(trainersFile.trainers.map((trainer: { id: string }) => trainer.id))
    expect(scheduleProblems(trainersFile.rosterSchedule, ids)).toEqual([])
    expect(scheduleProblems([{ fromDayIndex: 0, trainerIds: [...ids, 'fantasma'] }], ids).join('\n')).toMatch(/desconocido/)
    expect(scheduleProblems([{ fromDayIndex: 0, trainerIds: ['brock', 'misty'] }, { fromDayIndex: 3, trainerIds: [...ids] }], ids).join('\n')).toMatch(/frontera de ciclo/)
  })
})

describe('validate-data: datos reales', () => {
  it('los datos versionados no tienen problemas', async () => {
    const { problems, coverage } = await validateData()
    expect(problems).toEqual([])
    expect(coverage.trainers).toBe(53)
    expect(coverage.trainersWithoutVariants).toEqual([])
  })
})
