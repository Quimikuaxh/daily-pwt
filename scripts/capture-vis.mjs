// Capturas de verificación visual VIS-01..19 (docs/PLAN-PRUEBAS-F1.md §5) a 360x740, 400x800 (solo combate nuevo) y 1280x800.
// Uso: VITE_TEST_HOOKS=1 npx vite build --outDir dist-e2e --emptyOutDir && node scripts/capture-vis.mjs [outDir]
// Sirve dist-e2e con `vite preview` en un puerto propio (VIS_PORT, 4393 por defecto) y escribe en e2e-artifacts/vis (ignorado por git).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { blend, crop, loadPng, montage, savePng, scaleNearest } from './lib/montage.mjs'

const PORT = Number(process.env.VIS_PORT ?? 4393)
const BASE = `http://127.0.0.1:${PORT}/`
const OUT = process.argv[2] ?? 'e2e-artifacts/vis'
const SIZES = [{ tag: '360', width: 360, height: 740 }, { tag: '1280', width: 1280, height: 800 }]
mkdirSync(OUT, { recursive: true })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', 'dist-e2e', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const stop = () => server.kill()
process.on('exit', stop)
for (let i = 0; i < 60; i += 1) {
  try { if ((await fetch(BASE)).ok) break } catch { /* aún arrancando */ }
  await new Promise((resolve) => setTimeout(resolve, 500))
}

const browser = await chromium.launch()
const moves = (page) => page.getByRole('group', { name: 'Movimientos' }).locator('button')
const result = (page) => page.getByRole('heading', { level: 1, name: /^(Victoria|Derrota)$/ })

async function open(context, query) {
  const page = await context.newPage()
  await page.goto(`${BASE}?${query}`)
  await page.locator('.challenge-number').waitFor()
  return page
}
const shot = (page, name, tag, opts = {}) => page.screenshot({ path: `${OUT}/${name}-${tag}.png`, ...opts })

async function enterBattle(page) {
  await page.getByRole('button', { name: /^Sacar primero/ }).first().click()
  await page.getByRole('button', { name: 'Combatir' }).click()
  await page.getByTestId('battle-screen').waitFor()
}
async function ready(page) {
  await result(page).or(page.locator('.bt-fight:enabled')).or(page.locator('.bt-moves button:enabled').first()).or(page.locator('.bt-party-panel[data-state="ready"]:enabled').first()).first().waitFor({ timeout: 60000 })
}

