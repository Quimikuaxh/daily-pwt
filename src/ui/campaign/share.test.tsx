import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { gameBox } from '../console/exportScreens'
import { hallOfFameOrder } from './resultModel'

const exported = { width: 720, height: 960 }
vi.mock('../console/exportScreens', async (original) => ({
  ...(await original<typeof import('../console/exportScreens')>()),
  exportScreens: vi.fn(() => exported),
  shareOrDownload: vi.fn(async () => 'downloaded'),
}))
const { exportScreens, shareOrDownload } = await import('../console/exportScreens')
const { ShareScreen } = await import('./ShareScreen')

// UT-192 · Pantalla final para compartir (Jose, 12/11/2026, opción A): Salón de la Fama y Ficha, imagen, y orden del Salón.
const team = ['sceptile', 'gardevoir', 'swampert', 'manectric', 'altaria', 'aggron'].map((species) => ({ species, name: species.toUpperCase() }))
const card = { id: '40213', pokedex: 41, fainted: 3, minutes: 252, badges: 8 }

describe('pantalla para compartir', () => {
  beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
  afterEach(() => { vi.restoreAllMocks() })

  it('al ganar: campeón (o campeona) con los seis y la Ficha con POKéDEX, BAJAS, TIEMPO y medallas', () => {
    render(<ShareScreen won player="BRUNO" protagonist="brendan" rival="Plubio" team={team} card={card} date="2026-11-12" scale={1} />)
    expect(screen.getByRole('img', { name: /¡BRUNO, CAMPEÓN DE HOENN! Campeones: SCEPTILE, GARDEVOIR, SWAMPERT, MANECTRIC, ALTARIA, AGGRON\./ })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Ficha de Entrenador. BRUNO. Nº de ID 40213. POKéDEX: 41 especies reclutadas. Bajas: 3. Tiempo: 4:12. Medallas: 8.' })).toBeTruthy()
    render(<ShareScreen won player="AURA" protagonist="may" rival="Plubio" team={team} card={card} date="2026-11-12" scale={1} />)
    expect(screen.getByRole('img', { name: /¡AURA, CAMPEONA DE HOENN!/ })).toBeTruthy()
  })

  it('al perder: ante quién, con los del último combate en gris', () => {
    render(<ShareScreen won={false} player="BRUNO" protagonist="brendan" rival="Sixto" team={team.slice(0, 3)} card={card} date="2026-11-12" scale={1} />)
    expect(screen.getByRole('img', { name: /BRUNO cayó ante SIXTO\./ })).toBeTruthy()
    // Los caídos, en gris (Jose, 12/11/2026).
    expect(document.querySelectorAll('.share-fallen')).toHaveLength(3)
  })

  it('Guardar imagen descarga las dos pantallas a 3 aumentos; Compartir usa el menú del sistema', async () => {
    render(<ShareScreen won player="BRUNO" protagonist="brendan" rival="Plubio" team={team} card={card} date="2026-11-12" scale={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la imagen del resultado' }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledWith(exported, 'nuzlocke-hoenn-2026-11-12.png', '¡BRUNO ha completado la Nuzlocke de Hoenn en Daily PWT!', true))
    expect(exportScreens).toHaveBeenCalledWith(expect.any(HTMLElement), 3)
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Imagen guardada.'))
    fireEvent.click(screen.getByRole('button', { name: 'Compartir la imagen del resultado' }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenLastCalledWith(exported, 'nuzlocke-hoenn-2026-11-12.png', expect.any(String), false))
  })

  it('caja de un elemento en píxeles del juego y el Salón pintado de arriba abajo (la fila de abajo, delante)', () => {
    expect(gameBox({ left: 140, top: 60, width: 128, height: 128 } as DOMRect, { left: 100, top: 20 } as DOMRect, 2)).toEqual({ x: 20, y: 20, w: 64, h: 64 })
    expect(hallOfFameOrder(6)).toEqual([0, 1, 2, 3, 4, 5])
    expect(hallOfFameOrder(3)).toEqual([0, 1, 2])
  })
})
