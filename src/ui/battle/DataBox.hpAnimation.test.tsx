import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { DataBox } from './DataBox'

// Los PS numéricos del jugador cuentan a la par de la barra (un único valor animado): lineal, 700 ms / velocidad, entero en cada fotograma.
const MAX_HP = 150
const mon = (hp: number, species = 'garchomp') => ({ species, hp, maxHp: MAX_HP, hpPercent: Math.ceil((100 * hp) / MAX_HP), status: null, fainted: hp <= 0 })
const FRAME_MS = 16

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

type Frame = { shown: number; fillPx: number }

function readFrame(container: HTMLElement): Frame {
  const digits = [...container.querySelectorAll('.bt-databox-hp-now img')].map((image) => /hp-(\d)\.png$/.exec(image.getAttribute('src') ?? '')![1]).join('')
  return { shown: Number(digits), fillPx: parseInt((container.firstElementChild as HTMLElement).style.getPropertyValue('--fill'), 10) }
}

/** Renderiza `from`, pasa a cada valor de `targets` (uno tras otro, tras `gapsMs`) y registra TODOS los fotogramas. */
function record(targets: number[], options: { from: number; speed?: number; reducedMotion?: boolean; gapsMs?: number[]; tailMs?: number }): Frame[] {
  const { from, speed = 1, reducedMotion = false, gapsMs = [], tailMs = 1000 } = options
  const view = (hp: number) => <DataBox side="player" mon={mon(hp)} name="Garchomp" testId="player-hp" speed={speed} reducedMotion={reducedMotion} />
  const { container, rerender } = render(view(from))
  const frames = [readFrame(container)]
  const play = (milliseconds: number) => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += FRAME_MS) {
      act(() => { vi.advanceTimersByTime(FRAME_MS) })
      frames.push(readFrame(container))
    }
  }
  targets.forEach((target, index) => {
    act(() => rerender(view(target)))
    frames.push(readFrame(container))
    play(index < targets.length - 1 ? gapsMs[index] ?? 400 : tailMs)
  })
  return frames
}

const nonIncreasing = (values: number[]) => values.every((value, index) => index === 0 || value <= values[index - 1])
const nonDecreasing = (values: number[]) => values.every((value, index) => index === 0 || value >= values[index - 1])

describe('PS del jugador animados con la barra', () => {
  it('bajada: el número baja progresivamente, sin saltar al valor final, a la par de la barra y termina en el PS exacto', () => {
    const frames = record([2], { from: 150 })
    const shown = frames.map((frame) => frame.shown)
    expect(frames[1].shown, 'al recibir el ataque aún no ha bajado del todo').toBeGreaterThan(100)
    expect(nonIncreasing(shown)).toBe(true)
    expect(new Set(shown).size, 'pasa por muchos valores intermedios').toBeGreaterThan(20)
    expect(shown.at(-1)).toBe(2)
    for (const frame of frames) expect(Math.abs(frame.fillPx - (50 * frame.shown) / MAX_HP), `número ${frame.shown} y barra ${frame.fillPx}px`).toBeLessThanOrEqual(1)
  })

  it('curación: el número sube progresivamente a la par de la barra', () => {
    const frames = record([110], { from: 30 })
    const shown = frames.map((frame) => frame.shown)
    expect(nonDecreasing(shown)).toBe(true)
    expect(frames[1].shown).toBeLessThan(60)
    expect(shown.at(-1)).toBe(110)
    for (const frame of frames) expect(Math.abs(frame.fillPx - (50 * frame.shown) / MAX_HP)).toBeLessThanOrEqual(1)
  })

  it('varios golpes en el turno: no rebota, no sube entre golpes y acaba en el último valor', () => {
    const frames = record([100, 40, 2], { from: 150, gapsMs: [250, 250] })
    const shown = frames.map((frame) => frame.shown)
    expect(nonIncreasing(shown)).toBe(true)
    expect(shown.at(-1)).toBe(2)
    for (const frame of frames) expect(Math.abs(frame.fillPx - (50 * frame.shown) / MAX_HP)).toBeLessThanOrEqual(1)
  })

  it('daño y después curación en el mismo turno: baja y solo sube en el paso de curación', () => {
    const frames = record([60, 80], { from: 150, gapsMs: [800] })
    const shown = frames.map((frame) => frame.shown)
    const lowest = Math.min(...shown)
    expect(lowest).toBeLessThanOrEqual(60)
    expect(nonIncreasing(shown.slice(0, shown.indexOf(lowest) + 1))).toBe(true)
    expect(nonDecreasing(shown.slice(shown.indexOf(lowest)))).toBe(true)
    expect(shown.at(-1)).toBe(80)
  })

  it.each([[2, 350], [4, 175]])('a x%i tarda lo mismo que la barra: %i ms', (speed, expectedMs) => {
    const frames = record([30], { from: 150, speed })
    const settledAt = frames.findIndex((frame) => frame.shown === 30) * FRAME_MS
    expect(settledAt).toBeGreaterThanOrEqual(expectedMs - FRAME_MS)
    expect(settledAt).toBeLessThanOrEqual(expectedMs + 2 * FRAME_MS)
  })

  it('con prefers-reduced-motion el valor final llega directo, en el mismo fotograma', () => {
    const frames = record([20], { from: 150, reducedMotion: true })
    expect(frames[1]).toEqual({ shown: 20, fillPx: Math.round((50 * 20) / MAX_HP) })
  })

  it('al cambiar de Pokémon activo el número salta a los PS del nuevo, sin contar desde los del anterior', () => {
    const view = (species: string, hp: number) => <DataBox side="player" mon={mon(hp, species)} name="X" testId="player-hp" />
    const { container, rerender } = render(view('garchomp', 0))
    act(() => rerender(view('milotic', 150)))
    expect(readFrame(container).shown).toBe(150)
  })
})
