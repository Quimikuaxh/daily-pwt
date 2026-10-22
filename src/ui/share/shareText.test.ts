import { describe, expect, it, vi } from 'vitest'
import { SITE_URL } from '../../config'
import type { DayRecord } from '../../storage/gameStore'
import { shareResult, shareText, shareTextFor } from './shareText'

const record = (over: Partial<DayRecord> = {}): DayRecord => ({
  date: '2026-10-22', challengeNumber: 42, trainerId: 'misty', variantId: 'misty-1', dataVersion: 'v1', status: 'won', startedAt: '2026-10-22T10:00:00Z',
  finishedAt: '2026-10-22T10:10:00Z', turns: 23, survivors: 4, playerFainted: [false, false, true, false, true, false], rivalFainted: 6,
  endReason: 'faint', voidReason: null, battle: null, ...over,
})

// UT-64 · PRD §11 y criterio 15: formato sin spoilers, casillas en el orden del equipo, racha de victorias.
describe('shareText', () => {
  it('victoria: número, turnos, casillas en orden del equipo, racha y enlace', () => {
    expect(shareText(record(), 5)).toBe(['Daily PWT #42', '✅ Victoria en 23 turnos', '🟩🟩🟥🟩🟥🟩', '🔥 Racha: 5', SITE_URL].join('\n'))
  })

  it('derrota: rivales debilitados sobre 6', () => {
    const text = shareText(record({ status: 'lost', rivalFainted: 3, playerFainted: [true, true, true, true, true, true] }), 0)
    expect(text).toBe(['Daily PWT #42', '❌ Derrota (3/6 rivales debilitados)', '🟥🟥🟥🟥🟥🟥', '🔥 Racha: 0', SITE_URL].join('\n'))
  })

  it('días guardados antes de F3 (sin estado de cada Pokémon): sin casillas', () => {
    expect(shareText(record({ playerFainted: null }), 1)?.split('\n')).toEqual(['Daily PWT #42', '✅ Victoria en 23 turnos', '🔥 Racha: 1', SITE_URL])
  })

  it('no revela rival ni equipo', () => {
    expect(shareText(record(), 1)).not.toMatch(/misty|Misty/)
  })

  it('en curso o anulado: nada que compartir', () => {
    expect(shareText(record({ status: 'inProgress' }), 0)).toBeNull()
    expect(shareText(record({ status: 'void' }), 0)).toBeNull()
  })

  it('shareTextFor usa la racha que había al terminar ese día, no la de días posteriores', () => {
    const days = [record({ date: '2026-10-21', challengeNumber: 41 }), record({ date: '2026-10-22', challengeNumber: 42 }), record({ date: '2026-10-23', challengeNumber: 43, status: 'lost' })]
    expect(shareTextFor(days, '2026-10-22')).toContain('🔥 Racha: 2')
    expect(shareTextFor(days, '2026-10-20')).toBeNull()
  })
})

describe('shareResult', () => {
  const nav = (over: Record<string, unknown>) => over as unknown as Navigator

  it('con Web Share API comparte el texto', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    expect(await shareResult('hola', nav({ share, clipboard: { writeText: vi.fn() } }))).toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 'hola' })
  })

  it('cancelar el panel de compartir no copia ni da error', async () => {
    const writeText = vi.fn()
    const share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'))
    expect(await shareResult('hola', nav({ share, clipboard: { writeText } }))).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('sin Web Share API (o si falla) copia al portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await shareResult('hola', nav({ clipboard: { writeText } }))).toBe('copied')
    expect(await shareResult('hola', nav({ share: vi.fn().mockRejectedValue(new Error('no')), clipboard: { writeText } }))).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('hola')
  })

  it('sin portapapeles: failed', async () => {
    expect(await shareResult('hola', nav({}))).toBe('failed')
  })
})
