import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalStorageStore } from '../../storage/localStorageStore'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { testMenu } from '../../test-utils/ui'
import { AppMenu } from './AppMenu'

// UT-67 · PRD §10.5 y §10.6: Ayuda (cómo se juega, reglas, mecánicas, consejos, créditos y aviso legal) y Ajustes (velocidad y borrar datos).
const mount = (over: Parameters<typeof testMenu>[1] = {}) => {
  const user = userEvent.setup()
  const store = new LocalStorageStore(new MemoryStorage())
  const menu = testMenu(store, over)
  render(<AppMenu {...menu} today="2026-10-22" />)
  return { user, store }
}

describe('AppMenu', () => {
  it('tres accesos con nombre: Estadísticas, Ayuda y Ajustes', () => {
    mount()
    const nav = screen.getByRole('navigation')
    expect(within(nav).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Estadísticas', 'Ayuda', 'Ajustes'])
  })

  it('Ayuda trae cómo se juega, reglas, mecánicas, consejos, créditos y aviso legal', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Ayuda' }))
    const dialog = screen.getByRole('dialog', { name: 'Ayuda' })
    for (const heading of ['Cómo se juega', 'Reglas del combate', 'Mecánicas de la 5.ª generación', 'Consejos', 'Estadísticas', 'Créditos', 'Aviso legal']) {
      expect(within(dialog).getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(dialog).toHaveTextContent(/WikiDex/)
    expect(dialog).toHaveTextContent(/Pokémon Showdown/)
    expect(dialog).toHaveTextContent(/Super Music Collection/)
    expect(dialog).toHaveTextContent(/The Sounds Resource/)
    expect(dialog).toHaveTextContent(/no oficial/)
  })

  it('Ajustes: la velocidad marcada es la guardada y cambiarla avisa', async () => {
    const onSettingsChange = vi.fn()
    const { user } = mount({ settings: { speed: 2, animations: 'always', sound: true, volume: 70 }, onSettingsChange })
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    expect(screen.getByRole('button', { name: 'x2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'x1' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'x4' }))
    expect(onSettingsChange).toHaveBeenCalledWith({ speed: 4, animations: 'always', sound: true, volume: 70 })
    await user.click(screen.getByRole('button', { name: 'Nunca' }))
    expect(onSettingsChange).toHaveBeenLastCalledWith({ speed: 2, animations: 'never', sound: true, volume: 70 })
  })

  // UT-77 · Sonido y volumen (DEC-57).
  it('Ajustes: silenciar y mover el volumen avisan con el valor nuevo; el volumen se lee en %', async () => {
    const onSettingsChange = vi.fn()
    const { user } = mount({ settings: { speed: 1, animations: 'always', sound: true, volume: 70 }, onSettingsChange })
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    expect(screen.getByRole('button', { name: 'Activado' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Silenciado' }))
    expect(onSettingsChange).toHaveBeenLastCalledWith({ speed: 1, animations: 'always', sound: false, volume: 70 })
    const slider = screen.getByRole('slider', { name: 'Volumen' })
    expect(slider).toHaveAttribute('aria-valuetext', '70 %')
    fireEvent.change(slider, { target: { value: '40' } })
    expect(onSettingsChange).toHaveBeenLastCalledWith({ speed: 1, animations: 'always', sound: true, volume: 40 })
  })

  it('Borrar datos locales pide confirmación; cancelar no borra y confirmar borra y avisa', async () => {
    const onClearData = vi.fn()
    const { user } = mount({ onClearData })
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    await user.click(screen.getByRole('button', { name: 'Borrar datos locales' }))
    expect(screen.getByRole('dialog', { name: '¿Borrar todos los datos?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClearData).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Borrar datos locales' }))
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    expect(onClearData).toHaveBeenCalledOnce()
    expect(screen.getByText('Datos borrados.')).toBeInTheDocument()
  })
})
