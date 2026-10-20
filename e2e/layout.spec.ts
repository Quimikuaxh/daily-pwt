import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { D0, openParty, openSummary, startBattle } from './support'
import { TodayPage } from './pages/TodayPage'

// Alineación y recortes: tarjetas de Hoy (jugador y rival), iconos de tipo, pantalla de datos y glifos de la fuente del juego.
const FIVE_DATES = ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']

/** decodePng de scripts/lib/png.mjs (el mismo decodificador del script de assets). */
async function decodePng(bytes: Buffer): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  const module = await import(pathToFileURL(resolve(process.cwd(), 'scripts', 'lib', 'png.mjs')).href)
  return module.decodePng(bytes)
}

async function inkMargins(chip: Locator, scale: number, borderLogical = 2): Promise<{ left: number; right: number; top: number; bottom: number }> {
  const { width, height, rgba } = await decodePng(await chip.screenshot())
  const inset = borderLogical * scale + 2
  const reference = (inset * width + inset) * 4
  let [minX, minY, maxX, maxY] = [width, height, -1, -1]
  for (let y = inset; y < height - inset; y += 1) {
    for (let x = inset; x < width - inset; x += 1) {
      const offset = (y * width + x) * 4
      const distance = Math.abs(rgba[offset] - rgba[reference]) + Math.abs(rgba[offset + 1] - rgba[reference + 1]) + Math.abs(rgba[offset + 2] - rgba[reference + 2])
      if (distance > 150) [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)]
    }
  }
  return { left: minX - inset, right: width - inset - 1 - maxX, top: minY - inset, bottom: height - inset - 1 - maxY }
}

const rects = (locator: Locator) => locator.evaluateAll((elements) => elements.map((element) => { const { x, y, width, height, right, bottom } = element.getBoundingClientRect(); return { x, y, width, height, right, bottom } }))

test.describe('Hoy: tarjetas alineadas', () => {
  test('E2E-30 los iconos de tipo tienen el mismo ancho y los movimientos alinean tipo, categoría, potencia y precisión en columnas', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    await page.addStyleTag({ content: '.fight-bar{display:none}' })
    await today.rivalToggle.click()

    const chipWidths = await rects(page.locator('.type-chip'))
    expect(chipWidths.length).toBeGreaterThan(20)
    expect(new Set(chipWidths.map((chip) => Math.round(chip.width))).size, 'todos los iconos de tipo miden lo mismo').toBe(1)

    for (const list of await page.locator('ul.move-list').all()) {
      const columns = await list.evaluate((element) => {
        const rows = Array.from(element.querySelectorAll('.move-row'))
        const left = (row: Element, selector: string) => (row.querySelector(selector) as HTMLElement).getBoundingClientRect().left - element.getBoundingClientRect().left
        return rows.map((row) => ({ type: Math.round(left(row, '.type-chip')), category: Math.round(left(row, '.move-stats > :nth-child(1)')), power: Math.round(left(row, '.move-stats > :nth-child(2)')), accuracy: Math.round(left(row, '.move-stats > :nth-child(3)')) }))
      })
      for (const key of ['type', 'category', 'power', 'accuracy'] as const) expect(new Set(columns.map((column) => column[key])).size, `columna ${key} igual en las 4 filas`).toBe(1)
    }

    const heads = await rects(page.locator('.rival-mon-details .player-card-head'))
    expect(new Set(heads.map((head) => Math.round(head.height))).size, 'cabeceras de la misma altura').toBe(1)
    const cardsByRow = new Map<number, number[]>()
    for (const card of await rects(page.locator('ul.rival-team > li'))) cardsByRow.set(Math.round(card.y), [...(cardsByRow.get(Math.round(card.y)) ?? []), Math.round(card.height)])
    for (const heights of cardsByRow.values()) expect(new Set(heights).size, 'tarjetas de la misma fila con la misma altura').toBe(1)
  })

  test('E2E-30 las tarjetas del jugador usan la misma rejilla (mismo componente)', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    await page.addStyleTag({ content: '.fight-bar{display:none}' })
    const lefts = await page.locator('article.player-card').first().locator('.move-row').evaluateAll((rows) => rows.map((row) => Math.round((row.querySelector('.move-stats > :nth-child(2)') as HTMLElement).getBoundingClientRect().left)))
    expect(new Set(lefts).size).toBe(1)
  })

  test('E2E-31 el contenido termina por encima de la barra fija COMBATIR (nada queda tapado al final)', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const lastCard = await page.locator('article.player-card').last().boundingBox()
    const bar = await page.locator('.fight-bar').boundingBox()
    expect(lastCard && bar && lastCard.y + lastCard.height <= bar.y + 1).toBe(true)
    const lastMove = await page.locator('article.player-card').last().locator('.move-row').last().boundingBox()
    expect(lastMove && bar && lastMove.y + lastMove.height <= bar.y + 1).toBe(true)
  })
})

