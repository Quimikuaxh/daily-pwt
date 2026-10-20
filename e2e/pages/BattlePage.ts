import type { Locator, Page } from '@playwright/test'

export type Outcome = { title: string; lead: string; stats: string[] }

/** Pantalla de combate y resultado. */
export class BattlePage {
  readonly root: Locator
  readonly moves: Locator
  readonly enabledMoves: Locator
  readonly fightButton: Locator
  readonly historyButton: Locator
  readonly switchButton: Locator
  readonly switchOptions: Locator
  readonly enabledSwitchOptions: Locator
  readonly log: Locator
  readonly forfeitButton: Locator
  readonly exitButton: Locator
  readonly speedButton: Locator
  readonly resultTitle: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId('battle-screen')
    this.moves = page.getByRole('group', { name: 'Movimientos' }).getByRole('button')
    this.enabledMoves = page.getByRole('group', { name: 'Movimientos' }).locator('button:enabled')
    this.fightButton = page.getByRole('button', { name: 'Luchar', exact: true })
    this.historyButton = page.getByRole('button', { name: 'Registro', exact: true })
    this.switchButton = page.getByRole('button', { name: 'Cambiar', exact: true })
    this.switchOptions = page.locator('.bt-party-panel')
    // Placas de la pantalla de equipo que se pueden mandar al combate (ni debilitadas ni ya en el campo).
    this.enabledSwitchOptions = page.locator('.bt-party-panel[data-state="ready"]:enabled')
    this.log = page.getByRole('dialog').getByRole('log', { name: 'Registro del combate' })
    this.forfeitButton = page.getByRole('button', { name: 'Rendirse' })
    this.exitButton = page.getByRole('button', { name: 'Salir', exact: true })
    this.speedButton = page.getByRole('button', { name: /^Velocidad/ })
    this.resultTitle = page.getByRole('heading', { level: 1, name: /^(Victoria|Derrota)$/ })
  }

  /** Pulsa Velocidad hasta x4 (1100 ms de pausa por mensaje pasan a 275 ms). */
  async maxSpeed(): Promise<void> {
    await this.speedButton.click()
    await this.speedButton.click()
  }

  /**
   * Espera a poder actuar o a que aparezca el resultado. 'moves' = se puede elegir un movimiento (menú principal con Luchar
   * activo, o ya en el menú de movimientos); 'switch' = hay que elegir sustituto (cambio forzado).
   */
  async waitForActionOrResult(): Promise<'moves' | 'switch' | 'result'> {
    await this.resultTitle.or(this.enabledMoves.first()).or(this.fightButton.and(this.page.locator(':enabled'))).or(this.enabledSwitchOptions.first()).first().waitFor({ timeout: 60_000 })
    if (await this.resultTitle.isVisible()) return 'result'
    // La pantalla de equipo cubre las dos pantallas: si está abierta y hay sustituto elegible, es el cambio forzado.
    return (await this.page.locator('.bt-party').count()) > 0 && (await this.enabledSwitchOptions.count()) > 0 ? 'switch' : 'moves'
  }

  /** Elige el primer sustituto disponible en la pantalla de equipo: placa y, en el menú, Cambiar. */
  async chooseSubstitute(): Promise<void> {
    await this.enabledSwitchOptions.first().click()
    await this.page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Cambiar', exact: true }).click()
  }

  /** Abre Luchar si hace falta y pulsa el primer movimiento activo. */
  async chooseFirstMove(): Promise<void> {
    if ((await this.enabledMoves.count()) === 0) await this.fightButton.click()
    await this.enabledMoves.first().click()
  }

  /** Espera a poder actuar y toma una decisión (primer movimiento o primer sustituto). Devuelve 'result' sin actuar si ya acabó. */
  async decide(): Promise<'moves' | 'switch' | 'result'> {
    const state = await this.waitForActionOrResult()
    if (state === 'moves') await this.chooseFirstMove()
    else if (state === 'switch') await this.chooseSubstitute()
    // El click bloquea los controles hasta que el update se presenta; se deja pasar un instante.
    if (state !== 'result') await this.page.waitForTimeout(50)
    return state
  }

  /** Juega siempre el primer movimiento (o el primer sustituto) hasta el resultado. Devuelve las decisiones tomadas. */
  async playToResult(): Promise<number> {
    let decisions = 0
    while ((await this.decide()) !== 'result') decisions += 1
    return decisions
  }

  async outcome(): Promise<Outcome> {
    return {
      title: (await this.resultTitle.textContent()) ?? '',
      lead: (await this.page.locator('.result-lead').textContent()) ?? '',
      stats: await this.page.locator('.result-stats li').allTextContents(),
    }
  }

  /** Lee el historial completo: se abre con Registro y se cierra con Escape (el foco vuelve al botón). */
  async logLines(): Promise<string[]> {
    await this.historyButton.click()
    const lines = await this.log.locator('.bt-line').allTextContents()
    await this.page.keyboard.press('Escape')
    return lines
  }
}
