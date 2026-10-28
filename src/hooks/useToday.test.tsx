import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useToday } from './useToday'
import { challengeFor, getDailyChallenge } from '../core/challenge'
import { makeGameData } from '../test-utils/fixtures'
import { setMadridTime } from '../test-utils/ui'
import { LAUNCH } from '../test-utils/dates'

// RF-30/31 (hook detrás de la pantalla Hoy). TODO-CONTRATO: useToday(data: GameData) en src/hooks/useToday.ts devuelve
//   { challenge: Challenge | null; countdown: string /* hh:mm:ss */; error: string | null /* español, sin trazas */ }.
const data = makeGameData()
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useToday', () => {
  it('devuelve el reto de la fecha de Madrid', () => {
    setMadridTime('2026-10-21', 9)
    const { result } = renderHook(() => useToday(data))
    expect(result.current.challenge).toEqual(getDailyChallenge('2026-10-21', data))
  })

  it('con rival forzado por id (ganchos de prueba) devuelve ese entrenador y variante, sin pasar por la bolsa', () => {
    setMadridTime(LAUNCH, 9)
    const { result } = renderHook(() => useToday(data, undefined, { trainerId: 'gamma' }))
    expect(result.current.challenge).toEqual(challengeFor({ date: LAUNCH, trainerId: 'gamma' }, data))
  })

  it('con un rival forzado inexistente devuelve el error de datos', () => {
    setMadridTime(LAUNCH, 9)
    const { result } = renderHook(() => useToday(data, undefined, { trainerId: 'nadie' }))
    expect([result.current.challenge, result.current.error]).toEqual([null, expect.stringMatching(/datos/i)])
  })

  it('la cuenta atrás tiene formato hh:mm:ss', () => {
    setMadridTime(LAUNCH, 20, 15, 30)
    const { result } = renderHook(() => useToday(data))
    expect(result.current.countdown).toBe('03:44:30')
  })

  it('actualiza la cuenta atrás cada segundo', () => {
    setMadridTime(LAUNCH, 20, 15, 30)
    const { result } = renderHook(() => useToday(data))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.countdown).toBe('03:44:27')
  })

  it('cambia de reto al cruzar la medianoche', () => {
    setMadridTime(LAUNCH, 23, 59, 58)
    const { result } = renderHook(() => useToday(data))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.challenge!.number).toBe(2)
  })

  it('con datos corruptos devuelve error en español y challenge null, sin lanzar', () => {
    setMadridTime(LAUNCH, 12)
    const { result } = renderHook(() => useToday({ ...data, trainers: undefined } as any))
    expect([result.current.challenge, result.current.error]).toEqual([null, expect.stringMatching(/datos/i)])
  })

  it('al desmontar limpia el temporizador', () => {
    setMadridTime(LAUNCH, 12)
    const { unmount } = renderHook(() => useToday(data))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