for (const { tag, width, height } of SIZES) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'es-ES', timezoneId: 'Europe/Madrid', deviceScaleFactor: 1 })

  // VIS-01 / VIS-04: Hoy en varias fechas (equipos y nombres variados), página completa.
  for (const [i, date] of ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'].entries()) {
    const page = await open(context, `date=${date}`)
    await page.waitForLoadState('networkidle')
    await shot(page, `vis01-hoy-${date}`, tag, { fullPage: true })
    if (i === 0) await shot(page, 'vis03-sin-inicial', tag)
    if (i === 0) {
      // VIS-03: inicial elegido
      await page.getByRole('button', { name: /^Sacar primero/ }).nth(1).click()
      await shot(page, 'vis03-inicial-elegido', tag)
      // VIS-02: panel del rival abierto
      await page.getByRole('button', { name: 'Ver movimientos y objetos del rival' }).click()
      await shot(page, 'vis02-paneles-abiertos', tag, { fullPage: true })
    }
    await page.close()
  }

  // VIS-05: error de datos
  {
    const page = await context.newPage()
    await page.route('**/assets/index-*.js', async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, body: (await response.text()).replace('dataVersion:`f1-1`', 'dataVersion:``') })
    })
    await page.goto(`${BASE}?date=2026-10-17`)
    await page.getByRole('alert').waitFor()
    await shot(page, 'vis05-error-datos', tag)
    await page.close()
  }

  // VIS-06..12: combates. Se juega y se captura la primera vez que aparece cada estado.
  const seen = new Set()
  const once = async (page, key, name, opts) => { if (!seen.has(key)) { seen.add(key); await shot(page, name, tag, opts) } }
  for (const [date, seed] of [['2026-10-17', 'a'], ['2026-10-18', 'b'], ['2026-10-20', 'c'], ['2026-10-21', 'a']]) {
    const page = await open(context, `date=${date}&seed=${seed}&ai=trivial`)
    await enterBattle(page)
    await ready(page)
    await once(page, 'start', 'vis06-combate-inicio', {})
    if (!seen.has('menu-moves')) {
      seen.add('menu-moves')
      await page.locator('.bt-fight').click()
      await shot(page, 'vis06-menu-movimientos', tag)
      await page.getByRole('button', { name: 'Volver' }).click()
    }
    if (!seen.has('dialog')) {
      seen.add('dialog')
      await page.getByRole('button', { name: 'Rendirse' }).click()
      await page.getByRole('dialog').waitFor()
      await shot(page, 'vis10-dialogo-rendirse', tag)
      await page.getByRole('button', { name: 'Cancelar' }).click()
    }
    if (!seen.has('switch')) {
      seen.add('switch')
      await page.getByRole('button', { name: 'Cambiar', exact: true }).click()
      await shot(page, 'vis08-cambio', tag)
      await page.getByRole('button', { name: 'Volver' }).click()
    }
    await page.getByRole('button', { name: /^Velocidad/ }).click()
    await page.getByRole('button', { name: /^Velocidad/ }).click()
    for (let turn = 0; turn < 80; turn += 1) {
      await ready(page)
      if (await result(page).isVisible()) break
      const partyOpen = (await page.locator('.bt-party').count()) > 0
      if (!partyOpen && await page.locator('.bt-fight:enabled').count() > 0) {
        await page.locator('.bt-fight').click()
        await page.locator('.bt-moves button:enabled').first().waitFor()
      }
      if (await page.locator('.bt-party-panel[data-state="ready"]:enabled').count() > 0 && (await moves(page).count()) === 0) {
        await once(page, 'forced', 'vis08-cambio-forzado', {})
      }
      if (await page.locator('.bt-moves button:disabled').count() > 0 && await page.locator('.bt-moves button:enabled').count() > 0) await once(page, 'disabled', 'vis07-movimiento-desactivado', {})
      if (await page.locator('.bt-databox-status').count() > 0) await once(page, 'status', 'vis09-estado', {})
      if (await page.getByTestId('weather').count() > 0) await once(page, 'weather', 'vis09-clima', {})
      if (await page.locator('.bt-databox-fill img[src*="fill-red"]').count() > 0) await once(page, 'lowhp', 'vis09-ps-bajos', {})
      if (turn === 4 && !seen.has('log')) {
        await page.getByRole('button', { name: 'Registro' }).click()
        await once(page, 'log', 'vis11-registro', {})
        await page.keyboard.press('Escape')
      }
      const m = page.locator('.bt-moves button:enabled')
      if (await m.count() > 0) await m.first().click()
      else {
        await page.locator('.bt-party-panel[data-state="ready"]:enabled').first().click()
        await page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Cambiar', exact: true }).click()
      }
      await page.waitForTimeout(60)
    }
    if (await result(page).isVisible()) {
      const title = (await result(page).textContent()) ?? ''
      await once(page, title, `vis12-resultado-${title.toLowerCase()}`, {})
      if (!seen.has('Derrota') && !seen.has('rendicion')) {
        await page.getByRole('button', { name: 'Otro combate' }).click()
        await ready(page)
        await page.getByRole('button', { name: 'Rendirse' }).click()
        await page.getByRole('button', { name: 'Sí, rendirme' }).click()
        await result(page).waitFor()
        await once(page, 'Derrota', 'vis12-resultado-derrota', {})
        seen.add('rendicion')
      }
    }
    await page.close()
  }

  // VIS-15: intro del combate (iris, entrada, lanzamientos) a intervalos fijos.
  {
    const page = await open(context, 'date=2026-10-17&seed=a&ai=trivial')
    await enterBattle(page)
    const startedAt = Date.now()
    for (const at of [300, 1500, 2300, 2900, 3400, 4300, 4700]) {
      const wait = at - (Date.now() - startedAt)
      if (wait > 0) await page.waitForTimeout(wait)
      await shot(page, `vis15-intro-${String(at).padStart(4, '0')}`, tag)
    }
    await page.close()
  }

  // VIS-13: sprites sin difuminar (recorte del campo, ampliado x2 con deviceScaleFactor).
  {
    const ctx2 = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: 'es-ES' })
    const page = await open(ctx2, 'date=2026-10-17&seed=a&ai=trivial')
    await enterBattle(page)
    await ready(page)
    await page.getByTestId('field').screenshot({ path: `${OUT}/vis13-pixelado-campo-${tag}.png` })
    await ctx2.close()
  }

  // VIS-14: reduced motion y forced colors (alto contraste).
  for (const [name, media] of [['reduced-motion', { reducedMotion: 'reduce' }], ['alto-contraste', { forcedColors: 'active' }]]) {
    const page = await open(context, 'date=2026-10-17&seed=a&ai=trivial')
    await page.emulateMedia(media)
    await shot(page, `vis14-${name}-hoy`, tag, { fullPage: true })
    await enterBattle(page)
    await ready(page)
    await shot(page, `vis14-${name}-combate`, tag)
    await page.close()
  }
  await context.close()
}

