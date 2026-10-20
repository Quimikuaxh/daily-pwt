import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fromRoot } from '../../test-utils/paths'

// PRD §10.2.1 / RF-72: el entrenador sale antes de que aparezca su Pokémon (intro y cambios). Se lee de battle.css para fijar el orden.
const css = readFileSync(fromRoot('src', 'ui', 'battle', 'battle.css'), 'utf8')

const keyframes = (name: string): string => {
  const start = css.indexOf(`@keyframes ${name} {`)
  expect(start, name).toBeGreaterThan(-1)
  let depth = 0
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    if (css[index] === '}' && --depth === 0) return css.slice(start, index + 1)
  }
  throw new Error(`Sin cerrar: ${name}`)
}
const percents = (block: string): number[] => Array.from(block.matchAll(/(\d+)%/g)).map((match) => Number(match[1]))
const startOf = (selector: RegExp): { duration: number; delay: number } => {
  const match = selector.exec(css)
  expect(match, String(selector)).not.toBeNull()
  return { duration: Number(match![1]), delay: Number(match![2]) }
}

describe('orden de la intro y de los cambios', () => {
  it('intro: el rival sale (delay + duración) antes de que su Pokémon empiece a aparecer', () => {
    const exit = startOf(/\[data-intro="rivalSend"\] \.bt-trainer-rival \{\s*animation: bt-slide-out-right calc\((\d+)ms \/ var\(--speed, 1\)\) calc\((\d+)ms/)
    const appear = startOf(/\[data-intro="rivalSend"\] \.bt-mon-rival \{\s*animation: bt-appear calc\((\d+)ms \/ var\(--speed, 1\)\) calc\((\d+)ms/)
    expect(exit.delay + exit.duration).toBeLessThanOrEqual(appear.delay)
  })

  it('intro: el protagonista sale antes de que aparezca su Pokémon', () => {
    const exit = startOf(/\[data-intro="playerSend"\] \.bt-trainer-player \{\s*animation: bt-slide-out-left calc\((\d+)ms \/ var\(--speed, 1\)\) calc\((\d+)ms/)
    const appear = startOf(/\[data-intro="playerSend"\] \.bt-mon-player \{\s*animation: bt-appear calc\((\d+)ms \/ var\(--speed, 1\)\) calc\((\d+)ms/)
    expect(exit.delay + exit.duration).toBeLessThanOrEqual(appear.delay)
  })

  it('cambio: el entrenador termina de salir antes de que el Pokémon nuevo empiece a aparecer (mismo reparto en %)', () => {
    const mon = percents(keyframes('bt-switch-mon'))
    const appearsFrom = Math.max(...mon.filter((value) => value < 90))
    for (const name of ['bt-visit-left', 'bt-visit-right']) {
      const exitDone = Math.min(...percents(keyframes(name)).filter((value) => value > 53))
      expect(exitDone, name).toBeLessThanOrEqual(appearsFrom)
    }
  })

  it('cambio: el entrenador ya está fuera (opacidad 0) al final de la animación', () => {
    for (const name of ['bt-visit-left', 'bt-visit-right']) {
      const block = keyframes(name)
      expect(block.slice(block.lastIndexOf('100%'))).toMatch(/opacity: 0/)
    }
  })
})
