import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../test-utils/memoryStorage'
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_KEY } from './settings'

// UT-66 · Ajustes (PRD §10.6, decisión de Jose del 22/10/2026): la velocidad se guarda entre sesiones.
describe('ajustes en localStorage', () => {
  it('sin nada guardado, o sin almacenamiento, valen los de por defecto (x1)', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(null)).toEqual({ speed: 1, moveAnimations: true })
  })

  it('guarda y recupera la velocidad', () => {
    const storage = new MemoryStorage()
    saveSettings(storage, { speed: 4, moveAnimations: false })
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) as string)).toEqual({ version: 1, speed: 4, moveAnimations: false })
    expect(loadSettings(storage)).toEqual({ speed: 4, moveAnimations: false })
  })

  it('ajustes guardados antes de existir las animaciones: se leen activadas', () => {
    const storage = new MemoryStorage()
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, speed: 2 }))
    expect(loadSettings(storage)).toEqual({ speed: 2, moveAnimations: true })
  })

  it('un valor ilegible, de otra versión o una velocidad que no existe vuelven a los de por defecto', () => {
    const storage = new MemoryStorage()
    for (const raw of ['{roto', JSON.stringify({ version: 2, speed: 4 }), JSON.stringify({ version: 1, speed: 3 }), '7']) {
      storage.setItem(SETTINGS_KEY, raw)
      expect(loadSettings(storage), raw).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('almacenamiento que lanza: no rompe', () => {
    const broken = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('lleno') }, removeItem: () => { throw new Error('no') } } as unknown as Storage
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS)
    expect(() => saveSettings(broken, { speed: 2, moveAnimations: true })).not.toThrow()
    expect(() => clearSettings(broken)).not.toThrow()
  })

  it('borrar los ajustes quita la clave', () => {
    const storage = new MemoryStorage()
    saveSettings(storage, { speed: 2, moveAnimations: true })
    clearSettings(storage)
    expect(storage.getItem(SETTINGS_KEY)).toBeNull()
  })
})
