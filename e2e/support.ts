import type { Locator, Page } from '@playwright/test'
import { BattlePage } from './pages/BattlePage'
import { TodayPage } from './pages/TodayPage'
import { LAUNCH_DATE } from '../src/core/launch'
import scenarios from './scenarios.json' with { type: 'json' }

export { LAUNCH_DATE }

/** Suma días a 'YYYY-MM-DD' sin depender de la zona horaria. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * Escenario de un E2E: rival (y variante opcional) por id con los ganchos ?trainer=&variant=, y una fecha que solo
 * siembra variante, habilidades y equipo del jugador. Así el escenario no depende de LAUNCH_DATE ni del orden de la bolsa.
 * Las fechas son literales a propósito: cambiarlas cambia el equipo del jugador (y los combates que dependen de él).
 */
export type Scenario = { trainer: string; variant?: string; date: string }

// Una sola lista de escenarios para los E2E y para las capturas visuales (scripts/capture-vis.mjs).
export const PLUBIO: Scenario = scenarios.plubio
export const MISTY: Scenario = scenarios.misty
export const MAXIMO: Scenario = scenarios.maximo
export const CAMILA: Scenario = scenarios.camila
export const ROJO: Scenario = scenarios.rojo
export const BROCK: Scenario = scenarios.brock

/** Escenario por defecto: contra Plubio hay cambio forzado tras el primer turno (ver los casos que usan MISTY). */
export const DEFAULT_SCENARIO = PLUBIO
export const REF_SCENARIOS = [PLUBIO, MISTY, MAXIMO] as const
export const SIX_SCENARIOS = [PLUBIO, MISTY, MAXIMO, CAMILA, ROJO, BROCK] as const

/** Query de los ganchos para un escenario (sin `?`). */
export function scenarioQuery(scenario: Scenario): string {
  const variant = scenario.variant ? `&variant=${scenario.variant}` : ''
  return `date=${scenario.date}&trainer=${scenario.trainer}${variant}`
}

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

/**
 * Abre Hoy con ganchos (fecha, semilla de combate y IA trivial), elige el inicial y entra en combate. `mode` es el botón que se pulsa:
 * por defecto el oficial, que solo se puede jugar una vez por día del reto y contexto (DEC-43); un test que juega más de una partida
 * en el mismo contexto usa `practice`.
 */
export async function startBattle(
  page: Page,
  opts: { scenario?: Scenario; seed?: string; lead?: number; tap?: boolean; mode?: 'official' | 'practice' } = {},
): Promise<{ today: TodayPage; battle: BattlePage }> {
  const today = new TodayPage(page)
  const query = [scenarioQuery(opts.scenario ?? DEFAULT_SCENARIO), `seed=${opts.seed ?? 'a'}`, 'ai=trivial'].join('&')
  await page.goto(`./?${query}`)
  await today.challengeNumber.waitFor()
  const press = (locator: Locator) => (opts.tap ? locator.tap() : locator.click())
  await press(today.leadButtons.nth(opts.lead ?? 0))
  await press(opts.mode === 'practice' ? today.practiceButton : today.fightButton)
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
