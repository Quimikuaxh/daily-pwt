import type { Locator, Page } from '@playwright/test'
import { DEFAULT_SCENARIO, scenarioQuery, type Scenario } from '../support'

/** Pantalla Hoy. Los selectores usan roles y textos en español de la UI. */
export class TodayPage {
  /** Botón «Combate oficial» (Jugar / Reanudar / resultado). */
  readonly fightButton: Locator
  readonly practiceButton: Locator
  readonly officialStatus: Locator
  readonly rivalToggle: Locator
  readonly leadButtons: Locator
  readonly playerCards: Locator
  readonly rivalMons: Locator
  readonly challengeNumber: Locator
  readonly countdown: Locator

  constructor(readonly page: Page) {
    this.fightButton = page.getByRole('button', { name: /^Combate oficial/ })
    this.practiceButton = page.getByRole('button', { name: 'Práctica', exact: true })
    this.officialStatus = page.getByTestId('official-status')
    this.rivalToggle = page.getByRole('button', { name: /^(Ver|Ocultar) movimientos y objetos del rival$/ })
    this.leadButtons = page.getByRole('button', { name: /^(Sacar primero|Sale primero)/ })
    this.playerCards = page.locator('article.player-card')
    this.rivalMons = page.locator('ul.rival-team > li')
    this.challengeNumber = page.locator('.challenge-number')
    this.countdown = page.locator('.countdown-value')
  }

  /** `query` admite ganchos adicionales (`seed=abc&ai=trivial`). */
  async goto(scenario: Scenario = DEFAULT_SCENARIO, query = ''): Promise<void> {
    await this.page.goto(`./?${scenarioQuery(scenario)}${query ? `&${query}` : ''}`)
    await this.challengeNumber.waitFor()
  }

  async chooseLead(index: number): Promise<void> {
    await this.leadButtons.nth(index).click()
  }

  async rivalName(): Promise<string> {
    return (await this.page.locator('.rival-name').textContent()) ?? ''
  }

  async rivalSpecies(): Promise<string[]> {
    return this.page.locator('.rival-mon-name').allTextContents()
  }
}
