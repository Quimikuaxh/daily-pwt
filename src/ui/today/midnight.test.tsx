import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodayScreen } from './TodayScreen'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { settle, setLocalTime } from '../../test-utils/ui'
import { LAUNCH, addDays } from '../../test-utils/dates'

// CMP-02 · RF-31 · criterio de aceptación 2. Cambio de día con la pantalla abierta, sin recargar.
const data = makeGameData()
const originalTZ = process.env.TZ
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  vi.useRealTimers()
  if (originalTZ === undefined) delete process.env.TZ
  else process.env.TZ = originalTZ
})
const mount = () => render(<TodayScreen data={data} onStart={vi.fn()} />)

describe('medianoche con Hoy abierta', () => {
  it('cruzar la medianoche cambia #1 a #2 sin recargar', async () => {
    setLocalTime(LAUNCH, 23, 59, 55)
    mount()
    expect(screen.getByRole('banner')).toHaveTextContent('#1')
    await settle(6000)
    expect(screen.getByRole('banner')).toHaveTextContent('#2')
  })

  it('el rival pasa a ser el del día siguiente', async () => {
    setLocalTime(LAUNCH, 23, 59, 55)
    mount()
    await settle(6000)
    const next = getDailyChallenge(addDays(LAUNCH, 1), data)
    expect(screen.getByRole('region', { name: /rival/i })).toHaveTextContent(next.trainer.nameEs)
  })

  it('el equipo del jugador pasa a ser el del día siguiente', async () => {
    setLocalTime(LAUNCH, 23, 59, 55)
    mount()
    await settle(6000)
    const next = getDailyChallenge(addDays(LAUNCH, 1), data)
    expect(screen.getByRole('region', { name: /tu equipo/i })).toHaveTextContent(next.playerTeam[0].nameEs)
  })

  it('la cuenta atrás se reinicia tras la medianoche (más de 23 h)', async () => {
    // Un día normal de 24 h: D+1 (2026-10-25) es el cambio de hora de otoño en Madrid y dura 25 h (24:59:59 sería correcto).
    setLocalTime(addDays(LAUNCH, 2), 23, 59, 55)
    mount()
    await settle(6000)
    expect(screen.getByRole('banner').textContent).toMatch(/23:59:5\d/)
  })

  it('hay un solo temporizador activo antes y después de cruzar la medianoche', async () => {
    setLocalTime(LAUNCH, 23, 59, 55)
    mount()
    const before = vi.getTimerCount()
    await settle(6000)
    expect([before, vi.getTimerCount()]).toEqual([1, 1])
  })

  it('al desmontar no queda ningún temporizador', () => {
    setLocalTime(LAUNCH, 12)
    const { unmount } = mount()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('el inicial elegido se deselecciona al cambiar de reto', async () => {
    setLocalTime(LAUNCH, 23, 59, 55)
    mount()
    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getAllByRole('button', { name: /primero/i })[0])
    await settle(6000)
    expect(screen.getAllByRole('button', { name: /primero/i }).filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(0)
  })

  it('día de 23 h (2027-03-28, Madrid): a las 00:00 la cuenta atrás muestra 23:00:00', () => {
    process.env.TZ = 'Europe/Madrid'
    setLocalTime('2027-03-28', 0, 0, 0)
    mount()
    expect(screen.getByRole('banner')).toHaveTextContent('23:00:00')
  })

  it('día de 25 h (2027-10-31, Madrid): a las 00:00 la cuenta atrás muestra 25:00:00', () => {
    process.env.TZ = 'Europe/Madrid'
    setLocalTime('2027-10-31', 0, 0, 0)
    mount()
    expect(screen.getByRole('banner')).toHaveTextContent('25:00:00')
  })

  it('en el día de 23 h, la medianoche real cambia el reto aunque no pasen 24 h', async () => {
    process.env.TZ = 'Europe/Madrid'
    setLocalTime('2027-03-28', 22, 59, 55)
    mount()
    const n = screen.getByRole('banner').textContent
    await settle(6000)
    expect(screen.getByRole('banner').textContent).not.toBe(n)
    expect(screen.getByRole('banner')).toHaveTextContent(/#\d+/)
  })

  it('con el reloj del dispositivo cambiado hacia atrás se usa la fecha del dispositivo', () => {
    setLocalTime(addDays(LAUNCH, 3), 12)
    mount()
    expect(screen.getByRole('banner')).toHaveTextContent('#4')
  })
})
