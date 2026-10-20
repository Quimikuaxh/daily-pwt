import { describe, it, expect } from 'vitest'
import { Prng } from './prng'
import { rivalForDay } from './bag'

// UT-10..13 · RF-05 · DEC-03 · regla 12.
// TODO-CONTRATO: rivalForDay(dayIndex, schedule) vive en src/core/bag.ts y devuelve el id del entrenador.
// TODO-CONTRATO: una entrada fuera de frontera de ciclo lanza Error cuyo mensaje contiene "frontera".
type Schedule = { fromDayIndex: number; trainerIds: string[] }[]
const single = (ids: string[]): Schedule => [{ fromDayIndex: 0, trainerIds: ids }]
const days = (n: number, s: Schedule, from = 0) => Array.from({ length: n }, (_, i) => rivalForDay(from + i, s))
const ROSTER5 = ['brock', 'misty', 'camila', 'plubio', 'rojo']

/** Oráculo de DEC-03 para un roster fijo: shuffle del roster ordenado con semilla "daily-pwt:v1:bag:"+k y regla 12. */
function oracleCycles(ids: string[], cycles: number): string[][] {
  const out: string[][] = []
  for (let k = 0; k < cycles; k++) {
    const order = new Prng('daily-pwt:v1:bag:' + k).shuffle([...ids].sort())
    if (k > 0 && ids.length > 1 && order[0] === out[k - 1][out[k - 1].length - 1]) {
      ;[order[0], order[1]] = [order[1], order[0]]
    }
    out.push(order)
  }
  return out
}

describe('rivalForDay: bolsa barajada', () => {
  it('un ciclo completo es una permutación del roster', () => {
    expect([...days(5, single(ROSTER5))].sort()).toEqual([...ROSTER5].sort())
  })

  it('10 ciclos seguidos son cada uno una permutación', () => {
    const all = days(50, single(ROSTER5))
    for (let k = 0; k < 10; k++) expect([...all.slice(k * 5, k * 5 + 5)].sort(), `ciclo ${k}`).toEqual([...ROSTER5].sort())
  })

  it('sigue exactamente el algoritmo de DEC-03 durante 10 ciclos', () => {
    expect(days(50, single(ROSTER5))).toEqual(oracleCycles(ROSTER5, 10).flat())
  })

  it('es pura: mismas entradas, mismo rival', () => {
    expect(days(12, single(ROSTER5))).toEqual(days(12, single(ROSTER5)))
  })

  it('el orden del roster en el JSON no altera la secuencia (UT-11)', () => {
    expect(days(25, single([...ROSTER5].reverse()))).toEqual(days(25, single(ROSTER5)))
  })

  it('otro orden aleatorio del JSON tampoco la altera', () => {
    expect(days(25, single(['plubio', 'brock', 'rojo', 'misty', 'camila']))).toEqual(days(25, single(ROSTER5)))
  })

  it('el último del ciclo anterior nunca es el primero del siguiente (roster de 5, 200 ciclos)', () => {
    const seq = days(1000, single(ROSTER5))
    for (let k = 1; k < 200; k++) expect(seq[k * 5], `ciclo ${k}`).not.toBe(seq[k * 5 - 1])
  })
})

describe('rivalForDay: frontera de ciclo (UT-12, regla 12)', () => {
  it.each([2, 3, 4, 5, 6])('1000 ciclos con roster sintético de %i ids no repiten entre ciclos', (n) => {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`)
    const seq = days(n * 1000, single(ids))
    const offenders: number[] = []
    for (let k = 1; k < 1000; k++) if (seq[k * n] === seq[k * n - 1]) offenders.push(k)
    expect(offenders).toEqual([])
  })

  it.each([2, 3, 6])('con roster de %i ids cada ciclo sigue siendo permutación tras el intercambio', (n) => {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`)
    const seq = days(n * 300, single(ids))
    for (let k = 0; k < 300; k++) expect([...seq.slice(k * n, k * n + n)].sort()).toEqual([...ids].sort())
  })

  it('un roster de 1 devuelve siempre ese id y no se cuelga', () => {
    expect(days(10, single(['solo']))).toEqual(Array(10).fill('solo'))
  })
})

describe('rosterSchedule (UT-13)', () => {
  const base = ['a', 'b', 'c', 'd', 'e']

  it('una entrada fuera de frontera de ciclo falla con mensaje claro', () => {
    const bad: Schedule = [{ fromDayIndex: 0, trainerIds: base }, { fromDayIndex: 7, trainerIds: [...base, 'f'] }]
    expect(() => rivalForDay(0, bad)).toThrow(/frontera/i)
  })

  it('una entrada en frontera de ciclo es válida', () => {
    const ok: Schedule = [{ fromDayIndex: 0, trainerIds: base }, { fromDayIndex: 5, trainerIds: [...base, 'f'] }]
    expect(() => rivalForDay(9, ok)).not.toThrow()
  })

  it('añadir un entrenador en fromDayIndex=5 no altera los días 0-4', () => {
    const grown: Schedule = [{ fromDayIndex: 0, trainerIds: base }, { fromDayIndex: 5, trainerIds: [...base, 'f'] }]
    expect(days(5, grown)).toEqual(days(5, single(base)))
  })

  it('tras la entrada nueva, un ciclo contiene el roster ampliado completo', () => {
    const grown: Schedule = [{ fromDayIndex: 0, trainerIds: base }, { fromDayIndex: 5, trainerIds: [...base, 'f'] }]
    expect([...days(6, grown, 5)].sort()).toEqual([...base, 'f'].sort())
  })

  it('la frontera entre el último ciclo viejo y el primero nuevo no repite rival', () => {
    const grown: Schedule = [{ fromDayIndex: 0, trainerIds: base }, { fromDayIndex: 5, trainerIds: [...base, 'f'] }]
    const seq = days(11, grown)
    expect(seq[5]).not.toBe(seq[4])
  })

  it('un schedule vacío lanza un error', () => {
    expect(() => rivalForDay(0, [])).toThrow()
  })

  it('un roster vacío lanza un error', () => {
    expect(() => rivalForDay(0, single([]))).toThrow()
  })
})
