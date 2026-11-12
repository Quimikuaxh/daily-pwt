import { DataError } from '../errors'
import { deriveSeed, Prng } from '../prng'

const OFFER_SIZE = 4

/**
 * Ventana del draft de Esmeralda, proporcional a la media del rival de cada hito (Jose, 11/11/2026: «como en el PWT» se refería al
 * tamaño del margen, no a que fuese fijo; −30/+40 absoluto era demasiado margen al principio). Tamaño de `BST_WINDOW_1` del PWT
 * (−180/+240 sobre la suma de seis) respecto a la mediana de las sumas de los 99 equipos de seis del PWT (2983): −6 % / +8 %. El
 * 12/11/2026 Jose amplió el margen por abajo a −10 % (más variedad, con Pokémon algo más flojos; por arriba sigue +8 %).
 */
export const EMERALD_DRAFT_RATIO = Object.freeze({ below: 0.10, above: 0.08 })

/** Ventana absoluta para una media del rival según una ventana proporcional. */
export const relativeDraftWindow = (rivalAverage: number, ratio: { below: number; above: number }): DraftRequest['window'] =>
  ({ below: rivalAverage * ratio.below, above: rivalAverage * ratio.above })

export type DraftRequest = {
  seed: string
  encounterId: string
  pick: number
  rivalAverage: number
  window: { below: number; above: number }
  previousOffer: readonly string[]
  /** Formas que ya cumplen los requisitos de nivel y progreso para este encuentro. */
  candidates: readonly { species: string; baseStatTotal: number }[]
  /** Si se indica, la oferta debe incluir al menos una de estas especies. */
  requiredSpecies?: readonly string[]
}

/** Pool único dentro del margen, después de excluir la oferta anterior. */
export function draftPool({ rivalAverage, window, previousOffer, candidates }: Pick<DraftRequest, 'rivalAverage' | 'window' | 'previousOffer' | 'candidates'>): string[] {
  const min = rivalAverage - window.below
  const max = rivalAverage + window.above
  const excluded = new Set(previousOffer)
  const eligible = new Set<string>()
  for (const { species, baseStatTotal } of candidates) {
    if (!excluded.has(species) && baseStatTotal >= min && baseStatTotal <= max) eligible.add(species)
  }
  return [...eligible].sort()
}

const combinations = (n: number, k: number) => {
  if (k > n) return 0
  let value = 1
  for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i
  return value
}

/** Sortea una oferta estable; sin requisito conserva exactamente el sorteo v1. */
export function draftOffer(request: DraftRequest): string[] {
  const { seed, encounterId, pick, requiredSpecies } = request
  const eligible = draftPool(request)
  if (eligible.length < OFFER_SIZE) {
    throw new DataError(`El draft de ${encounterId} necesita cuatro candidatos; hay ${eligible.length} tras margen y exclusiones.`)
  }

  const rng = new Prng(deriveSeed(seed, 'nuzlocke-draft:v1', encounterId, String(pick)))
  if (!requiredSpecies) return rng.sample(eligible, OFFER_SIZE)
  const required = new Set(requiredSpecies)
  const good = eligible.filter(id => required.has(id))
  const other = eligible.filter(id => !required.has(id))
  if (!good.length) throw new DataError(`El draft de ${encounterId} no tiene candidatos con tipo propio supereficaz.`)
  // Distribución hipergeométrica condicionada a incluir al menos uno:
  // evita favorecer las ofertas con varios candidatos supereficaces.
  const counts = [1, 2, 3, 4]
  const count = rng.pickWeighted(counts, k => combinations(good.length, k) * combinations(other.length, OFFER_SIZE - k))
  return rng.shuffle([...rng.sample(good, count), ...rng.sample(other, OFFER_SIZE - count)])
}
