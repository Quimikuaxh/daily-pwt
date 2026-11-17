import { expect, test, type Page } from '@playwright/test'
import { BattlePage } from './pages/BattlePage'
import { TodayPage } from './pages/TodayPage'
import type { TowerRecord } from '../src/storage/towerStore'

const key = 'daily-pwt:tower:v1'
const read = (page: Page): Promise<TowerRecord> => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), key)

async function openTower(page: Page) {
  await page.getByRole('button', { name: 'Modos de juego' }).click()
  await page.getByRole('button', { name: 'Torre Batalla' }).click()
}

test('Torre: ordena el equipo una vez, reanuda el combate y termina la serie al rendirse', async ({ page }) => {
  const today = new TodayPage(page)
  const battle = new BattlePage(page)
  await today.goto(undefined, 'ai=trivial')
  await openTower(page)
  await page.getByRole('button', { name: 'Nueva serie' }).click()
  const before = await read(page)
  const first = page.locator('[data-place="party-0"]')
  const second = page.locator('[data-place="party-1"]')
  await second.click()
  const menu = page.getByRole('group', { name: /Qué hacer con/ })
  await expect(menu.getByRole('button')).toHaveText(['Mover', 'Datos', 'Cancelar'])
  await menu.getByRole('button', { name: 'Datos', exact: true }).click()
  const details = page.locator('.tower-team-console .bt-summary')
  await expect(details).toHaveAttribute('data-page', '0')
  await details.getByRole('button', { name: 'Página siguiente' }).click()
  await details.getByRole('button', { name: 'Página siguiente' }).click()
  await expect(details.locator('.bt-sum-slot')).toHaveCount(4)
  await expect(details.locator('.bt-sum-move-text')).not.toBeEmpty()
  await details.getByRole('button', { name: 'Cerrar datos' }).click()
  const from = (await second.boundingBox())!
  const to = (await first.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await read(page)).state.team[0]).toEqual(before.state.team[1])
  const ordered = await read(page)
  expect(ordered.state.team[1]).toEqual(before.state.team[0])
  await page.getByRole('button', { name: 'Empezar combate' }).click()
  await expect(page.getByTestId('battle-mode')).toHaveText('Torre · 1/7')
  await battle.maxSpeed()
  await battle.waitForActionOrResult()
  await battle.switchButton.click()
  await expect(page.locator('.bt-party-panel')).toHaveCount(6)
  await expect(page.locator('.bt-party[data-reorder]')).toHaveCount(0)
  await expect(page.locator('.bt-party-panel[data-place]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Volver', exact: true }).click()
  await battle.decide()
  await battle.waitForActionOrResult()
  // La serie sale de una semilla aleatoria: si el primer movimiento bloquea (Enfado, Hiperrayo…), los turnos forzados también se guardan
  // como decisiones. Lo que se comprueba es que haya alguna y que la reanudación conserve las mismas (17/11/2026: esperaba 1 y hubo 3).
  await expect.poll(async () => (await read(page)).battle?.decisions.length ?? 0).toBeGreaterThan(0)
  const decided = (await read(page)).battle!.decisions.length
  const history = await battle.logLines()
  await battle.exitButton.click()
  await expect(page.getByRole('dialog')).toContainText('Podrás reanudar este combate desde la Torre Batalla.')
  await page.getByRole('button', { name: 'Sí, salir' }).click()

  await page.reload()
  await today.challengeNumber.waitFor()
  await openTower(page)
  await expect(page.locator('[data-place^="party-"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Reanudar combate' }).click()
  await battle.waitForActionOrResult()
  expect((await read(page)).battle?.decisions.length).toBe(decided)
  expect((await read(page)).state.team).toEqual(ordered.state.team)
  expect(await battle.logLines()).toEqual(history)

  // Si el último turno acabó en KO, el daily pide elegir sustituto antes de volver al menú de acciones.
  if (await battle.waitForActionOrResult() === 'switch') {
    await battle.chooseSubstitute()
    await battle.waitForActionOrResult()
  }
  await battle.forfeitButton.click()
  await page.getByRole('button', { name: 'Sí, rendirme' }).click()
  await expect(page.getByRole('heading', { name: 'Fin de la serie' })).toBeVisible()
  expect((await read(page)).battle).toBeNull()
  await page.getByRole('button', { name: 'Nueva serie' }).click()
  expect((await read(page)).state.seed).not.toEqual(ordered.state.seed)
})

test('Torre: una pausa guardada muestra el próximo rival y empieza con el equipo restaurado', async ({ page }) => {
  const today = new TodayPage(page)
  await today.goto(undefined, 'ai=trivial')
  await openTower(page)
  await page.getByRole('button', { name: 'Nueva serie' }).click()
  const initial = await read(page)
  // Equivale al registro que deja la primera victoria, cubierto por las transiciones del núcleo.
  const paused = { ...initial, state: { ...initial.state, phase: 'between', index: 1 } }
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [key, paused] as const)
  await page.reload()
  await today.challengeNumber.waitFor()
  await openTower(page)
  await expect(page.getByRole('heading', { name: 'Combate 2 de 7' })).toBeVisible()
  await expect(page.locator('.tower-rival')).toContainText(initial.state.rivals[1].trainer.nameEs)
  await expect(page.getByText('Equipo restaurado')).toBeVisible()
  await page.getByRole('button', { name: 'Volver a Hoy' }).click()
  await openTower(page)
  await page.getByRole('button', { name: 'Combatir', exact: true }).click()
  await expect(page.getByTestId('battle-mode')).toHaveText('Torre · 2/7')
  const battle = new BattlePage(page)
  await battle.maxSpeed()
  await battle.waitForActionOrResult()
  expect((await read(page)).battle?.decisions).toEqual([])
  await expect(page.getByTestId('player-hp')).toContainText(initial.state.team[0].nameEs)
})

// E2E-90 (Jose, 17/11/2026, maqueta A): al ganar la serie sale la pantalla de victoria con los siete vencidos y el equipo; Nueva serie
// sortea otra y vuelve a la preparación.
test('Torre: una serie ganada muestra la victoria con los vencidos y el equipo, y Nueva serie empieza otra', async ({ page }) => {
  const today = new TodayPage(page)
  await today.goto(undefined, 'ai=trivial')
  await openTower(page)
  await page.getByRole('button', { name: 'Nueva serie' }).click()
  const initial = await read(page)
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [key, { ...initial, state: { ...initial.state, phase: 'won', index: 6 } }] as const)
  await page.reload()
  await today.challengeNumber.waitFor()
  await openTower(page)
  await expect(page.getByRole('heading', { name: 'Torre completada. 7 de 7 victorias' })).toBeAttached()
  const champion = initial.state.rivals[6].trainer.nameEs
  await expect(page.locator('.tower-victory ol li').last()).toHaveText(`${champion}, campeón`)
  await expect(page.locator('.tower-victory ul li')).toHaveCount(6)
  await expect(page.locator('.tower-victory .unova-hall img[src*="-vs.png"]')).toHaveCount(7)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin desplazamiento horizontal').toBe(true)
  await page.getByRole('button', { name: 'Nueva serie' }).click()
  await expect(page.locator('[data-place="party-0"]')).toBeVisible()
  expect((await read(page)).state.seed).not.toEqual(initial.state.seed)
})
