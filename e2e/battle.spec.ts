import { test, expect } from '@playwright/test'
import { BattlePage } from './pages/BattlePage'
import { TodayPage } from './pages/TodayPage'
import { FORBIDDEN_IN_LOG, MISTY, REF_SCENARIOS, startBattle } from './support'

const SEEDS = ['a', 'b', 'c']

test.describe('Partida completa contra la IA trivial', () => {
  for (const scenario of REF_SCENARIOS) {
    for (const seed of SEEDS) {
      test(`E2E-05 ${scenario.trainer} semilla ${seed}: llega a Resultado con registro en español`, async ({ page }) => {
        // Hay partidas de 60 turnos con intro y mensajes uno a uno: con 4 trabajadores en paralelo superan los 120 s por defecto.
        test.setTimeout(240_000)
        const { battle } = await startBattle(page, { scenario, seed })
        await battle.maxSpeed()
        await battle.playToResult()

        const outcome = await battle.outcome()
        expect(['Victoria', 'Derrota'], 'título de resultado').toContain(outcome.title)
        expect(outcome.stats[0], 'turnos').toMatch(/^Turnos: \d+$/)
        expect(outcome.stats[1], 'en pie').toMatch(/^Pokémon en pie: [0-6]$/)
        await expect(page.getByRole('button', { name: 'Volver a Hoy' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Otro combate' })).toBeVisible()
      })
    }
  }

  test('E2E-05 el registro es español, sin ids ni inglés @smoke', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    // Se lee el registro durante el combate (el Resultado lo desmonta): se juega hasta que haya varios turnos.
    let lines: string[] = []
    for (let i = 0; i < 6; i += 1) {
      if ((await battle.decide()) === 'result') break
      lines = await battle.logLines()
    }
    expect(lines.length, 'hay registro').toBeGreaterThan(5)
    expect(lines[0], 'primera frase = desafío del rival').toMatch(/^¡(La Líder|El Líder|El Campeón|La Campeona) .+ te desafía!$/)
    for (const line of lines) expect(line, `línea sin inglés ni protocolo: ${line}`).not.toMatch(FORBIDDEN_IN_LOG)
    expect(lines.join(' '), 'usa los verbos españoles').toMatch(/usó/)
  })

  test('E2E-05 misma semilla y mismas decisiones: mismo resultado y registro', async ({ page }) => {
    // Dos partidas completas con intro y mensajes uno a uno; en webkit no caben en los 120 s por defecto.
    test.setTimeout(300_000)
    // Las dos partidas son prácticas: el oficial solo se juega una vez por día (DEC-43) y el test trata del motor, no del guardado.
    const runs: { lines: string[]; outcome: unknown }[] = []
    for (let run = 0; run < 2; run += 1) {
      const { battle } = await startBattle(page, { seed: 'repeat', mode: 'practice' })
      await battle.maxSpeed()
      const lines: string[] = []
      for (;;) {
        const state = await battle.waitForActionOrResult()
        if (state === 'result') break
        lines.splice(0, lines.length, ...(await battle.logLines()))
        if (state === 'moves') await battle.chooseFirstMove()
        else await battle.chooseSubstitute()
        await page.waitForTimeout(50)
      }
      runs.push({ lines, outcome: await battle.outcome() })
    }
    expect(runs[1].outcome, 'mismo resultado').toEqual(runs[0].outcome)
    expect(runs[1].lines, 'mismo registro').toEqual(runs[0].lines)
  })
})

test.describe('Combate', () => {
  test('E2E-06 cambio voluntario y cambio forzado tras un KO', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()

    // Voluntario: Cambiar abre la lista, se elige un sustituto y el rival sigue el turno.
    expect(await battle.waitForActionOrResult()).toBe('moves')
    const leadName = await page.getByTestId('player-hp').locator('.bt-databox-name').textContent()
    await battle.switchButton.click()
    await expect(battle.page.getByText('Elige un Pokémon.'), 'pantalla de equipo').toBeVisible()
    await expect(battle.switchOptions, 'los 6 Pokémon').toHaveCount(6)
    await page.locator('.bt-party-panel[data-state="active"]').click()
    await expect(page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Cambiar', exact: true }), 'el activo no es elegible').toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape')
    await battle.chooseSubstitute()
    await expect(page.getByTestId('player-hp').locator('.bt-databox-name'), 'entra otro Pokémon').not.toHaveText(leadName ?? '', { timeout: 30_000 })
    expect((await battle.logLines()).join('\n'), 'el registro cuenta el cambio').toMatch(/¡Adelante, .+!/)

    // Forzado: se juega con el primer movimiento hasta que un Pokémon propio se debilita.
    const forcedTitle = page.getByText('Elige el siguiente Pokémon.')
    for (let guard = 0; guard < 60; guard += 1) {
      const state = await battle.waitForActionOrResult()
      expect(state, 'debe haber un cambio forzado antes del resultado').not.toBe('result')
      if (await forcedTitle.isVisible()) break
      if (state === 'moves') await battle.chooseFirstMove()
      else await battle.chooseSubstitute()
      await page.waitForTimeout(50)
    }
    await expect(forcedTitle).toBeVisible()
    await expect(page.getByRole('button', { name: 'Volver' }), 'sin cancelar en cambio forzado').toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Movimientos' }), 'sin movimientos en cambio forzado').toHaveCount(0)
    await battle.page.locator('.bt-party-panel[data-state="fainted"]').first().click()
    await expect(page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Cambiar', exact: true }), 'los debilitados no son elegibles').toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Datos' }), 'Datos sí está disponible').toBeVisible()
    await expect(page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Cancelar' }), 'sin cancelar').toHaveCount(0)
    await page.keyboard.press('Escape')
    await battle.chooseSubstitute()
    expect(await battle.waitForActionOrResult(), 'el combate continúa').toBe('moves')
  })

  test('E2E-07 Rendirse: cancelar no cambia nada; confirmar es derrota; Volver a Hoy y Otro combate', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    const introFirst = (await battle.logLines())[0]
    const linesBefore = await battle.logLines()

    await battle.forfeitButton.click()
    const dialog = page.getByRole('dialog', { name: '¿Quieres rendirte?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancelar' }), 'foco dentro del diálogo').toBeFocused()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(battle.forfeitButton, 'el foco vuelve a Rendirse').toBeFocused()
    expect(await battle.logLines(), 'cancelar no cambia nada').toEqual(linesBefore)
    await expect(battle.fightButton, 'tras cancelar se sigue pudiendo luchar').toBeEnabled()

    await battle.forfeitButton.click()
    await page.getByRole('button', { name: 'Sí, rendirme' }).click()
    await expect(battle.resultTitle).toHaveText('Derrota')
    await expect(page.getByText('Te has rendido.')).toBeVisible()
    await expect(page.getByText(/^Rivales debilitados: \d\/6$/)).toBeVisible()

    await page.getByRole('button', { name: 'Otro combate' }).click()
    await battle.root.waitFor()
    await battle.waitForActionOrResult()
    expect((await battle.logLines())[0], 'mismo reto: mismo desafío').toBe(introFirst)

    await battle.forfeitButton.click()
    await page.getByRole('button', { name: 'Sí, rendirme' }).click()
    await page.getByRole('button', { name: 'Volver a Hoy' }).click()
    await expect(new TodayPage(page).challengeNumber).toHaveText('#1')
  })

  test('E2E-08 Salir del combate pide confirmación; el oficial queda para reanudar y la práctica se descarta', async ({ page }) => {
    const { battle, today } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    await battle.waitForActionOrResult()

    await battle.exitButton.click()
    const dialog = page.getByRole('dialog', { name: '¿Salir del combate?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(battle.root, 'cancelar mantiene el combate').toBeVisible()
    await expect(battle.exitButton).toBeFocused()

    await battle.exitButton.click()
    await page.getByRole('button', { name: 'Sí, salir' }).click()
    await expect(today.challengeNumber).toBeVisible()
    await expect(battle.root).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: /Victoria|Derrota/ }), 'salir no genera resultado').toHaveCount(0)
    await expect(today.fightButton, 'salir no gasta otro intento: el oficial se puede reanudar').toHaveText(/Reanudar/)
    await expect(today.practiceButton, 'Hoy vuelve sin inicial elegido').toBeDisabled()

    await today.chooseLead(0)
    await today.practiceButton.click()
    await battle.waitForActionOrResult()
    expect((await battle.logLines()).filter((l) => /^Turno/.test(l)), 'combate nuevo desde el turno 1').toEqual(['Turno 1'])
  })

  test('E2E-18 la táctil queda en espera durante animación y turno rival (sin botones); cinco clics = una decisión; «Turno N» no sale en pantalla', async ({ page }) => {
    // Misty: el primer turno no debilita a nadie; contra Plubio (escenario por defecto) hay cambio forzado y no habría «Turno 2».
    const { battle } = await startBattle(page, { scenario: MISTY, seed: 'a' })
    await battle.waitForActionOrResult()
    expect((await battle.logLines()).filter((l) => /^Turno \d+$/.test(l))).toEqual(['Turno 1'])

    // Cinco clics en el mismo task: solo el primero cuenta.
    await battle.fightButton.click()
    await battle.enabledMoves.first().evaluate((button) => { for (let i = 0; i < 5; i += 1) (button as HTMLButtonElement).click() })
    await expect(battle.moves, 'sin menú de movimientos al elegir').toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Luchar|Rendirse|Ver el equipo rival|Cambiar)$/ }), 'táctil en espera: sin botones').toHaveCount(0)
    await expect(page.getByTestId('field').getByRole('status'), 'el mensaje en pantalla no es «Turno N»').not.toHaveText(/^Turno \d+$/)

    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    expect((await battle.logLines()).filter((l) => /^Turno \d+$/.test(l)), 'un solo turno procesado').toEqual(['Turno 1', 'Turno 2'])
  })

  // Cambio de requisito (22/10/2026): el hueco de la Mochila es RIVAL y abre el equipo rival solo para consultarlo.
  test('E2E-23 RIVAL abre el equipo del rival: 6 placas con PS en %, Datos sí, Cambiar no, y Datos enseña solo los PP máximos', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await page.getByRole('button', { name: 'Ver el equipo rival' }).click()
    const team = page.getByRole('region', { name: 'Equipo rival' })
    await expect(team.locator('.bt-party-panel')).toHaveCount(6)
    await expect(team.locator('.bt-party-hp').first()).toHaveText(/^\d+ %$/)
    await team.locator('.bt-party-panel').nth(1).click()
    const options = page.getByRole('group', { name: /Qué hacer con/ })
    await expect(options.getByRole('button', { name: 'Cambiar', exact: true })).toHaveCount(0)
    await options.getByRole('button', { name: 'Datos' }).click()
    await page.locator('.bt-summary:not([data-loading])').waitFor()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.bt-sum-slot-pp-value').first()).toHaveText(/^\d+$/)
    // Escape: de Movimientos a Habilidades, cierra Datos y cierra el equipo rival.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('.bt-summary')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(team).toHaveCount(0)
    await expect(battle.fightButton).toBeEnabled()
  })

  test('E2E-24 el sprite del jugador asoma sobre la caja de mensajes (no queda tapado)', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    const sprite = await page.locator('.bt-mon-player .bt-sprite').boundingBox()
    const message = await page.locator('.bt-message').boundingBox()
    expect(sprite && message).toBeTruthy()
    const visibleAboveBox = (message!.y - sprite!.y) / sprite!.height
    expect(visibleAboveBox, 'al menos el 60 % del sprite sobre la caja').toBeGreaterThan(0.6)
  })

  test('E2E-20 resultado mínimo: el combate jugado pinta su Resultado y la rendición da Derrota', async ({ page }) => {
    // Con el primer movimiento siempre el desenlace depende del equipo del jugador, que sale del pool (cambia con el pool y con la fecha
    // literal del escenario): se acepta victoria o derrota y se comprueba que cada una pinta su Resultado. La derrota se fuerza rindiéndose.
    const { battle } = await startBattle(page, { scenario: MISTY, seed: 'a' })
    await battle.maxSpeed()
    await battle.playToResult()
    const played = await battle.outcome()
    expect(['Victoria', 'Derrota']).toContain(played.title)
    if (played.title === 'Victoria') {
      expect(played.lead).toBe('¡Has ganado el combate!')
      expect(played.stats, 'victoria: turnos y Pokémon en pie, sin rivales debilitados').toHaveLength(2)
    } else {
      expect(played.stats, 'derrota: turnos, en pie y rivales debilitados').toHaveLength(3)
    }

    await page.getByRole('button', { name: 'Otro combate' }).click()
    await battle.root.waitFor()
    await battle.waitForActionOrResult()
    await battle.forfeitButton.click()
    await page.getByRole('button', { name: 'Sí, rendirme' }).click()
    const loss = await battle.outcome()
    expect(loss.title).toBe('Derrota')
    expect(loss.stats, 'derrota: turnos, en pie y rivales debilitados').toHaveLength(3)
    expect(loss.stats[2]).toMatch(/^Rivales debilitados: \d\/6$/)
  })
})

