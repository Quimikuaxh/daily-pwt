import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../test-utils/memoryStorage'
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_KEY } from './settings'

// UT-66 · Ajustes (PRD §10.6, decisión de Jose del 22/10/2026): la velocidad se guarda entre sesiones.
describe('ajustes en localStorage', () => {
  it('sin nada guardado, o sin almacenamiento, valen los de por defecto (x1)', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(null)).toEqual({ speed: 1, animations: 'always', sound: true, volume: 70 })
  })

  it('guarda y recupera la velocidad', () => {
    const storage = new MemoryStorage()
    saveSettings(storage, { speed: 4, animations: 'system', sound: false, volume: 35 })
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) as string)).toEqual({ version: 1, speed: 4, animations: 'system', sound: false, volume: 35 })
    expect(loadSettings(storage)).toEqual({ speed: 4, animations: 'system', sound: false, volume: 35 })
  })

  it('ajustes guardados antes de existir las animaciones o el sonido: se leen con los de por defecto', () => {
    const storage = new MemoryStorage()
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, speed: 2 }))
    expect(loadSettings(storage)).toEqual({ speed: 2, animations: 'always', sound: true, volume: 70 })
  })

  // UT-83 · Animaciones (24/10/2026, Jose): «Siempre» por defecto; los guardados con la opción antigua se traducen.
  it('la opción antigua `moveAnimations: false` se lee como «Nunca»; `true` o un valor desconocido, como «Siempre»', () => {
    const storage = new MemoryStorage()
    const read = (saved: object) => {
      storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, speed: 1, ...saved }))
      return loadSettings(storage).animations
    }
    expect(read({ moveAnimations: false })).toBe('never')
    expect(read({ moveAnimations: true })).toBe('always')
    expect(read({ animations: 'raro' })).toBe('always')
    expect(read({ animations: 'system', moveAnimations: false })).toBe('system')
  })

  // UT-77 · Sonido y volumen (DEC-57).
  it('un volumen fuera de 0-100, no entero o que no es número vale 70; el sonido que no es sí/no, activado', () => {
    const storage = new MemoryStorage()
    for (const volume of [-1, 101, 50.5, '60', null]) {
      storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, speed: 1, sound: 'no', volume }))
      expect(loadSettings(storage), String(volume)).toMatchObject({ sound: true, volume: 70 })
    }
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, speed: 1, sound: false, volume: 0 }))
    expect(loadSettings(storage)).toMatchObject({ sound: false, volume: 0 })
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
    expect(() => saveSettings(broken, { ...DEFAULT_SETTINGS, speed: 2 })).not.toThrow()
    expect(() => clearSettings(broken)).not.toThrow()
  })

  it('borrar los ajustes quita la clave', () => {
    const storage = new MemoryStorage()
    saveSettings(storage, { ...DEFAULT_SETTINGS, speed: 2 })
    clearSettings(storage)
    expect(storage.getItem(SETTINGS_KEY)).toBeNull()
  })
})
