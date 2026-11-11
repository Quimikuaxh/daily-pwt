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
  await page.getByRole('button', { name: 'Volver al equipo' }).click()
  await page.getByRole('button', { name: 'Aceptar el equipo y preparar los movimientos' }).click()
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