// ---------- VIS-16..19: equipo, datos, Hoy con rival abierto y lanzamientos ----------
const REF_SHOTS = 'e2e-artifacts/ref/shots'
const REFERENCES = { equipo: 'BW_Party.png', 'datos-p1': 'BW_summary_1.png', 'datos-p2': 'BW_summary_2.png', 'datos-p3': 'BW_summary_2_desc.png' }
const hasReference = (file) => existsSync(`${REF_SHOTS}/${file}`)

/** Superpone (50 %) la captura del lienzo `.bt-ds` a la referencia real escalada al mismo tamaño y guarda también el lado a lado. */
function compareWithReference(oursPath, referenceFile, name) {
  if (!hasReference(referenceFile)) return
  const ours = loadPng(oursPath)
  const reference = scaleNearest(loadPng(`${REF_SHOTS}/${referenceFile}`), ours.width / 256)
  const sameSize = { ...reference, width: ours.width, height: Math.min(ours.height, reference.height), rgba: reference.rgba.subarray(0, ours.width * Math.min(ours.height, reference.height) * 4) }
  const oursTrimmed = crop(ours, 0, 0, sameSize.width, sameSize.height)
  savePng(`${OUT}/${name}-lado-a-lado.png`, montage([oursTrimmed, sameSize], 2))
  savePng(`${OUT}/${name}-superpuesta.png`, blend(oursTrimmed, sameSize, 0.5))
}

for (const { tag, width, height } of [{ tag: '360', width: 360, height: 740 }, { tag: '400', width: 400, height: 800 }, { tag: '768', width: 768, height: 1024 }, { tag: '1280', width: 1280, height: 800 }, { tag: '1440', width: 1440, height: 900 }]) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'es-ES', timezoneId: 'Europe/Madrid', deviceScaleFactor: 1 })
  const page = await open(context, 'date=2026-10-19&seed=a&ai=trivial')
  await enterBattle(page)
  await ready(page)
  await shot(page, 'vis16-combate-completo', tag)
  await page.getByRole('button', { name: 'Cambiar', exact: true }).click()
  await page.locator('.bt-party-panel').first().waitFor()
  const stage = page.locator('.bt-ds')
  await stage.screenshot({ path: `${OUT}/vis16-equipo-${tag}.png` })
  compareWithReference(`${OUT}/vis16-equipo-${tag}.png`, REFERENCES.equipo, `vis16-equipo-comparativa-${tag}`)
  await page.locator('.bt-party-panel').nth(1).click()
  await stage.screenshot({ path: `${OUT}/vis16-equipo-menu-${tag}.png` })
  await page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Datos' }).click()
  await page.locator('.bt-summary').waitFor()
  await page.waitForTimeout(400)
  for (const [index, key] of ['datos-p1', 'datos-p2', 'datos-p3'].entries()) {
    if (index > 0) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250) }
    await stage.screenshot({ path: `${OUT}/vis17-${key}-${tag}.png` })
    compareWithReference(`${OUT}/vis17-${key}-${tag}.png`, REFERENCES[key], `vis17-${key}-comparativa-${tag}`)
  }
  // Placas de movimientos ampliadas (x4 lógico) para revisar icono, nombre y PP.
  const shotPath = `${OUT}/vis17-datos-p2-${tag}.png`
  const full = loadPng(shotPath)
  const unit = full.width / 256
  savePng(`${OUT}/vis17-placas-movimientos-${tag}.png`, scaleNearest(crop(full, 0, Math.round(200 * unit), Math.round(150 * unit), Math.round(140 * unit)), 4 / unit))
  await page.close()
  {
    const hoy = await open(context, 'date=2026-10-19')
    await hoy.waitForLoadState('networkidle')
    await shot(hoy, 'vis18-hoy', tag, { fullPage: true })
    await hoy.getByRole('button', { name: 'Ver movimientos y objetos del rival' }).click()
    await shot(hoy, 'vis18-hoy-rival-abierto', tag, { fullPage: true })
    await hoy.close()
  }
  await context.close()
}

