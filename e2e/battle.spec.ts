import { test, expect } from '@playwright/test'
import { BattlePage } from './pages/BattlePage'
import { TodayPage } from './pages/TodayPage'
import { D0, FORBIDDEN_IN_LOG, REF_DATES, startBattle } from './support'

const SEEDS = ['a', 'b', 'c']

test.describe('Partida completa contra la IA trivial', () => {
  for (const date of REF_DATES) {
    for (const seed of SEEDS) {
      test(`E2E-05 ${date} semilla ${seed}: llega a Resultado con registro en español`, async ({ page }) => {
        // Hay partidas de 60 turnos con intro y mensajes uno a uno: con 4 trabajadores en paralelo superan los 120 s por defecto.
        test.setTimeout(240_000)
        const { battle } = await startBattle(page, { date, seed })
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

  test('E2E-05 el registro es español, sin ids ni inglés', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
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
    const runs: { lines: string[]; outcome: unknown }[] = []
    for (let run = 0; run < 2; run += 1) {
      const { battle } = await startBattle(page, { date: D0, seed: 'repeat' })
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
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
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
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
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

  test('E2E-08 Salir del combate pide confirmación y descarta la partida', async ({ page }) => {
    const { battle, today } = await startBattle(page, { date: D0, seed: 'a' })
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
    await expect(today.fightButton, 'Hoy vuelve sin inicial elegido').toBeDisabled()

    await today.chooseLead(0)
    await today.fightButton.click()
    await battle.waitForActionOrResult()
    expect((await battle.logLines()).filter((l) => /^Turno/.test(l)), 'combate nuevo desde el turno 1').toEqual(['Turno 1'])
  })

  test('E2E-18 la táctil queda en espera durante animación y turno rival (sin botones); cinco clics = una decisión; «Turno N» no sale en pantalla', async ({ page }) => {
    // 2026-10-20 (Misty): el primer turno no debilita a nadie; contra el rival de D0 hay cambio forzado y no habría «Turno 2».
    const { battle } = await startBattle(page, { date: '2026-10-20', seed: 'a' })
    await battle.waitForActionOrResult()
    expect((await battle.logLines()).filter((l) => /^Turno \d+$/.test(l))).toEqual(['Turno 1'])

    // Cinco clics en el mismo task: solo el primero cuenta.
    await battle.fightButton.click()
    await battle.enabledMoves.first().evaluate((button) => { for (let i = 0; i < 5; i += 1) (button as HTMLButtonElement).click() })
    await expect(battle.moves, 'sin menú de movimientos al elegir').toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Luchar|Rendirse|Mochila|Cambiar)$/ }), 'táctil en espera: sin botones').toHaveCount(0)
    await expect(page.getByTestId('field').getByRole('status'), 'el mensaje en pantalla no es «Turno N»').not.toHaveText(/^Turno \d+$/)

    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    expect((await battle.logLines()).filter((l) => /^Turno \d+$/.test(l)), 'un solo turno procesado').toEqual(['Turno 1', 'Turno 2'])
  })

  test('E2E-23 Mochila atenuada: explica en la caja de texto que en el PWT no se usan objetos', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()
    const bag = page.getByRole('button', { name: 'Mochila' })
    await expect(bag).toHaveAttribute('aria-disabled', 'true')
    await expect(bag).toHaveAccessibleDescription('En el PWT no se pueden usar objetos.')
    await bag.click({ force: true })
    await expect(page.getByRole('status')).toContainText('En el PWT no se pueden usar objetos.')
  })

  test('E2E-24 el sprite del jugador asoma sobre la caja de mensajes (no queda tapado)', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()
    const sprite = await page.locator('.bt-mon-player .bt-sprite').boundingBox()
    const message = await page.locator('.bt-message').boundingBox()
    expect(sprite && message).toBeTruthy()
    const visibleAboveBox = (message!.y - sprite!.y) / sprite!.height
    expect(visibleAboveBox, 'al menos el 60 % del sprite sobre la caja').toBeGreaterThan(0.6)
  })

  test('E2E-20 resultado mínimo: victoria y derrota', async ({ page }) => {
    // 2026-10-20 (Misty): con el primer movimiento siempre, el jugador gana en ~25 decisiones; contra el rival de D0 pierde.
    const { battle } = await startBattle(page, { date: '2026-10-20', seed: 'a' })
    await battle.maxSpeed()
    await battle.playToResult()
    const win = await battle.outcome()
    expect(win.title).toBe('Victoria')
    expect(win.lead).toBe('¡Has ganado el combate!')
    expect(win.stats, 'victoria: turnos y Pokémon en pie, sin rivales debilitados').toHaveLength(2)

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
