import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SITE_URL } from './config'

// UT-252 (SEO, Jose 23/11/2026; DEC-108): metadatos de index.html con URL absolutas del sitio, imagen de vista previa de 1200 x 630,
// manifest con iconos que existen y sitemap con la portada.
const root = resolve(import.meta.dirname, '..')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')
const meta = (attr: string, name: string) => new RegExp(`<meta ${attr}="${name}" content="([^"]+)"`).exec(html)?.[1]

describe('buscadores y vista previa', () => {
  it('título, descripción, canónica, Open Graph, Twitter y JSON-LD apuntan al sitio', () => {
    expect(/<title>Daily PWT · [^<]+<\/title>/.test(html)).toBe(true)
    expect(meta('name', 'description')?.length).toBeGreaterThan(80)
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}" />`)
    expect(meta('property', 'og:url')).toBe(SITE_URL)
    expect(meta('property', 'og:image')).toBe(`${SITE_URL}og.png`)
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1])
    expect(ld).toMatchObject({ '@type': 'VideoGame', name: 'Daily PWT', url: SITE_URL, isAccessibleForFree: true })
  })

  it('la imagen de vista previa mide 1200 x 630 y los iconos del manifest existen', () => {
    const png = readFileSync(resolve(root, 'public/og.png'))
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8')) as { icons: { src: string }[] }
    for (const icon of manifest.icons) expect(existsSync(resolve(root, 'public', icon.src)), icon.src).toBe(true)
    for (const file of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) expect(existsSync(resolve(root, 'public', file)), file).toBe(true)
  })

  it('el sitemap lista la portada', () => {
    expect(readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8')).toContain(`<loc>${SITE_URL}</loc>`)
  })
})
