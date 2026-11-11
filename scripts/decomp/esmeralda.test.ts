import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// DEC-95: los recursos de Esmeralda versionados salen tal cual de la receta (reproducibles byte a byte). Necesita el decompilado en
// EMERALD_SRC (ruta del decompilado en la revisión fijada) y Python con Pillow; sin EMERALD_SRC se omite.
const SOURCE = process.env.EMERALD_SRC ?? ''

describe('recursos de Esmeralda (gen:emerald)', () => {
  it.skipIf(!SOURCE || !existsSync(SOURCE))('la extracción coincide con lo versionado', () => {
    const out = execFileSync('python3', ['scripts/decomp/esmeralda.py', SOURCE, '--comprobar'], { encoding: 'utf8', timeout: 120_000 })
    expect(out).toMatch(/Coincide con lo versionado/)
  }, 150_000)
})
