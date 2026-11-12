import { readFile } from 'node:fs/promises'
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
    // Cambio de requisito (12/11/2026): tres páginas; tras ESTADÍSTICAS, DATOS lleva a MOVIMIENTOS.
    await expect(page.getByRole('button', { name: 'Datos: ver movimientos' })).toBeVisible()
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
  await page.getByRole('button', { name: 'Volver al equipo', exact: true }).click()
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
      // Espera a la lista de movimientos antes de elegir: con prisa, el clic caía otra vez en LUCHAR.
      await battle.getByRole('button', { name: / de \d+ PP$/ }).first().waitFor({ timeout: 1500 }).catch(() => undefined)
      await tap(battle.locator('.battle-option:not([disabled])').first())
    } else if (await battle.getByRole('button', { name: / de \d+ PP$/ }).count()) {
      // En la lista de movimientos (el clic anterior pudo caer en LUCHAR antes de que se pintara): el primero con PP. Sin esto, en
      // WebKit, más lento, el combate se quedaba en esa lista hasta el tiempo límite.
      const moves = battle.getByRole('button', { name: / de \d+ PP$/ })
      for (let i = 0; i < await moves.count(); i++) if (await moves.nth(i).isEnabled()) { await tap(moves.nth(i)); break }
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
  // Cambio de requisito (Jose, 12/11/2026): si se pierde la campaña, antes de la Ruta va la pantalla final para compartir, que descarga
  // la imagen de las dos pantallas (720 × 960).
  if (await page.locator('.share-screen').count()) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Guardar la imagen del resultado' }).click()])
    expect(download.suggestedFilename()).toMatch(/^nuzlocke-hoenn-\d{4}-\d{2}-\d{2}\.png$/)
    const png = await readFile(await download.path())
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([720, 960])
    await page.getByRole('button', { name: 'Volver a la ruta' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Ruta' })).toBeAttached()
  await expect(page.getByRole('button', { name: /^CIUDAD FÉRRICA, gimnasio 1, (superado|próximo)$/ })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('daily-pwt:nuzlocke:v1') ?? 'null'))
  expect(saved.battle).toBeNull()
  expect(['draft', 'lost']).toContain(saved.state.phase)
})

test('T5 Liga: evoluciones, los seis del PC, elección de participantes y combate contra Sixto con la plantilla fijada', async ({ page }) => {
  const member = (id: string, species: string, level: number, extra = {}) => ({ id, species, level, history: [], fainted: false, victories: 3, ...extra })
  const state = { seed: 'e2e-liga', encounterIndex: 8, phase: 'prepare', pick: 3, offer: [], previousOffer: [], leagueRoster: null, battleTeam: [],
    members: [member('a', 'kirlia', 45), member('b', 'grovyle', 45), member('c', 'machop', 45), member('d', 'ralts', 30, { fainted: true })] }
  await page.addInitScript((record) => { if (!localStorage.getItem('e2e-sembrado')) { localStorage.setItem('daily-pwt:nuzlocke:v1', JSON.stringify(record)); localStorage.setItem('e2e-sembrado', '1') } },
    { version: 1, revision: 1, state, battle: null })
  const today = new TodayPage(page)
  await today.goto()
  await page.getByRole('button', { name: 'Modos de juego' }).click()
  await page.getByRole('button', { name: 'Nuzlocke de Hoenn' }).click()
  await page.getByRole('button', { name: /^Continuar/ }).click()
  // Kirlia, Grovyle y Machop evolucionan (sin objetos); el caído no.
  await expect(page.getByRole('status').filter({ hasText: '¿Qué? ¡KIRLIA está evolucionando!' })).toBeVisible()
  // Anuncio, animación (tocar la salta) y felicitación por cada uno, hasta llegar a Equipo y PC.
  const team = page.getByRole('button', { name: /^Equipo, puesto 1: GARDEVOIR/ })
  for (let i = 0; i < 20 && !(await team.count()); i++) await page.getByRole('button', { name: /^Continuar: / }).click({ timeout: 2000 }).catch(() => undefined)
  await expect(team).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar el equipo y preparar los movimientos' }).click()
  await expect(page.getByRole('region', { name: 'Próximo rival de la Liga: Sixto' })).toBeVisible()
  await page.getByRole('button', { name: /^SCEPTILE, nivel 45, APTO$/ }).click()
  await page.getByRole('button', { name: /^GARDEVOIR, nivel 45, APTO$/ }).click()
  await page.getByRole('button', { name: 'Aceptar participantes de la Liga' }).click()
  await expect(page.locator('.emerald-battle')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /SIXTO/ })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('daily-pwt:nuzlocke:v1') ?? 'null'))
  expect(saved.state.leagueRoster).toEqual(['b', 'a'])
  expect(saved.state.leagueEvolved).toBe(true)
  expect(saved.battle.source.preparation.leadId).toBe('b')
})
