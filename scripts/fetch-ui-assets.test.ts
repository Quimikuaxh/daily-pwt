import { readFileSync, existsSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { fromRoot, importScript } from '../src/test-utils/paths'

type Manifest = { sources: Record<string, { url?: string }>; assets: { path: string; source: string; url?: string; clean?: string }[]; cleanups?: Record<string, unknown> }

const manifest = (): Manifest => JSON.parse(readFileSync(fromRoot('data', 'ui-assets.json'), 'utf8'))

describe('scripts/fetch-ui-assets.mjs', () => {
  it('solo escribe dentro de public/ui con nombres seguros', async () => {
    const { resolveUiTarget } = await importScript('scripts/fetch-ui-assets.mjs')
    expect(resolveUiTarget('battle/bg/grass.png')).toMatch(/public\/ui\/battle\/bg\/grass\.png$/)
    for (const unsafe of ['../x.png', '/etc/x.png', 'battle/../../x.png', 'battle/Bg.png', 'battle/a b.png', 'battle/x.gif', '']) {
      expect(() => resolveUiTarget(unsafe)).toThrow(/Ruta de asset/)
    }
  })

  it('el manifest es válido y todos los orígenes de URL son https', async () => {
    const { planAssets } = await importScript('scripts/fetch-ui-assets.mjs')
    const plans = planAssets(manifest())
    expect(plans.length).toBeGreaterThan(50)
    expect(plans.every((plan: { url: string }) => plan.url.startsWith('https://'))).toBe(true)
  })

  it('rechaza rutas duplicadas y orígenes desconocidos', async () => {
    const { planAssets } = await importScript('scripts/fetch-ui-assets.mjs')
    const base = manifest()
    const first = base.assets[0]
    expect(() => planAssets({ ...base, assets: [first, first] })).toThrow(/duplicada/)
    expect(() => planAssets({ ...base, assets: [{ ...first, source: 'inventado' }] })).toThrow(/Origen desconocido/)
  })

  it('cada asset del manifest existe en public/ui (ejecutar npm run gen:ui si falla)', () => {
    for (const asset of manifest().assets) expect(existsSync(fromRoot('public', 'ui', asset.path)), asset.path).toBe(true)
  })

  it('las fuentes solo se escriben en public/fonts con nombres seguros y se valida la cabecera TrueType', async () => {
    const { resolveFontTarget, isFont } = await importScript('scripts/fetch-ui-assets.mjs')
    expect(resolveFontTarget('pokemon-dp.ttf')).toMatch(/public\/fonts\/pokemon-dp\.ttf$/)
    for (const unsafe of ['../x.ttf', '/etc/x.ttf', 'Font.ttf', 'a b.ttf', 'x.png', '']) expect(() => resolveFontTarget(unsafe)).toThrow(/Ruta de fuente/)
    expect(isFont(Buffer.from([0, 1, 0, 0, 9]))).toBe(true)
    expect(isFont(Buffer.from('<html>error</html>'))).toBe(false)
  })

  it('el manifest declara la fuente del juego con origen y licencia, y existe en public/fonts', () => {
    const fonts = (JSON.parse(readFileSync(fromRoot('data', 'ui-assets.json'), 'utf8')) as { fonts: { path: string; source: string; url: string }[]; sources: Record<string, { license?: string; credit?: string }> }).fonts
    expect(fonts.map((font) => font.path)).toEqual(['pokemon-dp.ttf'])
    const source = JSON.parse(readFileSync(fromRoot('data', 'ui-assets.json'), 'utf8')).sources[fonts[0].source]
    expect([source.license, source.credit].every(Boolean)).toBe(true)
    expect(existsSync(fromRoot('public', 'fonts', fonts[0].path))).toBe(true)
  })

  it('una sola @font-face y una sola variable --font-game: cambiar de fuente es sustituir el fichero', () => {
    const css = readFileSync(fromRoot('src', 'index.css'), 'utf8')
    expect(css.match(/@font-face/g)).toHaveLength(1)
    expect(css.match(/--font-game:/g)).toHaveLength(1)
    expect(css.match(/pokemon-dp\.ttf/g)).toHaveLength(1)
  })

  it('rechaza limpiezas desconocidas y resuelve las que existen', async () => {
    const { planAssets } = await importScript('scripts/fetch-ui-assets.mjs')
    const base = manifest()
    const cleaned = base.assets.find((asset) => asset.clean)
    if (!cleaned) throw new Error('El manifest debe tener assets con limpieza')
    expect(() => planAssets({ ...base, assets: [{ ...cleaned, clean: 'inventada' }] })).toThrow(/Limpieza desconocida/)
    const plan = planAssets({ ...base, assets: [cleaned] })[0]
    expect(plan.clean).toBe(base.cleanups?.[cleaned.clean as string])
  })

  it('los fondos de la pantalla de datos son de 256x192 y los fotogramas de la bola caben en su tira', async () => {
    const { decodePng } = await importScript('scripts/lib/png.mjs')
    for (const name of ['info-top', 'info-bottom', 'skills-top', 'skills-bottom', 'moves-top']) {
      const image = decodePng(readFileSync(fromRoot('public', 'ui', 'battle', 'summary', `${name}.png`)))
      expect([image.width, image.height], name).toEqual([256, 192])
    }
    const strip = decodePng(readFileSync(fromRoot('public', 'ui', 'battle', 'fx', 'pokeball-strip.png')))
    expect([strip.width, strip.height]).toEqual([12 * 7, 15])
  })
})

describe('métricas verticales de la fuente del juego', () => {
  it('@font-face fija ascent/descent para que la línea base no dependa de la plataforma (hhea de la TTF tiene el descender con signo cambiado)', () => {
    const font = readFileSync(fromRoot('public', 'fonts', 'pokemon-dp.ttf'))
    const tableCount = font.readUInt16BE(4)
    let hheaOffset = -1
    let unitsPerEm = 0
    for (let index = 0; index < tableCount; index += 1) {
      const entry = 12 + 16 * index
      const tag = font.toString('latin1', entry, entry + 4)
      const offset = font.readUInt32BE(entry + 8)
      if (tag === 'hhea') hheaOffset = offset
      if (tag === 'head') unitsPerEm = font.readUInt16BE(offset + 18)
    }
    const ascender = font.readInt16BE(hheaOffset + 4)
    const descender = font.readInt16BE(hheaOffset + 6)
    const lineGap = font.readInt16BE(hheaOffset + 8)
    const css = readFileSync(fromRoot('src', 'index.css'), 'utf8')
    // Si la TTF se corrige (descender negativo) o se sustituye, estos valores hay que recalcularlos.
    expect(descender, 'descender de hhea').toBeGreaterThan(0)
    expect(css).toContain(`ascent-override: ${((ascender + descender) / unitsPerEm) * 100}%`)
    expect(css).toContain('descent-override: 0%')
    expect(css).toContain(`line-gap-override: ${(lineGap / unitsPerEm) * 100}%`)
  })
})
