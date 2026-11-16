import { expect, test } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'
import { startBattle } from './support'

test.use({ hasTouch: true, viewport: { width: 360, height: 740 } })

for (const mode of ['daily', 'Teselia', 'Hoenn']) {
  test(`${mode}: pulsar el objeto en Datos abre la ficha y pulsar fuera o Escape la cierra`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const hoenn = mode === 'Hoenn'
    if (mode === 'daily') {
      const { battle } = await startBattle(page, { tap: true })
      await battle.fightButton.waitFor()
    } else {
      const species = hoenn ? 'mudkip' : 'tepig'
      const member = { id: species, species, level: 13, moves: ['tackle', 'growl'], item: 'oranberry', history: [], fainted: false, victories: 0 }
      const state = { campaign: hoenn ? 'hoenn-emerald' : 'unova-n2b2', seed: 'e2e-objeto-datos', encounterIndex: 0, phase: 'prepare',
        pick: 4, offer: [], previousOffer: [], leagueRoster: null, battleTeam: [], members: [member] }
      await page.addInitScript((record) => {
        if (!localStorage.getItem('daily-pwt:nuzlocke:v1')) localStorage.setItem('daily-pwt:nuzlocke:v1', JSON.stringify(record))
      }, { version: 1, revision: 1, state, battle: null })
      await new TodayPage(page).goto()
      await page.getByRole('button', { name: 'Modos de juego' }).tap()
      await page.getByRole('button', { name: `Nuzlocke de ${mode}` }).tap()
      await page.getByRole('button', { name: /^Continuar/ }).tap()
      await page.getByRole('button', { name: 'Aceptar el equipo y preparar los movimientos' }).tap()
      if (!hoenn) {
        await page.locator('.bt-fight:enabled').waitFor()
        const reason = page.getByText('No hay ningún Pokémon disponible para cambiar.', { exact: true })
        await expect(reason).toHaveClass('sr-only')
      }
    }

    if (hoenn) {
      await page.locator('.battle-field img[src*="combate-caja-acciones"]').waitFor()
      await page.locator('.battle-party .team-cell:not([disabled])').first().tap()
      await page.getByRole('button', { name: 'Datos de MUDKIP', exact: true }).tap()
      await page.locator('.draft-summary > button.team-button').nth(1).tap()
    } else {
      await page.locator('.bt-pokemon').tap()
      await page.locator('.bt-party-panel[data-state="active"]').tap()
      await page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Datos', exact: true }).tap()
    }

    const item = page.locator('.summary-item-trigger')
    const tip = page.getByRole('tooltip')
    await expect(item).toHaveAccessibleName(mode === 'daily' ? /\S/ : /baya aranja/i)
    await item.tap()
    await expect(tip).toBeVisible()
    await expect(tip.locator('p')).not.toBeEmpty()
    if (hoenn) await expect(tip.locator('p')).toHaveText('Objeto que restaura 10 PS en combate.')
    await expect(item).toHaveAttribute('aria-describedby', /.+/)
    await page.keyboard.press('Escape')
    await expect(tip).toHaveCount(0)
    await expect(item).toBeVisible()

    await item.tap()
    await expect(tip).toBeVisible()
    const summary = page.locator(hoenn ? '.draft-summary' : '.bt-summary')
    const image = await summary.locator('img.mon-front, img.bt-sum-bg').first().boundingBox()
    expect(image).not.toBeNull()
    await page.touchscreen.tap(image!.x + 4, image!.y + 4)
    await expect(tip).toHaveCount(0)
  })
}
