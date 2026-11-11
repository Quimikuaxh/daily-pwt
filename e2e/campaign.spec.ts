import { expect, test } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'

test('T3 Hoy → Modos → Ruta → cuatro elecciones de Petra → Ruta → Hoy', async ({ page }) => {
  const today = new TodayPage(page)
  await today.goto()
  await page.getByRole('button', { name: 'Modos de juego' }).click()
  await expect(page.getByRole('button', { name: /Reto diario/ })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Nuzlocke de Hoenn' }).click()
  await page.getByRole('button', { name: 'Empezar campaña', exact: true }).click()
  const petra = page.getByRole('region', { name: 'Ficha de Petra' })
  await expect(petra).toContainText('LÍDER PETRA')
  await expect(page.getByRole('list', { name: 'Medallas: 0 de 8' })).toBeVisible()
  await page.getByRole('button', { name: /^Continuar/ }).click()
  for (let pick = 1; pick <= 4; pick++) {
    const candidates = page.getByRole('button', { name: /^Candidato/ })
    await expect(candidates).toHaveCount(4)
    await candidates.nth(1).click()
    await expect(candidates.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('region', { name: /^Datos de/ })).toContainText(`Elección ${pick} de 4`)
    await page.getByRole('button', { name: 'Datos: ver estadísticas' }).click()
    await expect(page.getByRole('button', { name: 'Datos: ver información' })).toBeVisible()
    await page.getByRole('button', { name: /^Reclutar a/ }).click()
  }
  await expect(petra).toContainText('LÍDER PETRA')
  await expect(page.getByRole('button', { name: /^Candidato/ })).toHaveCount(0)
  // Cambio de requisito (D7, 11/11/2026): en preparación, Continuar abre Equipo y PC; ACEPTAR vuelve a la Ruta.
  await page.getByRole('button', { name: /^Continuar/ }).click()
  await page.getByRole('button', { name: /^Equipo, puesto 1: / }).click()
  await page.getByRole('menuitem', { name: /^Movimientos de / }).click()
  await expect(page.getByRole('region', { name: 'Movimientos' })).toBeVisible()
  // SALIR es la última fila de la lista: con más de cinco movimientos hay que bajar, como en el juego.
  const down = page.getByRole('button', { name: 'Desplazar movimientos hacia abajo' })
  while (!(await page.getByRole('button', { name: 'Volver al equipo' }).count()) && await down.count()) await down.click()
  await page.getByRole('button', { name: 'Volver al equipo' }).click()
  // ACEPTAR empieza el combate (T4); CANCELAR vuelve a la Ruta sin combatir.
  await page.getByRole('button', { name: 'Cancelar y volver a la ruta' }).click()
  await expect(petra).toContainText('LÍDER PETRA')
  // La preparación y las cuatro elecciones sobreviven a la recarga.
  await page.reload()
  await today.challengeNumber.waitFor()
  await page.getByRole('button', { name: 'Modos de juego' }).click()
  await page.getByRole('button', { name: 'Nuzlocke de Hoenn' }).click()
  await expect(page.getByRole('button', { name: /^Continuar/ })).toBeEnabled()
  await page.getByRole('button', { name: 'Volver a Hoy' }).click()
  await expect(today.challengeNumber).toBeVisible()
  await expect(today.fightButton).toBeVisible()
})

/** Juega el combate de campaña hasta volver a la Ruta: continúa mensajes, ataca con el primer movimiento disponible y cambia si hay KO. */
async function playCampaignBattle(page: import('@playwright/test').Page, { reloadAt }: { reloadAt?: number } = {}) {
  const battle = page.locator('.emerald-battle')
  await expect(battle).toBeVisible()
  for (let step = 0; step < 600; step++) {
    if (!(await battle.count())) return
    if (step === reloadAt) {
      await page.reload()
      await page.getByRole('button', { name: 'Modos de juego' }).click()
      await page.getByRole('button', { name: 'Nuzlocke de Hoenn' }).click()
      await expect(page.locator('.emerald-battle')).toBeVisible()
    }
    const yes = battle.getByRole('button', { name: 'Sí, cambiar de POKéMON' })
    const next = battle.getByRole('button', { name: /^Continuar: / })
    const fight = battle.getByRole('button', { name: 'LUCHAR' })
    // Los mensajes avanzan solos: un botón visto puede desaparecer antes del clic, así que cada clic espera poco y el bucle sigue.
    const tap = (target: import('@playwright/test').Locator) => target.click({ timeout: 1500 }).catch(() => undefined)
    if (await yes.count()) await tap(yes)
    else if (await next.count()) await tap(next)
    else if (await fight.count()) {
      await tap(fight)
      await tap(battle.locator('.battle-option:not([disabled])').first())
    } else {
      const members = battle.locator('.battle-party .team-cell:not([disabled])')
      for (let i = 0; i < await members.count(); i++) {
        const label = await members.nth(i).getAttribute('aria-label') ?? ''
        if (!/KO|activo|vacío/.test(label)) { await tap(members.nth(i)); break }
      }
      await page.waitForTimeout(100)
    }
  }
  throw new Error('El combate de campaña no terminó')
}

test('T4 combate de campaña contra Petra con el motor: se reanuda tras recargar y al acabar vuelve a la Ruta con la campaña guardada', async ({ page }) => {
  test.setTimeout(400_000)
  const today = new TodayPage(page)
  await today.goto()
  await page.getByRole('button', { name: 'Modos de juego' }).click()
  await page.getByRole('button', { name: 'Nuzlocke de Hoenn' }).click()
  await page.getByRole('button', { name: 'Empezar campaña', exact: true }).click()
  await page.getByRole('button', { name: /^Continuar/ }).click()
  for (let pick = 1; pick <= 4; pick++) {
    await page.getByRole('button', { name: /^Candidato/ }).first().click()
    await page.getByRole('button', { name: /^Reclutar a/ }).click()
  }
  await page.getByRole('button', { name: /^Continuar/ }).click()
  await page.getByRole('button', { name: 'Aceptar el equipo y preparar los movimientos' }).click()
  await expect(page.getByRole('status').filter({ hasText: /petra/i })).toBeVisible()
  await playCampaignBattle(page, { reloadAt: 6 })
  // Resultado (medalla y Ficha, o derrota): se toca hasta volver a la Ruta.
  await expect(page.locator('.result-screen')).toBeVisible()
  while (await page.locator('.result-continue').count()) await page.locator('.result-continue').click()
  await expect(page.getByRole('heading', { name: 'Ruta' })).toBeAttached()
  await expect(page.getByRole('button', { name: /^CIUDAD FÉRRICA, gimnasio 1, (superado|próximo)$/ })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('daily-pwt:nuzlocke:v1') ?? 'null'))
  expect(saved.battle).toBeNull()
  expect(['draft', 'lost']).toContain(saved.state.phase)
})
