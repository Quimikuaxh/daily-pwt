import { test, expect } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'
import { BattlePage } from './pages/BattlePage'

// PRD §10.2.1: el entrenador se retira antes de que aparezca su Pokémon; tras la intro no queda ningún entrenador.
interface Timing { name: string; end: number; delay: number }

const timings = (page: import('@playwright/test').Page, selector: string) =>
  page.evaluate((target) => (document.getAnimations() as CSSAnimation[])
    .filter((animation) => (animation.effect as KeyframeEffect).target?.matches(target))
    .map((animation) => ({ name: animation.animationName, end: Number((animation.effect as KeyframeEffect).getComputedTiming().endTime), delay: Number((animation.effect as KeyframeEffect).getComputedTiming().delay) })),
  selector) as Promise<Timing[]>

test.describe('Orden de la intro', () => {
  test('E2E-39 el rival y el protagonista salen antes de que aparezca su Pokémon, y ninguno queda visible al acabar', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(undefined, 'seed=a&ai=trivial')
    await today.leadButtons.first().click()
    await today.fightButton.click()
    const field = page.getByTestId('field')

    await expect(field).toHaveAttribute('data-intro', 'rivalSend', { timeout: 30_000 })
    const rivalTrainer = (await timings(page, '.bt-trainer-rival')).find((timing) => timing.name === 'bt-slide-out-right')
    const rivalMon = (await timings(page, '.bt-mon-rival')).find((timing) => timing.name === 'bt-appear')
    expect(rivalTrainer && rivalMon, 'hay animación de salida y de aparición del rival').toBeTruthy()
    expect(rivalTrainer!.end, 'el entrenador rival ya salió cuando aparece su Pokémon').toBeLessThanOrEqual(rivalMon!.delay)

    await expect(field).toHaveAttribute('data-intro', 'playerSend', { timeout: 30_000 })
    const playerTrainer = (await timings(page, '.bt-trainer-player')).find((timing) => timing.name === 'bt-slide-out-left')
    const playerMon = (await timings(page, '.bt-mon-player')).find((timing) => timing.name === 'bt-appear')
    expect(playerTrainer && playerMon, 'hay animación de salida y de aparición del protagonista').toBeTruthy()
    expect(playerTrainer!.end, 'el protagonista ya salió cuando aparece su Pokémon').toBeLessThanOrEqual(playerMon!.delay)

    await expect(field).toHaveAttribute('data-intro', 'done', { timeout: 30_000 })
    await expect(page.locator('.bt-trainer'), 'ningún entrenador tras la intro').toHaveCount(0)
    await expect(page.locator('.bt-intro')).toHaveCount(0)
    await new BattlePage(page).waitForActionOrResult()
  })
})

test.describe('Barra superior y menú de movimientos', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('E2E-40 en escritorio Salir, Registro y Velocidad van en una sola línea', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(undefined, 'seed=a&ai=trivial')
    await today.leadButtons.first().click()
    await today.fightButton.click()
    const battle = new BattlePage(page)
    await battle.waitForActionOrResult()
    const tops = await Promise.all([battle.exitButton, battle.historyButton, battle.speedButton].map(async (button) => Math.round((await button.boundingBox())?.y ?? -1)))
    expect(new Set(tops).size, `los tres botones en la misma línea (${tops.join(', ')})`).toBe(1)
  })

  test('E2E-41 teselas de movimiento: PP centrados con el mismo hueco, sin icono de tipo y con el botón Volver ripeado', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(undefined, 'seed=a&ai=trivial')
    await today.leadButtons.first().click()
    await today.fightButton.click()
    const battle = new BattlePage(page)
    await battle.waitForActionOrResult()
    await battle.fightButton.click()
    await expect(page.locator('.bt-move .type-chip')).toHaveCount(0)
    const tiles = await page.locator('.bt-move').all()
    for (const tile of tiles) {
      const [tileBox, ppBox, name] = [await tile.boundingBox(), await tile.locator('.bt-move-pp').boundingBox(), await tile.getAttribute('aria-label')]
      expect(name, 'nombre accesible con tipo y PP').toMatch(/, tipo .+, PP \d+ de \d+/)
      expect(Math.abs((ppBox!.x + ppBox!.width / 2) - (tileBox!.x + tileBox!.width / 2)), 'PP centrados en la tesela').toBeLessThanOrEqual(1.5)
      const gap = await tile.locator('.bt-move-pp').evaluate((element) => { const [label, value] = Array.from(element.children).map((child) => child.getBoundingClientRect()); return value.left - label.right })
      expect(gap, 'hueco tras PP').toBeGreaterThan(2)
    }
    const gaps = await page.locator('.bt-move-pp').evaluateAll((elements) => elements.map((element) => { const [label, value] = Array.from(element.children).map((child) => child.getBoundingClientRect()); return Math.round(value.left - label.right) }))
    expect(new Set(gaps).size, 'mismo hueco tras PP en las cuatro').toBe(1)
    await expect(page.locator('.bt-back img')).toHaveAttribute('src', /touch\/back\.png$/)
  })
})
