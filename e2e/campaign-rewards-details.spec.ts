import { expect, test, type Page } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'

test.use({ hasTouch: true, viewport: { width: 360, height: 740 } })

async function seedCampaign(page: Page, mode: 'Hoenn' | 'Teselia', pendingRewards = false) {
  const member = { id: 'eevee', species: 'eevee', level: 30, history: [], fainted: false, victories: 3, gender: 'F',
    moves: ['tackle', 'tailwhip', 'sandattack', 'quickattack'] }
  const state = { campaign: mode === 'Hoenn' ? 'hoenn-emerald' : 'unova-n2b2', seed: 'e2e-nuevos-objetos',
    encounterIndex: mode === 'Hoenn' ? 1 : 3, phase: pendingRewards ? 'draft' : 'prepare', pick: 3,
    offer: [], previousOffer: [], leagueRoster: null, battleTeam: [], battlePoints: 60, members: [member],
    ...(pendingRewards ? { pendingRewards: true } : {}) }
  await page.addInitScript((record) => {
    if (!localStorage.getItem('daily-pwt:nuzlocke:v1')) localStorage.setItem('daily-pwt:nuzlocke:v1', JSON.stringify(record))
  }, { version: 1, revision: 1, state, battle: null })
}

async function openCampaign(page: Page, mode: 'Hoenn' | 'Teselia') {
  await new TodayPage(page).goto()
  await page.getByRole('button', { name: 'Modos de juego' }).tap()
  await page.getByRole('button', { name: `Nuzlocke de ${mode}` }).tap()
}

for (const mode of ['Hoenn', 'Teselia'] as const) {
  test(`${mode}: los objetos y MT nuevos esperan a que se confirme el aviso`, async ({ page }) => {
    await seedCampaign(page, mode, true)
    await openCampaign(page, mode)
    const notice = page.getByRole('dialog', { name: 'Has conseguido' })
    await expect(notice).toBeVisible()
    await expect(notice.getByRole('heading', { name: 'Objetos', exact: true })).toBeVisible()
    await expect(notice.getByText(mode === 'Hoenn' ? /^MT39 / : /^MT76 /)).toBeAttached()
    await openCampaign(page, mode)
    await expect(notice).toBeVisible()
    await notice.getByRole('button', { name: 'Continuar', exact: true }).tap()
    await expect(notice).toHaveCount(0)
    await openCampaign(page, mode)
    await expect(page.getByRole('button', { name: /^Continuar/ })).toBeVisible()
    await expect(notice).toHaveCount(0)
  })
}

test('Teselia: Información enumera las evoluciones y las flechas recorren Mochila y Canje', async ({ page }) => {
  await seedCampaign(page, 'Teselia')
  await openCampaign(page, 'Teselia')
  await page.getByRole('button', { name: /^Continuar/ }).tap()
  await page.getByRole('button', { name: 'Página anterior', exact: true }).tap()
  const evolution = page.getByRole('region', { name: 'Evolución', exact: true })
  await expect(evolution).toBeVisible()
  await expect(evolution.getByText('Piedra Agua', { exact: true })).toBeVisible()
  await expect(evolution.locator('dt')).toHaveCount(7)

  await page.getByRole('button', { name: /^Equipo, puesto 1: Eevee/i }).tap()
  await page.getByRole('menuitem', { name: /^Objeto de Eevee/i }).tap()
  // El bolsillo de objetos equipables también necesita flechas.
  const itemPocket = page.getByRole('button', { name: /Bolsillo siguiente: OBJ/ })
  const down = page.getByRole('button', { name: 'Desplazar la lista hacia abajo' })
  const up = page.getByRole('button', { name: 'Desplazar la lista hacia arriba' })
  const scrollAndReturn = async (attribute: string) => {
    const first = page.locator(`[${attribute}]`).first()
    await expect(up).toBeDisabled()
    await down.tap()
    await expect(first).toHaveAttribute(attribute, '1')
    await up.tap()
    await expect(first).toHaveAttribute(attribute, '0')
  }
  await scrollAndReturn('data-bag-row')
  await itemPocket.tap()
  await page.getByRole('button', { name: /Bolsillo siguiente: MT/ }).tap()
  await scrollAndReturn('data-bag-row')
  await openCampaign(page, 'Teselia')
  await page.getByRole('button', { name: /^Tienda: canjea/ }).tap()
  await scrollAndReturn('data-exchange-row')
})
