import { describe, it, expect, afterEach } from 'vitest'
import { localDate, msUntilNextLocalMidnight, dayIndex, challengeNumber } from './date'

// TODO-CONTRATO: el fichero src/core/date.ts agrupa localDate, msUntilNextLocalMidnight, dayIndex y challengeNumber.
const LAUNCH = '2026-10-17'
const originalTZ = process.env.TZ
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ
  else process.env.TZ = originalTZ
})
const inTZ = (tz: string) => { process.env.TZ = tz }

describe('localDate (UT-03, RF-01)', () => {
  it('usa los getters locales, no UTC (Auckland adelantado)', () => {
    inTZ('Pacific/Auckland')
    // 12:30 UTC del 17 = 01:30 del 18 en Auckland (NZDT, +13).
    expect(localDate(new Date('2026-10-17T12:30:00Z'))).toBe('2026-10-18')
  })

  it('usa los getters locales en UTC', () => {
    inTZ('UTC')
    expect(localDate(new Date('2026-10-17T12:30:00Z'))).toBe('2026-10-17')
  })

  it('usa los getters locales en Madrid cerca de la medianoche', () => {
    inTZ('Europe/Madrid')
    // 22:30Z del 17 = 00:30 del 18 en Madrid (CEST).
    expect(localDate(new Date('2026-10-17T22:30:00Z'))).toBe('2026-10-18')
  })

  it('23:59:59 sigue siendo el mismo día', () => {
    inTZ('Europe/Madrid')
    expect(localDate(new Date(2026, 9, 17, 23, 59, 59))).toBe('2026-10-17')
  })

  it('00:00:00 ya es el día siguiente', () => {
    inTZ('Europe/Madrid')
    expect(localDate(new Date(2026, 9, 18, 0, 0, 0))).toBe('2026-10-18')
  })

  it('rellena con ceros mes y día', () => {
    inTZ('UTC')
    expect(localDate(new Date(2027, 0, 5, 10))).toBe('2027-01-05')
  })
})

describe('dayIndex / challengeNumber (UT-04, RF-09)', () => {
  it.each([
    ['2026-10-17', 1],
    ['2026-10-18', 2],
    ['2026-10-22', 6],
    ['2027-10-17', 366],
  ])('%s es el reto #%i', (date, n) => {
    expect(challengeNumber(date, LAUNCH)).toBe(n)
  })

  it('un día anterior al lanzamiento cuenta como #1', () => {
    expect(challengeNumber('2026-10-16', LAUNCH)).toBe(1)
  })

  it('una fecha muy anterior también cuenta como #1', () => {
    expect(challengeNumber('2020-01-01', LAUNCH)).toBe(1)
  })

  it('dayIndex del día de lanzamiento es 0', () => {
    expect(dayIndex('2026-10-17', LAUNCH)).toBe(0)
  })

  it('dayIndex del día siguiente es 1', () => {
    expect(dayIndex('2026-10-18', LAUNCH)).toBe(1)
  })

  it('el cambio de hora de primavera cuenta un día exacto (2027-03-27 -> 28 -> 29)', () => {
    expect(dayIndex('2027-03-28', LAUNCH) - dayIndex('2027-03-27', LAUNCH)).toBe(1)
    expect(dayIndex('2027-03-29', LAUNCH) - dayIndex('2027-03-28', LAUNCH)).toBe(1)
  })

  it('el cambio de hora de otoño cuenta un día exacto (2027-10-30 -> 31 -> 11-01)', () => {
    expect(dayIndex('2027-10-31', LAUNCH) - dayIndex('2027-10-30', LAUNCH)).toBe(1)
    expect(dayIndex('2027-11-01', LAUNCH) - dayIndex('2027-10-31', LAUNCH)).toBe(1)
  })

  it('no depende de la zona horaria del proceso', () => {
    inTZ('Pacific/Auckland')
    const a = dayIndex('2027-03-28', LAUNCH)
    inTZ('America/Los_Angeles')
    expect(dayIndex('2027-03-28', LAUNCH)).toBe(a)
  })
})

describe('msUntilNextLocalMidnight (UT-05, RF-30)', () => {
  it('quedan 1000 ms a las 23:59:59', () => {
    inTZ('Europe/Madrid')
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 17, 23, 59, 59))).toBe(1000)
  })

  it('quedan 86 400 000 ms a las 00:00:00 de un día normal', () => {
    inTZ('Europe/Madrid')
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 17, 0, 0, 0))).toBe(86_400_000)
  })

  it('en el día de 23 h (2027-03-28 Madrid) quedan 82 800 000 ms a las 00:00', () => {
    inTZ('Europe/Madrid')
    expect(msUntilNextLocalMidnight(new Date(2027, 2, 28, 0, 0, 0))).toBe(82_800_000)
  })

  it('en el día de 25 h (2027-10-31 Madrid) quedan 90 000 000 ms a las 00:00', () => {
    inTZ('Europe/Madrid')
    expect(msUntilNextLocalMidnight(new Date(2027, 9, 31, 0, 0, 0))).toBe(90_000_000)
  })

  it('con milisegundos sueltos redondea hacia lo que realmente queda', () => {
    inTZ('Europe/Madrid')
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 17, 23, 59, 59, 500))).toBe(500)
  })

  it('termina en la medianoche local real en Auckland', () => {
    inTZ('Pacific/Auckland')
    const now = new Date(2026, 9, 17, 12, 0, 0)
    const target = new Date(now.getTime() + msUntilNextLocalMidnight(now))
    expect(localDate(target)).toBe('2026-10-18')
    expect([target.getHours(), target.getMinutes(), target.getSeconds()]).toEqual([0, 0, 0])
  })
})
