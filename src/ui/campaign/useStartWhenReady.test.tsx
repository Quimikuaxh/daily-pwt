import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStartWhenReady } from './useStartWhenReady'

// UT-220 · Combate de la campaña con la cuenta (Jose, 14/11/2026, Sixto): la sesión se crea aunque el guardado haya terminado antes de
// escuchar al almacén (sin otro aviso, la pantalla se quedaba en negro hasta recargar).
describe('useStartWhenReady', () => {
  it('si ya se puede al suscribirse, arranca sin esperar a un aviso', () => {
    const start = vi.fn()
    renderHook(() => useStartWhenReady(true, () => () => {}, () => true, start))
    expect(start).toHaveBeenCalledOnce()
  })

  it('si aún no se puede, arranca con el aviso del almacén, una sola vez', () => {
    let ready = false
    const listeners = new Set<() => void>()
    const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
    const start = vi.fn()
    renderHook(() => useStartWhenReady(true, subscribe, () => ready, start))
    expect(start).not.toHaveBeenCalled()
    ready = true
    listeners.forEach((listener) => listener())
    listeners.forEach((listener) => listener())
    expect(start).toHaveBeenCalledOnce()
  })

  it('inactivo (sin combate o con sesión), no hace nada', () => {
    const start = vi.fn()
    renderHook(() => useStartWhenReady(false, () => () => {}, () => true, start))
    expect(start).not.toHaveBeenCalled()
  })
})