test.describe('Iconos de tipo: texto centrado', () => {
  test('E2E-32 el texto queda centrado dentro del icono (Hoy, escala 2): márgenes opuestos dentro de 2 px lógicos', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    await page.addStyleTag({ content: '.fight-bar{display:none}' })
    await today.rivalToggle.click()
    const seen = new Set<string>()
    const chips = page.locator('.mon-head .type-chip')
    for (let index = 0; index < (await chips.count()); index += 1) {
      const label = ((await chips.nth(index).textContent()) ?? '').trim()
      if (seen.has(label)) continue
      seen.add(label)
      const margins = await inkMargins(chips.nth(index), 2)
      expect(Math.abs(margins.left - margins.right) / 2, `${label}: izquierda ${margins.left} derecha ${margins.right}`).toBeLessThanOrEqual(2)
      if (/[ÁÉÍÓÚáéíóú]/.test(label)) {
        // La tilde sube la tinta: solo se exige que no toque el borde de arriba ni de abajo.
        expect(margins.top, `${label}: arriba`).toBeGreaterThanOrEqual(0)
        expect(margins.bottom, `${label}: abajo`).toBeGreaterThanOrEqual(0)
      } else {
        expect(Math.abs(margins.top - margins.bottom) / 2, `${label}: arriba ${margins.top} abajo ${margins.bottom}`).toBeLessThanOrEqual(1.5)
      }
    }
    expect(seen.size).toBeGreaterThan(4)
  })
})

async function openSummaryAt(page: Page, date: string, member: number): Promise<void> {
  const { battle } = await startBattle(page, { date, seed: 'a' })
  await battle.waitForActionOrResult()
  await openParty(page)
  await openSummary(page, member)
}

/** Cajas permitidas (px lógicos del lienzo) de cada texto de la pantalla de datos; ninguno debe salirse de la suya. */
const SUMMARY_BOXES: { selector: string; page: number | null; box: [number, number, number, number] }[] = [
  { selector: '.bt-sum-slot-name', page: null, box: [8, 207, 144, 337] },
  { selector: '.bt-sum-ability-text', page: 1, box: [35, 159, 205, 192] },
  { selector: '.bt-sum-move-text', page: 2, box: [0, 104, 256, 152] },
]