test.describe('Animaciones de entrada', () => {
  test('E2E-46 cambio forzado: la pantalla de equipo se cierra al elegir y el nuevo Pokémon sale de su Poké Ball a la vista', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    for (let guard = 0; guard < 60; guard += 1) {
      const state = await battle.waitForActionOrResult()
      expect(state).not.toBe('result')
      if (state === 'switch') break
      await battle.chooseFirstMove()
      await page.waitForTimeout(50)
    }
    await battle.chooseSubstitute()
    const field = page.getByTestId('field')
    await expect(field).toHaveAttribute('data-switch', 'player-send')
    await expect(page.locator('.bt-party'), 'la pantalla de equipo no tapa la animación').toHaveCount(0)
    const animatedBall = await page.evaluate(() => document.getAnimations().some((animation) => (animation.effect as KeyframeEffect | null)?.target?.classList.contains('bt-ball-player') && animation.playState === 'running'))
    expect(animatedBall, 'la Poké Ball del jugador se lanza').toBe(true)
    await expect(field).not.toHaveAttribute('data-switch', /./)
    expect(await battle.waitForActionOrResult()).toBe('moves')
  })
  // E2E-47 (entrada deslizante de los entrenadores) vive en intro-slide.spec.ts
})

test.describe('PS del jugador animados', () => {
  test('E2E-50 los PS numéricos bajan a la par de la barra: monótonos, sin saltar al valor final y con el PS exacto al terminar @timing', async ({ page }) => {
    await page.addInitScript(() => {
      const frames: { hp: number; max: number; fill: number }[] = []
      ;(window as unknown as { __hp: typeof frames }).__hp = frames
      const sample = () => {
        const box = document.querySelector('[data-testid=player-hp]')
        if (box) {
          const hp = [...box.querySelectorAll('.bt-databox-hp-now img')].map((image) => /hp-(\d)\.png/.exec(image.getAttribute('src') ?? '')?.[1] ?? '').join('')
          const max = [...box.querySelectorAll('.bt-databox-hp-max img')].map((image) => /hp-(\d)\.png/.exec(image.getAttribute('src') ?? '')?.[1] ?? '').join('')
          const fill = parseInt((box as HTMLElement).style.getPropertyValue('--fill'), 10)
          if (hp && max) frames.push({ hp: Number(hp), max: Number(max), fill })
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    const { battle } = await startBattle(page, { scenario: MISTY, seed: 'a' })
    await battle.waitForActionOrResult()
    await battle.chooseFirstMove()
    await battle.waitForActionOrResult()
    const frames = await page.evaluate(() => (window as unknown as { __hp: { hp: number; max: number; fill: number }[] }).__hp)
    const sameMon = frames.filter((frame) => frame.max === frames[0].max)
    const hps = sameMon.map((frame) => frame.hp)
    const finalHp = hps.at(-1)!
    expect(hps[0], 'empieza con los PS completos').toBe(frames[0].max)
    expect(finalHp, 'el combate quita PS en el primer turno').toBeLessThan(hps[0])
    const upToLowest = hps.slice(0, hps.indexOf(Math.min(...hps)) + 1)
    expect(upToLowest.every((hp, index) => index === 0 || hp <= upToLowest[index - 1]), 'bajada monótona, sin rebotes').toBe(true)
    const drop = hps[0] - finalHp
    const intermediates = new Set(hps.filter((hp) => hp < hps[0] && hp > finalHp))
    expect(intermediates.size, `pasa por valores intermedios entre ${hps[0]} y ${finalHp}`).toBeGreaterThanOrEqual(Math.min(5, drop - 1))
    for (const frame of sameMon) expect(Math.abs(frame.fill - (50 * frame.hp) / frame.max), `número ${frame.hp}/${frame.max} y barra ${frame.fill}px`).toBeLessThanOrEqual(1.01)
  })
})

test.describe('Animaciones de movimientos (DEC-53)', () => {
  test('E2E-66 al usar un movimiento se dibuja su animación en el lienzo; desactivadas en Ajustes, no', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a', mode: 'practice' })
    await battle.waitForActionOrResult()
    await battle.chooseFirstMove()
    await page.locator('.bt-fx[data-move]').waitFor({ state: 'attached' })
    const painted = await page.evaluate(async () => {
      const canvas = document.querySelector('.bt-fx') as HTMLCanvasElement
      const context = canvas.getContext('2d') as CanvasRenderingContext2D
      for (let i = 0; i < 60; i += 1) {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        for (let p = 3; p < pixels.length; p += 4) if (pixels[p] > 0) return true
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
      return false
    })
    expect(painted, 'el lienzo pinta algo durante la animación').toBe(true)

    await page.evaluate(() => localStorage.setItem('daily-pwt:settings', JSON.stringify({ version: 1, speed: 1, moveAnimations: false })))
    const again = await startBattle(page, { seed: 'b', mode: 'practice' })
    await again.battle.waitForActionOrResult()
    await again.battle.chooseFirstMove()
    await again.battle.waitForActionOrResult()
    await expect(page.locator('.bt-fx[data-move]')).toHaveCount(0)
  })
})