// ---------- VIS-20: Pokémon del jugador de espaldas (montaje de especies) ----------
{
  const WANTED = ['Stunfisk', 'Milotic', 'Venusaur', 'Ampharos', 'Snorlax', 'Charizard']
  for (const { tag, width, height } of [{ tag: '400', width: 400, height: 800 }, { tag: '1280', width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'es-ES', timezoneId: 'Europe/Madrid', deviceScaleFactor: 1 })
    const found = new Map()
    for (const date of ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']) {
      for (let lead = 0; lead < 6 && found.size < WANTED.length; lead += 1) {
        const page = await open(context, `date=${date}&seed=a&ai=trivial`)
        await page.getByRole('button', { name: /^Sacar primero/ }).nth(lead).click()
        await page.getByRole('button', { name: 'Combatir' }).click()
        await page.locator('.bt-fight:enabled').waitFor({ timeout: 60000 })
        const name = ((await page.locator('.bt-databox-player .bt-databox-name').textContent()) ?? '').trim()
        if (WANTED.includes(name) && !found.has(name)) {
          const path = `${OUT}/vis20-jugador-${name}-${tag}.png`
          await page.getByTestId('field').screenshot({ path })
          found.set(name, loadPng(path))
        }
        await page.close()
      }
    }
    if (found.size > 0) savePng(`${OUT}/vis20-sprites-jugador-montaje-${tag}.png`, montage(WANTED.filter((name) => found.has(name)).map((name) => found.get(name)), 3))
    await context.close()
  }
}

// ---------- VIS-21: elegir ataque -> espera -> turno siguiente ----------
{
  const context = await browser.newContext({ viewport: { width: 400, height: 800 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', deviceScaleFactor: 1 })
  const page = await open(context, 'date=2026-10-19&seed=a&ai=trivial')
  await enterBattle(page)
  await ready(page)
  await page.locator('.bt-fight').click()
  await page.locator('.bt-moves button:enabled').first().waitFor()
  await shot(page, 'vis21-1-menu-movimientos', '400')
  await page.locator('.bt-moves button:enabled').first().click()
  await page.waitForTimeout(400)
  await shot(page, 'vis21-2-espera', '400')
  await page.locator('.bt-fight:enabled').waitFor({ timeout: 60000 })
  await shot(page, 'vis21-3-turno-siguiente', '400')
  savePng(`${OUT}/vis21-secuencia-elegir-esperar-siguiente.png`, montage(['vis21-1-menu-movimientos', 'vis21-2-espera', 'vis21-3-turno-siguiente'].map((name) => loadPng(`${OUT}/${name}-400.png`)), 3))
  await page.close()
  await context.close()
}

/** Fotogramas de una animación CSS: se pausa y se mueve `currentTime` (ms desde que arrancó la fase), así los fotogramas no dependen de la velocidad del equipo. */
async function frameSheet(page, waitForAttribute, times, name) {
  await page.locator(waitForAttribute).waitFor({ timeout: 30000 })
  const frames = []
  for (const time of times) {
    await page.evaluate((milliseconds) => { for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = milliseconds } }, time)
    const path = `${OUT}/${name}-frame-${String(time).padStart(4, '0')}.png`
    await page.getByTestId('field').screenshot({ path })
    frames.push(loadPng(path))
  }
  return frames
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', deviceScaleFactor: 1 })
  const page = await open(context, 'date=2026-10-19&seed=a&ai=trivial')
  await page.getByRole('button', { name: /^Sacar primero/ }).first().click()
  await page.getByRole('button', { name: 'Combatir' }).click()
  const rival = await frameSheet(page, '[data-testid="field"][data-intro="rivalSend"]', [100, 300, 500, 650, 800, 1000], 'vis19-intro-rival')
  const player = await frameSheet(page, '[data-testid="field"][data-intro="playerSend"]', [200, 500, 700, 850, 1000, 1200, 1400], 'vis19-intro-jugador')
  savePng(`${OUT}/vis19-intro-lanzamiento-hoja.png`, montage([...rival, ...player], 3))
  await page.close()

  const switchPage = await open(context, 'date=2026-10-19&seed=a&ai=trivial')
  await enterBattle(switchPage)
  await ready(switchPage)
  await switchPage.getByRole('button', { name: 'Cambiar', exact: true }).click()
  await switchPage.locator('.bt-party-panel[data-state="ready"]').first().click()
  await switchPage.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Cambiar', exact: true }).click()
  const switching = await frameSheet(switchPage, '[data-testid="field"][data-switch="player"]', [150, 300, 450, 700, 850, 950, 1100, 1250, 1450], 'vis19-cambio')
  savePng(`${OUT}/vis19-cambio-retirada-envio-hoja.png`, montage(switching, 3))
  await switchPage.close()
  await context.close()
}
await browser.close()
stop()
console.log('capturas en', OUT)
