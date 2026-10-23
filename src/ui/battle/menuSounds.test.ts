// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { menuSoundFor } from './menuSounds'

// UT-79 · Sonidos de los botones del menú de batalla (DEC-57).
describe('menuSoundFor', () => {
  const dom = (html: string) => {
    const root = document.createElement('div')
    root.innerHTML = html
    return root
  }

  it('«elegir» en los botones del menú, el equipo y los datos; «cancelar» en volver y cerrar', () => {
    const root = dom(`
      <section class="bt-touch"><button class="bt-fight"><span id="label">LUCHAR</span></button><button class="bt-back">Volver</button></section>
      <section class="bt-party"><button class="bt-party-option">Datos</button><button class="bt-party-cancel">Salir</button></section>
      <section class="bt-summary"><button class="bt-sum-next-page"></button><button class="bt-sum-close"></button></section>`)
    const at = (selector: string) => menuSoundFor(root.querySelector(selector))
    expect(at('#label')).toBe('menu-select')
    expect(at('.bt-back')).toBe('menu-cancel')
    expect(at('.bt-party-option')).toBe('menu-select')
    expect(at('.bt-party-cancel')).toBe('menu-cancel')
    expect(at('.bt-sum-next-page')).toBe('menu-select')
    expect(at('.bt-sum-close')).toBe('menu-cancel')
  })

  it('un botón desactivado, uno fuera del menú (Salir, Registro…) o algo que no es botón no suenan', () => {
    const root = dom('<section class="bt-touch"><button class="bt-fight" disabled>LUCHAR</button><p id="text">Texto</p></section><div class="bt-chrome"><button id="exit">Salir</button></div>')
    expect(menuSoundFor(root.querySelector('.bt-fight'))).toBeNull()
    expect(menuSoundFor(root.querySelector('#text'))).toBeNull()
    expect(menuSoundFor(root.querySelector('#exit'))).toBeNull()
    expect(menuSoundFor(null)).toBeNull()
  })
})
