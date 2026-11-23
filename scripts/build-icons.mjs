// Iconos y vista previa al compartir (SEO, Jose 23/11/2026): `npm run gen:icons`.
// Fuente única del dibujo: public/favicon.svg (la Poké Ball de la pestaña). De ella salen los PNG de la pantalla de inicio del móvil y
// del manifest, y la imagen de 1200 x 630 de Open Graph (scripts/og/og.html con la captura scripts/og/combate.png). Usa el Chromium de
// Playwright; no necesita red. Escribe en public/.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ')
const ICONS = [
  // [fichero, lado, fondo]: con fondo oscuro para el móvil (no admite transparencia en todos), transparente el de 32.
  ['icon-192.png', 192, '#0f1424'],
  ['icon-512.png', 512, '#0f1424'],
  ['apple-touch-icon.png', 180, '#0f1424'],
  ['favicon-32.png', 32, null],
]

const browser = await chromium.launch()
try {
  for (const [file, size, background] of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    // Con fondo, un margen del 12 % para que el sistema pueda recortar en círculo o con esquinas sin comerse la bola.
    const inner = Math.round(size * (background ? 0.76 : 1))
    await page.setContent(`<body style="margin:0;background:${background ?? 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${inner}px;height:${inner}px">${svg}</div></body>`)
    await page.screenshot({ path: resolve(root, 'public', file), omitBackground: !background })
    await page.close()
  }
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await og.goto(pathToFileURL(resolve(root, 'scripts/og/og.html')).href)
  await og.evaluate(() => document.fonts.ready)
  await og.screenshot({ path: resolve(root, 'public/og.png') })
} finally {
  await browser.close()
}
console.log('Iconos y public/og.png generados.')
