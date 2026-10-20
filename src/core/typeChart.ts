export const GEN5_TYPES = [
  'Bug', 'Dark', 'Dragon', 'Electric', 'Fighting', 'Fire', 'Flying', 'Ghost', 'Grass',
  'Ground', 'Ice', 'Normal', 'Poison', 'Psychic', 'Rock', 'Steel', 'Water',
] as const

type Matchups = { double: string[]; half: string[]; immune: string[] }

// En Gen 5 Acero todavía resiste Fantasma y Siniestro, y Hada no existe.
const MATCHUPS: Record<string, Matchups> = {
  Bug: { double: ['Dark', 'Grass', 'Psychic'], half: ['Fighting', 'Fire', 'Flying', 'Ghost', 'Poison', 'Steel'], immune: [] },
  Dark: { double: ['Ghost', 'Psychic'], half: ['Dark', 'Fighting', 'Steel'], immune: [] },
  Dragon: { double: ['Dragon'], half: ['Steel'], immune: [] },
  Electric: { double: ['Flying', 'Water'], half: ['Dragon', 'Electric', 'Grass'], immune: ['Ground'] },
  Fighting: { double: ['Dark', 'Ice', 'Normal', 'Rock', 'Steel'], half: ['Bug', 'Flying', 'Poison', 'Psychic'], immune: ['Ghost'] },
  Fire: { double: ['Bug', 'Grass', 'Ice', 'Steel'], half: ['Dragon', 'Fire', 'Rock', 'Water'], immune: [] },
  Flying: { double: ['Bug', 'Fighting', 'Grass'], half: ['Electric', 'Rock', 'Steel'], immune: [] },
  Ghost: { double: ['Ghost', 'Psychic'], half: ['Dark', 'Steel'], immune: ['Normal'] },
  Grass: { double: ['Ground', 'Rock', 'Water'], half: ['Bug', 'Dragon', 'Fire', 'Flying', 'Grass', 'Poison', 'Steel'], immune: [] },
  Ground: { double: ['Electric', 'Fire', 'Poison', 'Rock', 'Steel'], half: ['Bug', 'Grass'], immune: ['Flying'] },
  Ice: { double: ['Dragon', 'Flying', 'Grass', 'Ground'], half: ['Fire', 'Ice', 'Steel', 'Water'], immune: [] },
  Normal: { double: [], half: ['Rock', 'Steel'], immune: ['Ghost'] },
  Poison: { double: ['Grass'], half: ['Ghost', 'Ground', 'Poison', 'Rock'], immune: ['Steel'] },
  Psychic: { double: ['Fighting', 'Poison'], half: ['Psychic', 'Steel'], immune: ['Dark'] },
  Rock: { double: ['Bug', 'Fire', 'Flying', 'Ice'], half: ['Fighting', 'Ground', 'Steel'], immune: [] },
  Steel: { double: ['Ice', 'Rock'], half: ['Electric', 'Fire', 'Steel', 'Water'], immune: [] },
  Water: { double: ['Fire', 'Ground', 'Rock'], half: ['Dragon', 'Grass', 'Water'], immune: [] },
}

function buildChart(): Record<string, Record<string, number>> {
  const chart: Record<string, Record<string, number>> = {}
  for (const attacker of GEN5_TYPES) {
    const { double, half, immune } = MATCHUPS[attacker]
    chart[attacker] = {}
    for (const defender of GEN5_TYPES) {
      chart[attacker][defender] = immune.includes(defender) ? 0 : double.includes(defender) ? 2 : half.includes(defender) ? 0.5 : 1
    }
  }
  return chart
}

/** TYPE_CHART[tipoAtaque][tipoDefensa] = multiplicador. */
export const TYPE_CHART: Record<string, Record<string, number>> = buildChart()

/** `chart` es la tabla generada (`dex.typeChart`, la que usa el resto del juego); TYPE_CHART es la referencia que verifica el test contra @pkmn. */
export function typeEffectiveness(moveType: string, defenderTypes: readonly string[], chart: Record<string, Record<string, number>>): number {
  return defenderTypes.reduce((multiplier, type) => multiplier * (chart[moveType]?.[type] ?? 1), 1)
}
