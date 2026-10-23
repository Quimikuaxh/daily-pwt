import { test, expect } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'
import { startBattle } from './support'

// F3 · Sonido (DEC-57, RF-87..RF-92).
test.describe('Sonido', () => {
  test('E2E-68 Ajustes: silenciar y el volumen (deslizador, en %) se guardan al recargar', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto()
    await page.getByRole('button', { name: 'Ajustes' }).click()
    await expect(page.getByRole('button', { name: 'Activado' })).toHaveAttribute('aria-pressed', 'true')
    const slider = page.getByRole('slider', { name: 'Volumen' })
    await expect(slider).toHaveAttribute('aria-valuetext', '70 %')
    await page.getByRole('button', { name: 'Silenciado' }).click()
    await slider.focus()
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowLeft')
    await expect(slider).toHaveAttribute('aria-valuetext', '40 %')
    await page.reload()
    await today.challengeNumber.waitFor()
    await page.getByRole('button', { name: 'Ajustes' }).click()
    await expect(page.getByRole('button', { name: 'Silenciado' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('slider', { name: 'Volumen' })).toHaveAttribute('aria-valuetext', '40 %')
  })

  test('E2E-69 sin tocar la página no se descarga audio ni hay errores; el combate pide solo la pista de su rival y los 6 efectos', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    const audio: string[] = []
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname
      if (path.includes('/audio/')) audio.push(path)
    })
    const today = new TodayPage(page)
    await today.goto()
    await page.waitForTimeout(1500)
    expect(audio, 'Hoy no pide audio').toEqual([])
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    const music = audio.filter((path) => path.includes('/audio/music/'))
    expect(music).toHaveLength(1)
    expect(music[0]).toMatch(/\/audio\/music\/(gym|champion)-(kanto|johto|hoenn|sinnoh|unova)\.m4a$/)
    expect(new Set(audio.filter((path) => path.includes('/audio/sfx/'))).size).toBe(6)
    expect(errors).toEqual([])
  })
})
