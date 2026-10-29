import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// En Pages la web vive en `/daily-pwt/`: las URLs de `data/sprites` sin base apuntan a la raíz del dominio y dan 404 (pasó con los
// sprites del Historial, 29/10/2026). La interfaz las pide siempre a `spriteUrls.ts`, que pone `import.meta.env.BASE_URL`.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('sprites con la base de la web', () => {
  it('ningún componente de la interfaz usa las URLs de data/sprites sin base', () => {
    const offenders = files(join(import.meta.dirname, '..'))
      .filter((path) => !path.endsWith('spriteUrls.ts'))
      .filter((path) => /import[^;]*SpriteUrl[^;]*from '[./]*\/data\/sprites'/.test(readFileSync(path, 'utf8')))
    expect(offenders).toEqual([])
  })
})
