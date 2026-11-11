/**
 * Evoluciones de la Liga (D7, opción A aprobada el 11/11/2026): qué miembros evolucionan y a qué formas finales (las del núcleo,
 * `leagueEvolutionTargets`), y la secuencia de mensajes de la escena por miembro. Los de una forma no preguntan; los de varias, sí.
 */
import { leagueEvolutionTargets, type CampaignDefinition, type CampaignState } from '../../core/nuzlocke/campaign'

export type LeagueEvolution = { id: string; species: string; level: number; targets: string[] }

/** Miembros vivos que cambian de forma en la Liga, en el orden de la campaña. */
export function leagueEvolutions(definition: CampaignDefinition, state: CampaignState): LeagueEvolution[] {
  return state.members.flatMap((member) => {
    if (member.fainted) return []
    const targets = leagueEvolutionTargets(definition, member.species)
    if (!targets.length || (targets.length === 1 && targets[0] === member.species)) return []
    return [{ id: member.id, species: member.species, level: member.level, targets }]
  })
}

/** Paso de la escena de un miembro: anuncio, pregunta (si hay varias formas) y resultado. */
export type EvolutionStep = 'evolving' | 'choose' | 'evolved'
export const firstStep: EvolutionStep = 'evolving'
export const nextStep = (step: EvolutionStep, choices: number): EvolutionStep | null =>
  step === 'evolving' ? (choices > 1 ? 'choose' : 'evolved') : step === 'choose' ? 'evolved' : null

/** Forma elegida por miembro (id → especie). */
export type EvolutionChoices = Record<string, string>

/** Ancho en teselas de la ventana de formas: letras del nombre más largo + 2, como los menús del juego. */
export const optionsWidth = (names: readonly string[]): number => Math.max(...names.map((name) => [...name].length)) + 2
