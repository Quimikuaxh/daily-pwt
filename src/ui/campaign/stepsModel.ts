/**
 * Qué viene en la campaña (Jose, 12/11/2026: con solo «Continuar» no se sabía que se iba a tocar el equipo). Los pasos del hito en
 * curso, con el actual marcado, y lo que hace el botón principal: «Reclutar (1 de 4)», «Preparar equipo», «Evolucionar», «Elegir
 * participantes» o «Combatir contra SIXTO».
 */
import type { CampaignState } from '../../core/nuzlocke/campaign'

export type StepId = 'recruit' | 'evolve' | 'team' | 'roster' | 'battle'
export type CampaignSteps = { steps: StepId[]; current: StepId; pick: { n: number; total: number } | null }

/**
 * `picks`: elecciones del hito; `league`: si el rival es del Alto Mando o el campeón; `evolutions`: si alguno evoluciona al entrar en la
 * Liga. En un gimnasio, Reclutar → Equipo → Combate; al entrar en la Liga, Reclutar → (Evolución) → Equipo → Participantes → Combate;
 * con la plantilla ya fijada, solo Combate.
 */
export function campaignSteps(state: CampaignState, picks: number, league: boolean, evolutions: boolean): CampaignSteps {
  const fixed = league && !!state.leagueRoster
  const steps: StepId[] = fixed ? ['battle'] : league
    ? ['recruit', ...(evolutions || state.leagueEvolved ? ['evolve' as const] : []), 'team', 'roster', 'battle']
    : ['recruit', 'team', 'battle']
  const current: StepId = state.phase === 'draft' ? 'recruit'
    : fixed ? 'battle'
      : league && !state.leagueEvolved && evolutions ? 'evolve'
        : 'team'
  return { steps, current, pick: state.phase === 'draft' ? { n: state.pick + 1, total: picks } : null }
}
