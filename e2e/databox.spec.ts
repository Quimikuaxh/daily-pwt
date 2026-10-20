import { test, expect } from '@playwright/test'
import { D0, startBattle } from './support'

// Revisión de Jose: el relleno de PS queda dentro del recuadro de la barra en todos los niveles y en las dos cajas; el Pokémon del
// jugador se ve a 2x, a la izquierda y recortado por abajo. Se mide en el navegador real (en jsdom no hay maquetación).
const LEVELS = [['green', 50], ['green', 31], ['yellow', 24], ['yellow', 11], ['red', 9], ['red', 2]] as const

test.describe('Cajas de datos y sprites del combate', () => {
  test('E2E-23 el relleno de PS está alineado con el recuadro de la barra (verde, amarillo y rojo; rival y jugador)', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()
    for (const side of ['rival', 'player'] as const) {
      for (const [level, width] of LEVELS) {
        const geometry = await page.evaluate(
          async ([side, level, width]) => {
            const box = document.querySelector(`.bt-databox-${side}`) as HTMLElement
            box.style.setProperty('--fill', `${width}px`)
            const image = box.querySelector('.bt-databox-fill img') as HTMLImageElement
            image.src = `./ui/battle/hp/fill-${level}.png`
            await image.decode()
            await new Promise((resolve) => setTimeout(resolve, 900))
            const rect = (element: Element) => element.getBoundingClientRect()
            const scale = rect(box).width / box.offsetWidth
            const track = rect(box.querySelector('.bt-databox-track') as Element)
            const fill = rect(box.querySelector('.bt-databox-fill') as Element)
            const img = rect(image)
            return { scale, dx: (fill.left - track.left) / scale, dy: (fill.top - track.top) / scale, fillWidth: fill.width / scale, fillHeight: fill.height / scale, imgWidth: img.width / scale, imgHeight: img.height / scale, inside: fill.right <= track.right + 0.5 }
          },
          [side, level, width] as const,
        )
        const where = `${side} ${level} ${width}px`
        expect(geometry.dx, `${where}: mismo borde izquierdo`).toBeCloseTo(0, 1)
        expect(geometry.dy, `${where}: misma altura`).toBeCloseTo(0, 1)
        expect(geometry.fillHeight, `${where}: 5 px de alto`).toBeCloseTo(5, 1)
        expect(geometry.fillWidth, `${where}: ancho del relleno`).toBeCloseTo(width, 1)
        expect(geometry.imgWidth, `${where}: la imagen conserva sus 50 px (se recorta, no se encoge)`).toBeCloseTo(50, 1)
        expect(geometry.imgHeight, `${where}: la imagen conserva sus 5 px`).toBeCloseTo(5, 1)
        expect(geometry.inside, `${where}: dentro del recuadro`).toBe(true)
      }
    }
  })

  test('E2E-23 el Pokémon del jugador va a 2x, a la izquierda y solo pierde la parte baja bajo la caja de mensajes; el rival, a 1x', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()
    const geometry = await page.evaluate(() => {
      const field = (document.querySelector('[data-testid=field]') as Element).getBoundingClientRect()
      const unit = field.width / 256
      const measure = (selector: string) => {
        const image = document.querySelector(selector) as HTMLImageElement
        const rect = image.getBoundingClientRect()
        return { scale: rect.width / image.naturalWidth / unit, centerX: (rect.left + rect.width / 2 - field.left) / unit, bottom: (rect.bottom - field.top) / unit }
      }
      return { player: measure('.bt-mon-player img.bt-sprite'), rival: measure('.bt-mon-rival img.bt-sprite') }
    })
    expect(geometry.player.scale, 'jugador a 2x').toBeCloseTo(2, 1)
    expect(geometry.player.centerX, 'a la izquierda del centro').toBeLessThan(128)
    expect(geometry.player.bottom, 'los pies quedan bajo la caja de mensajes (y ≥ 147) sin salirse del lienzo').toBeGreaterThan(147)
    expect(geometry.player.bottom).toBeLessThanOrEqual(192.5)
    expect(geometry.rival.scale, 'rival a 1x').toBeCloseTo(1, 1)
    expect(geometry.rival.bottom, 'pies del rival sobre su plataforma').toBeCloseTo(97, 0)
  })
})
