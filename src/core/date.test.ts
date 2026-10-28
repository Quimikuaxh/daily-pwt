import { describe, it, expect, afterEach } from 'vitest'
import { challengeDate, msUntilNextChallenge, madridInstant, dayIndex, challengeNumber } from './date'

const LAUNCH = '2026-10-17'
const originalTZ = process.env.TZ
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ
  else process.env.TZ = originalTZ
})
const inTZ = (tz: string) => { process.env.TZ = tz }

// UT-03 · RF-01 (cambio de Jose del 28/10/2026): la fecha del reto es la de Madrid, sea cual sea la zona del dispositivo.
describe('challengeDate (UT-03, RF-01)', () => {
  it.each(['Pacific/Auckland', 'UTC', 'America/Mexico_City', 'Atlantic/Canary', 'Europe/Madrid'])('es la fecha de Madrid con el dispositivo en %s', (tz) => {
    inTZ(tz)
    // 22:30Z del 17 = 00:30 del 18 en Madrid (CEST); en Canarias aún son las 23:30 del 17.
    expect(challengeDate(new Date('2026-10-17T22:30:00Z'))).toBe('2026-10-18')
    expect(challengeDate(new Date('2026-10-17T21:59:59Z'))).toBe('2026-10-17')
  })

  it('23:59:59 de Madrid sigue siendo el mismo día y 00:00:00 ya es el siguiente', () => {
    inTZ('UTC')
    expect(challengeDate(madridInstant('2026-10-17', 23, 59, 59))).toBe('2026-10-17')
    expect(challengeDate(madridInstant('2026-10-18'))).toBe('2026-10-18')
  })

  it('en invierno, la medianoche de Madrid es a las 23:00 UTC', () => {
    expect(madridInstant('2027-01-05').toISOString()).toBe('2027-01-04T23:00:00.000Z')
    expect(challengeDate(new Date('2027-01-04T23:00:00Z'))).toBe('2027-01-05')
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

describe('msUntilNextChallenge (UT-05, RF-30)', () => {
  it('1000 ms a las 23:59:59 de Madrid y 86 400 000 a las 00:00, con el dispositivo en otra zona', () => {
    inTZ('America/Mexico_City')
    expect(msUntilNextChallenge(madridInstant('2026-10-17', 23, 59, 59))).toBe(1000)
    expect(msUntilNextChallenge(madridInstant('2026-10-17'))).toBe(86_400_000)
  })

  it('día de 23 h (marzo) y de 25 h (octubre) en Madrid', () => {
    inTZ('UTC')
    expect(msUntilNextChallenge(madridInstant('2027-03-28'))).toBe(82_800_000)
    expect(msUntilNextChallenge(madridInstant('2027-10-31'))).toBe(90_000_000)
  })

  it('termina justo en la medianoche de Madrid', () => {
    inTZ('Atlantic/Canary')
    const now = madridInstant('2026-10-17', 23, 59, 59)
    const target = new Date(now.getTime() + msUntilNextChallenge(now))
    expect(challengeDate(target)).toBe('2026-10-18')
    expect(msUntilNextChallenge(new Date(now.getTime() + 500))).toBe(500)
  })
})
