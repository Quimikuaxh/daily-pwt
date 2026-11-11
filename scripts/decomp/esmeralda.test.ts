import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'
import { fromRoot } from '../../src/test-utils/paths'

// DEC-95: los recursos de Esmeralda versionados salen tal cual de la receta (reproducibles byte a byte). Necesita el decompilado en
// EMERALD_SRC (ruta del decompilado en la revisión fijada) y Python con Pillow; sin EMERALD_SRC se omite.
const SOURCE = process.env.EMERALD_SRC ?? ''
const run = promisify(execFile)
const managed = ['public/ui/emerald', 'public/sprites/emerald', 'src/generated/emerald']
const fingerprints = () => Object.fromEntries(managed.flatMap(dir =>
  readdirSync(fromRoot(dir), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const path = join(entry.parentPath, entry.name)
      return [path, createHash('sha256').update(readFileSync(path)).digest('hex')]
    })))

describe('recursos de Esmeralda (gen:emerald-ui)', () => {
  it.skipIf(!SOURCE)('UT-171: la extracción coincide byte a byte y --comprobar conserva los recursos versionados', async () => {
    const before = fingerprints()
    expect(Object.keys(before).length).toBeGreaterThan(1000)
    await run('python3', [fromRoot('scripts/decomp/esmeralda.py'), SOURCE, '--comprobar'], { timeout: 120_000 })
    expect(fingerprints()).toEqual(before)
  }, 150_000)
})
