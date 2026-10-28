import { test, expect, type Page } from '@playwright/test'
import { BattlePage } from './pages/BattlePage'
import { TodayPage } from './pages/TodayPage'
import { DEFAULT_SCENARIO, collectProblems, startBattle } from './support'

// DEC-43 · PRD §4.3 y §11 · criterios 7-10 y 17. Cada test usa un contexto nuevo de Playwright, así que arranca sin datos guardados.
const STORAGE_KEY = 'daily-pwt:v1'

type StoredDays = { version: number; days: Record<string, { status: string; battle: { decisions: unknown[] } | null }> }
const storedDays = (page: Page): Promise<StoredDays> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"version":1,"days":{}}'), STORAGE_KEY)

/** Todo lo que debe coincidir tras reanudar: historial, PS de ambos bandos y contadores. */
async function snapshot(page: Page, battle: BattlePage) {
  return {
    log: await battle.logLines(),
    playerHp: await page.getByTestId('player-hp').textContent(),
    rivalHp: await page.getByTestId('rival-hp').textContent(),
    remaining: [await page.getByTestId('remaining-player').textContent(), await page.getByTestId('remaining-rival').textContent()],
  }
}

async function forfeit(page: Page, battle: BattlePage) {
  await battle.forfeitButton.click()
  await page.getByRole('button', { name: 'Sí, rendirme' }).click()
  await expect(battle.resultTitle).toHaveText('Derrota')
}

test.describe('Combate oficial: reanudar', () => {
  test('E2E-52 recargar a mitad de combate lo reanuda en el mismo turno, con el mismo estado y registro, y sin repetir la intro', async ({ page }) => {
    await page.addInitScript(() => {
      const phases: string[] = []
      ;(window as unknown as { __phases: string[] }).__phases = phases
      const record = () => {
        const phase = document.querySelector('[data-testid=field]')?.getAttribute('data-intro')
        if (phase && phases.at(-1) !== phase) phases.push(phase)
      }
      new MutationObserver(record).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-intro'] })
    })
    const { battle, today } = await startBattle(page, { seed: 'a' })
    await expect(page.getByTestId('battle-mode')).toHaveText('OFICIAL')
    await battle.maxSpeed()
    for (let decision = 0; decision < 3; decision += 1) await battle.decide()
    await battle.waitForActionOrResult()
    const before = await snapshot(page, battle)
    expect(before.log.filter((line) => /^Turno/.test(line)).length, 'hay turnos jugados').toBeGreaterThanOrEqual(3)
    const decisionsSaved = (await storedDays(page)).days[Object.keys((await storedDays(page)).days)[0]].battle?.decisions.length
    expect(decisionsSaved, 'las tres decisiones están guardadas').toBe(3)

    await page.reload()
    await today.challengeNumber.waitFor()
    await expect(today.fightButton, 'tras recargar, Reanudar').toHaveText(/Reanudar/)
    await expect(today.fightButton).toBeEnabled()
    await today.fightButton.click()
    await battle.waitForActionOrResult()

    const phases = await page.evaluate(() => (window as unknown as { __phases: string[] }).__phases)
    expect(phases.filter((phase) => phase !== 'done'), 'no se repite la intro').toEqual([])
    await expect(page.getByTestId('battle-mode')).toHaveText('OFICIAL')
    expect(await snapshot(page, battle), 'mismo estado y mismo registro').toEqual(before)
    expect((await storedDays(page)).days[Object.keys((await storedDays(page)).days)[0]].battle?.decisions.length, 'reanudar no duplica decisiones').toBe(3)

    await battle.decide()
    await battle.waitForActionOrResult()
    expect((await battle.logLines()).filter((line) => /^Turno/.test(line)).length, 'se sigue jugando').toBeGreaterThan(before.log.filter((line) => /^Turno/.test(line)).length)
  })

  test('E2E-53 salir y volver a Hoy ofrece Reanudar, sin pedir inicial, y retoma el mismo combate', async ({ page }) => {
    const { battle, today } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    await battle.decide()
    await battle.waitForActionOrResult()
    const before = await snapshot(page, battle)
    await battle.exitButton.click()
    await expect(page.getByRole('dialog')).toContainText('podrás reanudarlo desde Hoy')
    await page.getByRole('button', { name: 'Sí, salir' }).click()
    await expect(today.fightButton).toHaveText(/Reanudar/)
    await expect(today.fightButton, 'no hace falta elegir inicial para reanudar').toBeEnabled()
    await today.fightButton.click()
    await battle.waitForActionOrResult()
    expect(await snapshot(page, battle)).toEqual(before)
  })
})

