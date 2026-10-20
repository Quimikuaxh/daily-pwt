import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { DataBox } from './DataBox'

// Revisión de Jose (R3): el relleno de la barra de PS debe quedar siempre dentro del recuadro de la barra, en todos los niveles
// (verde, amarillo, rojo) y en las dos cajas. La geometría real se mide en e2e/databox.spec.ts; aquí, la lógica y el CSS que la garantiza.
const mon = (hpPercent: number) => ({ species: 'garchomp', hpPercent, status: null, fainted: hpPercent <= 0, hp: hpPercent, maxHp: 100 })
const css = readFileSync(join(import.meta.dirname, 'battle.css'), 'utf8')
const levelOf = (container: HTMLElement) => (container.querySelector('.bt-databox-fill img') as HTMLImageElement).getAttribute('src')

describe('relleno de la barra de PS', () => {
  it.each([
    [100, 'green', 50], [51, 'green', 26], [50, 'yellow', 25], [21, 'yellow', 11], [20, 'red', 10], [1, 'red', 1],
  ])('con el %i %% usa el relleno %s y mide %i px de los 50 de la barra', (percent, level, width) => {
    for (const side of ['rival', 'player'] as const) {
      const { container, unmount } = render(<DataBox side={side} mon={mon(percent)} name="Garchomp" testId={`${side}-hp`} />)
      expect(levelOf(container)).toContain(`fill-${level}.png`)
      expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--fill')).toBe(`${width}px`)
      unmount()
    }
  })

  it('el relleno nunca supera la barra (0 a 50 px)', () => {
    for (const percent of [0, 1, 33, 99, 100, 150, -5]) {
      const { container, unmount } = render(<DataBox side="rival" mon={mon(percent)} name="X" testId="r" />)
      const width = parseInt((container.firstElementChild as HTMLElement).style.getPropertyValue('--fill'), 10)
      expect(width).toBeGreaterThanOrEqual(0)
      expect(width).toBeLessThanOrEqual(50)
      unmount()
    }
  })

  it('el CSS recorta el relleno en vez de encogerlo: la imagen no hereda el max-width:100% de Tailwind', () => {
    const rule = /\.bt-databox-fill img\s*{([^}]*)}/.exec(css)?.[1] ?? ''
    expect(rule).toMatch(/max-width:\s*none/)
    expect(rule).toMatch(/width:\s*50px/)
    expect(rule).toMatch(/height:\s*5px/)
    expect(/\.bt-databox-fill\s*{[^}]*overflow:\s*hidden/.test(css)).toBe(true)
  })

  it('el relleno y el recuadro de la barra comparten posición en las dos cajas', () => {
    expect(/\.bt-databox-track,\s*\.bt-databox-fill\s*{[^}]*left:\s*var\(--bar-left\)[^}]*top:\s*8px/.test(css)).toBe(true)
  })
})

describe('Pokémon del jugador (escala entera, solo se pierde la parte baja)', () => {
  it('se dibuja a 2x entera y con los pies (valor base) bajo la caja de mensajes pero dentro del lienzo', () => {
    const rule = /\.bt-mon-player\s*{([^}]*)}/.exec(css)?.[1] ?? ''
    const feet = Number(/top:\s*(\d+)px/.exec(rule)?.[1])
    expect(feet).toBeGreaterThan(147)
    expect(feet).toBeLessThanOrEqual(192)
    expect(/\.bt-mon\.bt-mon-player \.bt-sprite\s*{[^}]*transform:\s*scale\(2\)/.test(css)).toBe(true)
  })

  it('está a la izquierda del centro del lienzo (128 px)', () => {
    const rule = /\.bt-mon-player\s*{([^}]*)}/.exec(css)?.[1] ?? ''
    expect(Number(/left:\s*(\d+)px/.exec(rule)?.[1])).toBeLessThan(128)
  })

  it('el rival no cambia: 1x, pies en y=97', () => {
    expect(/\.bt-mon-rival\s*{[^}]*top:\s*97px/.test(css)).toBe(true)
    expect(/\.bt-mon-rival \.bt-sprite[^{]*{[^}]*scale/.test(css)).toBe(false)
  })
})
