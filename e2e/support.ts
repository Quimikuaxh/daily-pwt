import type { Locator, Page } from '@playwright/test'
import { BattlePage } from './pages/BattlePage'
import { TodayPage } from './pages/TodayPage'

export const D0 = '2026-10-17'
export const REF_DATES = ['2026-10-17', '2026-10-18', '2026-10-19'] as const

/** Palabras en inglés / marcas de protocolo que nunca deben llegar al registro (RF-51). */
export const FORBIDDEN_IN_LOG = /\||\b(used|fainted|sent out|super effective|not very effective|The opposing|Go!|foe)\b|\bp[12][a-d]?:/i

/** Recoge errores de consola, excepciones de página y peticiones fallidas para exigir una consola limpia. */
export function collectProblems(page: Page): string[] {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(`console.${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`))
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`http ${response.status()}: ${response.url()}`)
  })
  return problems
}

/** Abre Hoy con ganchos (fecha, semilla de combate y IA trivial), elige el inicial y entra en combate. */
export async function startBattle(
  page: Page,
  opts: { date?: string; seed?: string; lead?: number; tap?: boolean } = {},
): Promise<{ today: TodayPage; battle: BattlePage }> {
  const today = new TodayPage(page)
  const query = [opts.date ? `date=${opts.date}` : '', `seed=${opts.seed ?? 'a'}`, 'ai=trivial'].filter(Boolean).join('&')
  await page.goto(`./?${query}`)
  await today.challengeNumber.waitFor()
  const press = (locator: Locator) => (opts.tap ? locator.tap() : locator.click())
  await press(today.leadButtons.nth(opts.lead ?? 0))
  await press(today.fightButton)
  const battle = new BattlePage(page)
  await battle.root.waitFor()
  return { today, battle }
}

/** Avanza con Tab hasta que `target` tenga el foco (navegación solo con teclado). */
export async function tabTo(page: Page, target: Locator, maxPresses = 80): Promise<void> {
  for (let i = 0; i < maxPresses; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('No se ha podido llegar con Tab al elemento esperado')
}

/** Abre la pantalla de equipo desde el menú principal del combate. */
export async function openParty(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cambiar', exact: true }).click()
  await page.locator('.bt-party-panel').first().waitFor()
}

/** Desde la pantalla de equipo: elige la placa `index` y abre Datos. */
export async function openSummary(page: Page, index: number): Promise<void> {
  await page.locator('.bt-party-panel').nth(index).click()
  await page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Datos' }).click()
  await page.locator('.bt-summary').waitFor()
}

/** Escala (px de pantalla por píxel lógico) del lienzo de la DS. */
export const stageScale = (page: Page): Promise<number> =>
  page.locator('.bt-ds').evaluate((element) => element.getBoundingClientRect().width / 256)