test.describe('Pantalla de datos: ningún texto desborda su caja', () => {
  for (const date of FIVE_DATES) {
    test(`E2E-33 ${date}: los 6 Pokémon en las tres páginas`, async ({ page }) => {
      await openSummaryAt(page, date, 0)
      const summary = page.locator('.bt-summary')
      for (let member = 0; member < 6; member += 1) {
        for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
          await expect(summary).toHaveAttribute('data-page', String(pageIndex))
          const origin = await summary.boundingBox()
          const scale = (origin?.width ?? 256) / 256
          const logical = async (locator: Locator) => (await rects(locator)).map((r) => ({ left: (r.x - (origin?.x ?? 0)) / scale, top: (r.y - (origin?.y ?? 0)) / scale, right: (r.right - (origin?.x ?? 0)) / scale, bottom: (r.bottom - (origin?.y ?? 0)) / scale }))
          const text = await summary.locator('.bt-sum-label, .bt-sum-value, .bt-sum-slot-name, .bt-sum-slot-pp, .bt-sum-slot-pp-value, .bt-sum-description').all()
          for (const element of text) {
            const [box] = await logical(element)
            const label = (await element.textContent())?.trim() ?? ''
            expect(box.left, `${date} #${member} p${pageIndex} "${label}" dentro del lienzo (izq.)`).toBeGreaterThanOrEqual(-0.5)
            expect(box.right, `"${label}" dentro del lienzo (der.)`).toBeLessThanOrEqual(256.5)
            expect(box.bottom, `"${label}" dentro del lienzo (abajo)`).toBeLessThanOrEqual(384.5)
          }
          for (const rule of SUMMARY_BOXES) {
            if (rule.page !== null && rule.page !== pageIndex) continue
            for (const box of await logical(summary.locator(rule.selector))) {
              expect(box.left, rule.selector).toBeGreaterThanOrEqual(rule.box[0] - 1)
              expect(box.right, `${rule.selector} (der.)`).toBeLessThanOrEqual(rule.box[2] + 1)
              expect(box.top, `${rule.selector} (arriba)`).toBeGreaterThanOrEqual(rule.box[1] - 1)
              expect(box.bottom, `${rule.selector} (abajo)`).toBeLessThanOrEqual(rule.box[3] + 1)
            }
          }
          if (pageIndex === 0) {
            // Los valores de las filas de la izquierda terminan antes de la diagonal del fondo y del sprite (x ≈ 196 a esa altura).
            for (const box of await logical(summary.locator('.bt-sum-value[data-max]'))) {
              if (box.top >= 200 && box.top <= 300) expect(box.right, `valor de la fila y=${Math.round(box.top)}`).toBeLessThanOrEqual(197)
            }
          }
          const overflowing = await summary.locator('.bt-sum-description, .bt-sum-slot-name, .bt-sum-value[data-max]').evaluateAll((elements) =>
            elements.filter((element) => element.scrollHeight > element.clientHeight + 1).map((element) => element.textContent),
          )
          expect(overflowing, 'ningún texto recortado en vertical').toEqual([])
          if (pageIndex < 2) await page.keyboard.press('ArrowRight')
        }
        await page.keyboard.press('ArrowLeft')
        await page.keyboard.press('ArrowLeft')
        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(30)
      }
    })
  }

  test('E2E-33 el nombre del movimiento nunca se solapa con el icono de tipo (todas las placas de las fechas de prueba)', async ({ page }) => {
    await openSummaryAt(page, D0, 0)
    const summary = page.locator('.bt-summary')
    await page.keyboard.press('ArrowRight')
    for (let member = 0; member < 6; member += 1) {
      const slots = await summary.locator('.bt-sum-slot-visual').all()
      for (const slot of slots) {
        const [chip] = await rects(slot.locator('.bt-sum-slot-type'))
        const [name] = await rects(slot.locator('.bt-sum-slot-name'))
        expect(name.x, 'el nombre empieza a la derecha del icono').toBeGreaterThanOrEqual(chip.right - 0.5)
      }
      await page.keyboard.press('ArrowDown')
    }
  })

  test('E2E-33 la descripción de la habilidad queda centrada en vertical en su recuadro', async ({ page }) => {
    await openSummaryAt(page, D0, 0)
    await page.keyboard.press('ArrowRight')
    const summary = page.locator('.bt-summary')
    for (let member = 0; member < 6; member += 1) {
      const [box] = await rects(summary.locator('.bt-sum-ability-box'))
      const [text] = await rects(summary.locator('.bt-sum-ability-text'))
      const freeTop = text.y - box.y
      const freeBottom = box.bottom - text.bottom
      expect(Math.abs(freeTop - freeBottom), `margen arriba ${freeTop} abajo ${freeBottom}`).toBeLessThanOrEqual(1.5 * (box.width / 150))
      await page.keyboard.press('ArrowDown')
    }
  })
})

test.describe('Glifos sin recortar', () => {
  /** Altura de tinta de los peores glifos de la fuente cargada frente al alto de la línea del elemento con el texto recortado. */
  async function clippedTexts(page: Page): Promise<string[]> {
    return page.evaluate(async () => {
      await document.fonts.ready
      const canvas = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
      const offenders: string[] = []
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const style = getComputedStyle(element)
        const clips = style.overflowY !== 'visible' || style.overflowX !== 'visible'
        const ownText = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? '').join('').trim()
        if (!clips || ownText === '' || element.classList.contains('sr-only') || element.getBoundingClientRect().height === 0 || style.display === 'none') continue
        canvas.font = `${style.fontSize} ${style.fontFamily}`
        const metrics = canvas.measureText('ÁÉÍÓÚpgjqyÑ')
        const ink = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
        const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2
        const lines = Math.max(1, Math.round(element.clientHeight / lineHeight))
        const available = element.clientHeight - (lines - 1) * lineHeight + Number.parseFloat(style.paddingBottom)
        if (ink > available + 0.5 || element.scrollHeight > element.clientHeight + 1) offenders.push(`${element.className || element.tagName}: tinta ${ink.toFixed(1)} > alto útil ${available.toFixed(1)} (${ownText.slice(0, 24)})`)
      }
      return offenders
    })
  }

  test('E2E-34 ningún texto con overflow oculto corta los descendentes (p, g, j, q, y): Hoy, combate, equipo y datos', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    expect(await clippedTexts(page), 'Hoy').toEqual([])
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()
    expect(await clippedTexts(page), 'combate').toEqual([])
    await battle.fightButton.click()
    expect(await clippedTexts(page), 'movimientos').toEqual([])
    await page.getByRole('button', { name: 'Volver' }).click()
    await openParty(page)
    expect(await clippedTexts(page), 'equipo').toEqual([])
    await openSummary(page, 1)
    for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
      expect(await clippedTexts(page), `datos ${pageIndex + 1}`).toEqual([])
      await page.keyboard.press('ArrowRight')
    }
  })
})

