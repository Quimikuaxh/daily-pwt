import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { existsInRoot } from '../test-utils/paths'

// UT-48 · RNF-05. Sin literales de interfaz en src/ui/** fuera de src/i18n/es.ts: todo texto visible sale de i18n/es.ts.
// Heurística: en los .tsx de producción no puede haber (a) texto JSX con letras entre etiquetas, ni (b) atributos de texto
// visible (title, aria-label, alt, placeholder, aria-description) con literal de cadena. El guardián se prueba también
// contra fragmentos que incumplen, para que no pase en vacío.
const UI_DIR = import.meta.dirname
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const prodTsx = () => walk(UI_DIR).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

function findLiterals(source: string): string[] {
  const code = strip(source)
  const out: string[] = []
  for (const m of code.matchAll(/>([^<>{}]*[A-Za-zÁÉÍÓÚáéíóúñÑ]{2,}[^<>{}]*)</g)) {
    if (m[1].trim()) out.push(`texto JSX: "${m[1].trim()}"`)
  }
  for (const m of code.matchAll(/\b(title|aria-label|alt|placeholder|aria-description)=["']([^"']*[A-Za-zÁÉÍÓÚáéíóúñÑ]{2,}[^"']*)["']/g)) {
    out.push(`atributo ${m[1]}: "${m[2]}"`)
  }
  return out
}

describe('textos centralizados en i18n/es.ts', () => {
  it('existe src/i18n/es.ts', () => {
    expect(existsInRoot('src', 'i18n', 'es.ts')).toBe(true)
  })

  it('hay componentes de producción que revisar', () => {
    expect(prodTsx().length).toBeGreaterThan(0)
  })

  it('ningún .tsx de src/ui tiene literales de interfaz', () => {
    const offenders = prodTsx().flatMap((f) => findLiterals(readFileSync(f, 'utf8')).map((l) => `${f.replace(UI_DIR, 'ui')}: ${l}`))
    expect(offenders).toEqual([])
  })

  it('el guardián detecta texto JSX literal', () => {
    expect(findLiterals('const A = () => <button>Combatir</button>')).toHaveLength(1)
  })

  it('el guardián detecta atributos literales', () => {
    expect(findLiterals('const A = () => <img alt="Sprite del rival" src={x} />')).toHaveLength(1)
  })

  it('el guardián admite texto que viene de es.ts', () => {
    expect(findLiterals('const A = () => <button aria-label={es.fight}>{es.fight}</button>')).toEqual([])
  })

  it('el guardián ignora comentarios', () => {
    expect(findLiterals('// <b>Texto</b>\nconst A = () => <b>{x}</b>')).toEqual([])
  })
})
