import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { TodayScreen } from './TodayScreen'
import { pokemonSpriteClass } from './spriteBox'
import { makeGameData } from '../../test-utils/fixtures'
import { setLocalTime } from '../../test-utils/ui'

// Revisión ciclo 1, bloqueante 1: los sprites de Hoy van a tamaño natural (x1), nunca escalados de forma fraccionaria.
const data = makeGameData()
const SPRITES_DIR = join(import.meta.dirname, '../../../public/sprites')

beforeEach(() => { vi.useFakeTimers(); setLocalTime('2026-10-17', 12) })
afterEach(() => { vi.useRealTimers() })

function largestGif(dir: string): { width: number; height: number } {
  let width = 0
  let height = 0
  for (const file of readdirSync(join(SPRITES_DIR, dir)).filter((name) => name.endsWith('.gif'))) {
    const header = readFileSync(join(SPRITES_DIR, dir, file))
    width = Math.max(width, header.readUInt16LE(6))
    height = Math.max(height, header.readUInt16LE(8))
  }
  return { width, height }
}

describe('sprites de Hoy', () => {
  it('todas las imágenes usan tamaño natural (object-fit: none) en una caja cuadrada', () => {
    render(<TodayScreen data={data} onStart={vi.fn()} />)
    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThan(6)
    for (const image of images) {
      expect(image).toHaveClass('sprite-natural')
      expect(image.getAttribute('width')).toBe(image.getAttribute('height'))
    }
  })

  it('la caja cubre el GIF de cada entrenador, y los Pokémon que no caben (unas 20 especies) se reducen en vez de recortarse', () => {
    render(<TodayScreen data={data} onStart={vi.fn()} />)
    const box = Number(screen.getAllByRole('img')[0].getAttribute('width'))
    const trainers = largestGif('trainers')
    expect(Math.max(trainers.width, trainers.height)).toBeLessThanOrEqual(box)
    const frontDir = join(SPRITES_DIR, 'pokemon/front')
    for (const file of readdirSync(frontDir).filter((name) => name.endsWith('.gif'))) {
      const header = readFileSync(join(frontDir, file))
      const tooBig = Math.max(header.readUInt16LE(6), header.readUInt16LE(8)) > box
      expect(pokemonSpriteClass(file.replace('.gif', '')).includes('sprite-shrink'), file).toBe(tooBig)
    }
    expect(readFileSync(join(import.meta.dirname, '../../index.css'), 'utf8')).toMatch(/\.sprite-natural\.sprite-shrink\s*{[^}]*object-fit:\s*scale-down/)
  })

  it('el CSS no usa object-fit: contain para los sprites (escalaría de forma fraccionaria)', () => {
    const css = readFileSync(join(import.meta.dirname, '../../index.css'), 'utf8')
    expect(css).not.toMatch(/object-fit:\s*contain/)
    expect(css).toMatch(/\.sprite-natural\s*{[^}]*object-fit:\s*none/)
  })
})