test.describe('Combate oficial: un intento por día', () => {
  test('E2E-54 rendirse es derrota; el oficial queda deshabilitado con el resultado, también tras recargar; la práctica no cambia nada', async ({ page }) => {
    const { battle, today } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    await forfeit(page, battle)
    await expect(page.getByText(/Combate oficial registrado/)).toBeVisible()
    await page.getByRole('button', { name: 'Volver a Hoy' }).click()

    await expect(today.fightButton).toBeDisabled()
    await expect(today.officialStatus).toHaveText(/^Derrota · \d+ turnos? · \d\/6 en pie$/)
    const resultText = await today.officialStatus.textContent()
    const saved = await storedDays(page)
    expect(Object.values(saved.days).map((day) => day.status), 'un día, perdido').toEqual(['lost'])

    await page.reload()
    await today.challengeNumber.waitFor()
    await expect(today.fightButton, 'recargar no devuelve el intento').toBeDisabled()
    await expect(today.officialStatus).toHaveText(resultText as string)

    await today.chooseLead(1)
    await today.practiceButton.click()
    await expect(page.getByTestId('battle-mode')).toHaveText('PRÁCTICA')
    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    await page.reload()
    await today.challengeNumber.waitFor()
    await expect(today.fightButton, 'una práctica no se guarda: sigue el resultado del oficial').toBeDisabled()
    await expect(today.officialStatus).toHaveText(resultText as string)
    await today.chooseLead(1)
    await today.practiceButton.click()
    await battle.waitForActionOrResult()
    await forfeit(page, battle)
    await page.getByRole('button', { name: 'Volver a Hoy' }).click()
    expect(await storedDays(page), 'las prácticas no tocan lo guardado').toEqual(saved)
  })

  test('E2E-60 tras el oficial: estadísticas actualizadas y Copiar copia el texto sin spoilers; Estadísticas también desde Hoy @smoke', async ({ page, context, browserName }) => {
    const { battle, today } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    await forfeit(page, battle)
    await expect(page.getByTestId('stats-played')).toHaveText('1')
    await expect(page.getByTestId('stats-win-percent')).toHaveText('0')
    await expect(page.getByTestId('stats-day-streak')).toHaveText('1')
    // Copia al portapapeles (permiso solo concedible en Chromium).
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.getByRole('button', { name: 'Copiar' }).click()
      await expect(page.getByRole('status').filter({ hasText: /copiado/i })).toBeVisible()
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      expect(copied).toMatch(/^Daily PWT #\d+\n❌ Derrota \(\d\/6 rivales debilitados\)\n[🟩🟥]{6}\n🔥 Racha: 0\nhttps:\/\/quimikuaxh\.github\.io\/daily-pwt\/$/u)
      expect(copied, 'sin el nombre del rival').not.toMatch(new RegExp(DEFAULT_SCENARIO.trainer, 'i'))
    }
    await page.getByRole('button', { name: 'Volver a Hoy' }).click()
    await today.challengeNumber.waitFor()
    await page.getByRole('button', { name: 'Estadísticas' }).click()
    await expect(page.getByRole('dialog', { name: 'Estadísticas' })).toBeVisible()
    await expect(page.getByTestId('stats-played')).toHaveText('1')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('E2E-55 una práctica antes del oficial no lo gasta ni se reanuda al recargar', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(DEFAULT_SCENARIO, 'seed=a&ai=trivial')
    await today.chooseLead(0)
    await today.practiceButton.click()
    const battle = new BattlePage(page)
    await battle.waitForActionOrResult()
    expect(await storedDays(page)).toEqual({ version: 1, days: {} })
    await page.reload()
    await today.challengeNumber.waitFor()
    await expect(today.officialStatus).toHaveText('Jugar')
    await today.chooseLead(0)
    await expect(today.fightButton).toBeEnabled()
  })

  test('E2E-56 RF-80b: un oficial a medias a medianoche es derrota del día N; vuelve a Hoy con el aviso y el reto nuevo con su oficial libre @timing', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-10T23:59:30+01:00') })
    const today = new TodayPage(page)
    const battle = new BattlePage(page)
    await page.goto('./?trainer=plubio&seed=a&ai=trivial')
    await today.challengeNumber.waitFor()
    const numberBefore = Number((await today.challengeNumber.textContent())?.replace('#', ''))
    await expect(async () => {
      if ((await today.leadButtons.nth(0).getAttribute('aria-pressed')) !== 'true') await today.chooseLead(0)
      await expect(today.leadButtons.nth(0)).toHaveAttribute('aria-pressed', 'true', { timeout: 2000 })
    }).toPass({ timeout: 15_000 })
    await expect(async () => {
      if (await today.fightButton.isVisible()) await today.fightButton.click()
      await expect(battle.root).toBeVisible({ timeout: 2000 })
    }).toPass({ timeout: 15_000 })

    await page.clock.runFor(40_000)
    await expect(battle.root, 'sale del combate').toBeHidden()
    await expect(page.getByRole('alert')).toContainText('se quedó sin terminar a medianoche: cuenta como derrota')
    const days = (await storedDays(page)).days
    expect(Object.keys(days), 'cuenta para el día en que empezó').toEqual(['2026-11-10'])
    expect(Object.values(days)[0]).toMatchObject({ status: 'lost', endReason: 'expired' })
    await expect(today.challengeNumber, 'Hoy muestra el reto nuevo').toHaveText(`#${numberBefore + 1}`)
    await expect(today.officialStatus, 'el oficial del día nuevo está libre').toHaveText('Jugar')
    await expect(page.getByRole('button', { name: /Reanudar/ })).toHaveCount(0)
  })
})

