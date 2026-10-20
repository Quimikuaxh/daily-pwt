import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * UT-02 · DEC-01. `src/core` debe poder usarse sin DOM, sin React y sin fuentes
 * no deterministas. Adaptado de claude-test/.../core/isolation.test.ts.
 * Las funciones `findViolations*` se prueban también contra fixtures que incumplen,
 * para que el guardián no pase en vacío.
 */
const CORE_DIR = import.meta.dirname

const coreSourceFiles = () => readdirSync(CORE_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const IMPORT_PATTERNS = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

export function findExternalImports(source: string): string[] {
  const out: string[] = []
  for (const re of IMPORT_PATTERNS) {
    for (const m of stripComments(source).matchAll(re)) if (!m[1].startsWith('./')) out.push(m[1])
  }
  return out
}

export function findNonDeterminism(source: string): string[] {
  const code = stripComments(source)
  const out: string[] = []
  if (/Math\.random/.test(code)) out.push('Math.random')
  if (/Date\.now/.test(code)) out.push('Date.now')
  if (/new Date\(\s*\)/.test(code)) out.push('new Date() sin argumentos')
  if (/performance\.now/.test(code)) out.push('performance.now')
  if (/crypto\.(randomUUID|getRandomValues)|randomBytes/.test(code)) out.push('crypto aleatorio')
  return out
}

describe('aislamiento de src/core', () => {
  it('hay ficheros de producción que revisar', () => {
    expect(coreSourceFiles()).toEqual(expect.arrayContaining(['prng.ts']))
  })

  it('ningún fichero importa fuera de ./', () => {
    const offenders = coreSourceFiles().flatMap((f) =>
      findExternalImports(readFileSync(join(CORE_DIR, f), 'utf8')).map((s) => `${f} -> ${s}`))
    expect(offenders).toEqual([])
  })

  it('ningún fichero usa fuentes no deterministas', () => {
    const offenders = coreSourceFiles().flatMap((f) =>
      findNonDeterminism(readFileSync(join(CORE_DIR, f), 'utf8')).map((s) => `${f} -> ${s}`))
    expect(offenders).toEqual([])
  })

  it('el guardián detecta imports externos de las cuatro formas', () => {
    const bad = ["import x from 'react'", "import '@pkmn/dex'", "await import('../data')", "require('fs')"]
    for (const b of bad) expect(findExternalImports(b), b).toHaveLength(1)
  })

  it('el guardián permite imports relativos ./', () => {
    expect(findExternalImports("import { Prng } from './prng'")).toEqual([])
  })

  it('el guardián detecta fuentes no deterministas', () => {
    expect(findNonDeterminism('const a = Math.random()')).toHaveLength(1)
    expect(findNonDeterminism('const a = Date.now()')).toHaveLength(1)
    expect(findNonDeterminism('const a = new Date()')).toHaveLength(1)
  })

  it('el guardián admite new Date(argumentos) y comentarios que mencionan lo prohibido', () => {
    expect(findNonDeterminism('// no Math.random\nconst d = new Date(2026, 9, 17)')).toEqual([])
  })
})
