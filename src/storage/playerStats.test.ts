import { describe, expect, it } from 'vitest'
import type { DayRecord, DayStatus } from './gameStore'
import { computeStats } from './playerStats'

const day = (date: string, status: DayStatus): DayRecord => ({
  date, challengeNumber: 1, trainerId: 'misty', variantId: 'misty-1', dataVersion: 'v1', status, startedAt: `${date}T10:00:00Z`,
  finishedAt: status === 'inProgress' ? null : `${date}T10:10:00Z`, turns: 10, survivors: 2, playerFainted: null, rivalFainted: 6,
  endReason: null, voidReason: null, battle: null,
})

// UT-63 · PRD §10.4, §11 y criterio 14; decisiones de Jose del 22/10/2026 (anulado, racha de días viva hasta jugar hoy).
describe('computeStats', () => {
  it('sin historial, todo a 0', () => {
    expect(computeStats([], '2026-10-22')).toEqual({ played: 0, wins: 0, winPercent: 0, winStreak: 0, maxWinStreak: 0, dayStreak: 0, maxDayStreak: 0 })
  })

  it('ganar dos días seguidos da racha de victorias 2 y de días 2', () => {
    const stats = computeStats([day('2026-10-21', 'won'), day('2026-10-22', 'won')], '2026-10-22')
    expect(stats).toMatchObject({ played: 2, wins: 2, winPercent: 100, winStreak: 2, maxWinStreak: 2, dayStreak: 2, maxDayStreak: 2 })
  })

  it('perder pone la racha de victorias a 0 aunque se haya jugado (la de días sigue)', () => {
    const stats = computeStats([day('2026-10-20', 'won'), day('2026-10-21', 'won'), day('2026-10-22', 'lost')], '2026-10-22')
    expect(stats).toMatchObject({ winStreak: 0, maxWinStreak: 2, dayStreak: 3, winPercent: 67 })
  })

  it('saltarse un día pone la racha de días a 0', () => {
    const stats = computeStats([day('2026-10-19', 'won'), day('2026-10-20', 'won')], '2026-10-22')
    expect(stats).toMatchObject({ dayStreak: 0, maxDayStreak: 2 })
  })

  it('si hoy aún no se ha jugado, la racha de días de ayer sigue viva', () => {
    const days = [day('2026-10-20', 'won'), day('2026-10-21', 'won')]
    expect(computeStats(days, '2026-10-22').dayStreak).toBe(2)
    expect(computeStats([...days, day('2026-10-22', 'inProgress')], '2026-10-22').dayStreak).toBe(2)
  })

  it('un anulado cuenta como jugado, no es victoria ni derrota, corta la racha de victorias y mantiene la de días', () => {
    const stats = computeStats([day('2026-10-20', 'won'), day('2026-10-21', 'void'), day('2026-10-22', 'won')], '2026-10-22')
    expect(stats).toMatchObject({ played: 3, wins: 2, winPercent: 67, winStreak: 1, maxWinStreak: 1, dayStreak: 3 })
  })

  it('un oficial en curso no cuenta todavía', () => {
    expect(computeStats([day('2026-10-22', 'inProgress')], '2026-10-22')).toMatchObject({ played: 0, dayStreak: 0 })
  })

  it('la racha máxima se mide entre huecos y cruza meses', () => {
    const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-05'].map((date) => day(date, 'won'))
    expect(computeStats(days, '2026-10-05')).toMatchObject({ dayStreak: 1, maxDayStreak: 3, winStreak: 1, maxWinStreak: 3 })
  })

  it('un día sin jugar rompe también la racha de victorias (decisión de Jose)', () => {
    const days = [day('2026-10-19', 'won'), day('2026-10-20', 'won'), day('2026-10-22', 'won')]
    expect(computeStats(days, '2026-10-22')).toMatchObject({ winStreak: 1, maxWinStreak: 2 })
    expect(computeStats(days.slice(0, 2), '2026-10-22')).toMatchObject({ winStreak: 0, dayStreak: 0 })
  })

  it('si hoy aún no se ha jugado, la racha de victorias de ayer sigue viva', () => {
    expect(computeStats([day('2026-10-20', 'won'), day('2026-10-21', 'won')], '2026-10-22').winStreak).toBe(2)
  })
})