test.describe('Combate oficial: datos que fallan', () => {
  test('E2E-57 sin almacenamiento (bloqueado) el sitio funciona, avisa de que no se guarda y gasta el oficial en memoria', async ({ page }) => {
    const problems = collectProblems(page)
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('bloqueado', 'SecurityError') } })
    })
    const { battle, today } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    await forfeit(page, battle)
    await page.getByRole('button', { name: 'Volver a Hoy' }).click()
    await expect(page.getByText(/no deja guardar datos/)).toBeVisible()
    await expect(today.fightButton).toBeDisabled()
    expect(problems, 'consola limpia').toEqual([])
  })

  test('E2E-58 un combate guardado que no se puede reanudar (datos distintos) avisa en español, anula el oficial y no da otro intento', async ({ page }) => {
    await page.addInitScript(({ key, date }) => {
      if (localStorage.getItem(key) !== null) return
      const record = { date, challengeNumber: 1, trainerId: 'plubio', variantId: 'variante-que-ya-no-existe', dataVersion: 'version-antigua', status: 'inProgress', startedAt: new Date().toISOString(), finishedAt: null, turns: null, survivors: null, rivalFainted: null, endReason: null, voidReason: null, battle: { seed: 'a', ai: 'trivial', leadIndex: 0, decisions: [{ type: 'move', slot: 1 }], checkpoint: null } }
      localStorage.setItem(key, JSON.stringify({ version: 1, days: { [date]: record } }))
    }, { key: STORAGE_KEY, date: DEFAULT_SCENARIO.date })
    const today = new TodayPage(page)
    await today.goto(DEFAULT_SCENARIO, 'seed=a&ai=trivial')
    await expect(today.fightButton).toHaveText(/Reanudar/)
    await today.fightButton.click()
    await expect(page.getByRole('alert')).toContainText('No se ha podido reanudar tu combate oficial')
    await expect(today.fightButton).toBeDisabled()
    await expect(today.officialStatus).toHaveText(/Anulado/)
    await page.reload()
    await today.challengeNumber.waitFor()
    await expect(today.fightButton, 'tampoco tras recargar').toBeDisabled()
    expect(Object.values((await storedDays(page)).days)[0].status).toBe('void')
    await today.chooseLead(0)
    await expect(today.practiceButton, 'la práctica sigue disponible').toBeEnabled()
  })

  test('E2E-59 un JSON corrupto en el almacenamiento no rompe Hoy: empieza limpio', async ({ page }) => {
    await page.addInitScript((key) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, '{esto no es json') }, STORAGE_KEY)
    const problems = collectProblems(page)
    const today = new TodayPage(page)
    await today.goto(DEFAULT_SCENARIO, 'seed=a&ai=trivial')
    await expect(today.officialStatus).toHaveText('Jugar')
    expect(problems).toEqual([])
  })
})