test.describe('Hoy: rejillas a todo el ancho', () => {
  for (const width of [360, 768, 1280, 1440]) {
    test(`E2E-37 a ${width} px el último elemento de cada fila llega al borde derecho del panel (equipo rival y tarjetas del jugador)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const today = new TodayPage(page)
      await today.goto(D0)
      for (const detailed of [false, true]) {
        if (detailed) await today.rivalToggle.click()
        for (const selector of ['ul.rival-team', '.player-grid']) {
          const grid = page.locator(selector)
          const container = await grid.boundingBox()
          const items = await rects(grid.locator('> *'))
          const rows = new Map<number, { right: number }[]>()
          for (const item of items) rows.set(Math.round(item.y), [...(rows.get(Math.round(item.y)) ?? []), item])
          for (const row of rows.values()) {
            const right = Math.max(...row.map((item) => item.right))
            expect(Math.abs(right - ((container?.x ?? 0) + (container?.width ?? 0))), `${selector}${detailed ? ' (detalle)' : ''} a ${width} px: borde derecho de la fila`).toBeLessThanOrEqual(2)
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth), 'sin scroll horizontal').toBeLessThanOrEqual(width)
        }
      }
    })
  }
})

test.describe('Pantalla de datos: iconos de tipo y selector de página', () => {
  test('E2E-38 el texto de los iconos de tipo de las placas de movimientos está centrado (mismo componente que Hoy): márgenes opuestos dentro de 1 px lógico', async ({ page }) => {
    await openSummaryAt(page, D0, 0)
    await page.keyboard.press('ArrowRight')
    const summary = page.locator('.bt-summary')
    const box = await summary.boundingBox()
    const scale = (box?.width ?? 256) / 256
    for (let member = 0; member < 6; member += 1) {
      const chips = summary.locator('.bt-sum-slot-type .type-chip')
      for (let index = 0; index < (await chips.count()); index += 1) {
        const label = ((await chips.nth(index).textContent()) ?? '').trim()
        const margins = await inkMargins(chips.nth(index), scale, 1)
        expect(Math.abs(margins.left - margins.right) / scale, `${label}: izquierda ${margins.left} derecha ${margins.right}`).toBeLessThanOrEqual(1.01)
      }
      await page.keyboard.press('ArrowDown')
    }
  })
})

test.describe('Pantalla de datos: cada texto centrado en su franja', () => {
  test('E2E-42 las mayúsculas de cada texto quedan centradas en la franja del fondo que le corresponde (≤ 1 px nativo) en las tres páginas', async ({ page }) => {
    await openSummaryAt(page, D0, 0)
    const summary = page.locator('.bt-summary')
    for (let member = 0; member < 3; member += 1) {
      for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
        const measured = await summary.evaluate(async (root) => {
          await document.fonts.ready
          const canvas = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
          const rootRect = root.getBoundingClientRect()
          const scale = rootRect.width / 256
          return Array.from(root.querySelectorAll<HTMLElement>('[data-band]')).filter((element) => element.getBoundingClientRect().width > 0).map((element) => {
            const style = getComputedStyle(element)
            canvas.font = `${style.fontSize} ${style.fontFamily}`
            const capHeight = canvas.measureText('H').actualBoundingBoxAscent
            const probe = document.createElement('span')
            probe.style.cssText = 'display:inline-block;width:0;height:0'
            element.appendChild(probe)
            const baseline = (probe.getBoundingClientRect().bottom - rootRect.top) / scale
            probe.remove()
            return { text: (element.textContent ?? '').trim().slice(0, 24), band: element.dataset.band as string, capTop: baseline - capHeight, baseline }
          })
        })
        expect(measured.length, `página ${pageIndex + 1}: textos con franja`).toBeGreaterThan(3)
        for (const item of measured) {
          const [bandTop, bandBottom] = item.band.split(',').map(Number)
          const capCenter = (item.capTop + item.baseline) / 2
          expect(Math.abs(capCenter - (bandTop + bandBottom) / 2), `"${item.text}" (p${pageIndex + 1}): mayúsculas ${item.capTop.toFixed(1)}..${item.baseline.toFixed(1)} en la franja ${item.band}`).toBeLessThanOrEqual(1.01)
          expect(item.capTop, `"${item.text}": no sobresale por arriba`).toBeGreaterThanOrEqual(bandTop - 0.5)
          expect(item.baseline, `"${item.text}": no sobresale por abajo`).toBeLessThanOrEqual(bandBottom + 0.5)
        }
        if (pageIndex < 2) await page.keyboard.press('ArrowRight')
      }
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowDown')
    }
  })
})
