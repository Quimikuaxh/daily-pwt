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

test.describe('Animaciones de entrada', () => {
  test('E2E-46 cambio forzado: la pantalla de equipo se cierra al elegir y el nuevo Pokémon sale de su Poké Ball a la vista', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
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

  test('E2E-47 intro: los dos entrenadores entran deslizándose desde fuera del lienzo (no aparecen de golpe)', async ({ page }) => {
    await page.addInitScript(() => {
      const samples: { rival: number; player: number; opacity: number }[] = []
      ;(window as unknown as { __slide: typeof samples }).__slide = samples
      const sample = () => {
        const field = document.querySelector('[data-testid=field]')
        if (field?.getAttribute('data-intro') === 'enter') {
          const edge = field.getBoundingClientRect()
          const rival = document.querySelector('.bt-trainer-rival')!.getBoundingClientRect()
          const player = document.querySelector('.bt-trainer-player')!.getBoundingClientRect()
          samples.push({ rival: rival.left - edge.right, player: edge.left - player.right, opacity: Math.min(+getComputedStyle(document.querySelector('.bt-trainer-rival')!).opacity, +getComputedStyle(document.querySelector('.bt-trainer-player')!).opacity) })
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.root.waitFor()
    await expect(page.getByTestId('field')).toHaveAttribute('data-intro', 'done', { timeout: 15000 })
    const samples = await page.evaluate(() => (window as unknown as { __slide: { rival: number; player: number; opacity: number }[] }).__slide)
    expect(samples.length, 'fotogramas durante la fase «enter» (500 ms)').toBeGreaterThan(5)
    expect(Math.min(...samples.map((sample) => sample.opacity)), 'el entrenador se desliza opaco, sin fundido que lo oculte al principio').toBeGreaterThanOrEqual(0.99)
    for (const side of ['rival', 'player'] as const) {
      const offsets = samples.map((sample) => sample[side])
      expect(offsets[0], `${side}: empieza fuera del lienzo`).toBeGreaterThanOrEqual(-2)
      expect(offsets.at(-1), `${side}: termina dentro`).toBeLessThan(-40)
      expect(offsets.filter((offset, index) => index > 0 && offset < offsets[index - 1] - 1).length, `${side}: avanza en muchos fotogramas, no de golpe`).toBeGreaterThanOrEqual(5)
      expect(Math.max(...offsets.slice(1).map((offset, index) => Math.abs(offset - offsets[index]))), `${side}: ningún salto brusco`).toBeLessThan(70)
    }
  })
})

test.describe('PS del jugador animados', () => {
  test('E2E-50 los PS numéricos bajan a la par de la barra: monótonos, sin saltar al valor final y con el PS exacto al terminar', async ({ page }) => {
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
    const { battle } = await startBattle(page, { date: '2026-10-20', seed: 'a' })
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
