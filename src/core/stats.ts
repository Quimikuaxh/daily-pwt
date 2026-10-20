import type { StatsTable } from './types'

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const

// [stat que sube, stat que baja]; las naturalezas neutras no tienen entrada.
const NATURE_EFFECTS: Record<string, [keyof StatsTable, keyof StatsTable]> = {
  Lonely: ['atk', 'def'], Brave: ['atk', 'spe'], Adamant: ['atk', 'spa'], Naughty: ['atk', 'spd'],
  Bold: ['def', 'atk'], Relaxed: ['def', 'spe'], Impish: ['def', 'spa'], Lax: ['def', 'spd'],
  Timid: ['spe', 'atk'], Hasty: ['spe', 'def'], Jolly: ['spe', 'spa'], Naive: ['spe', 'spd'],
  Modest: ['spa', 'atk'], Mild: ['spa', 'def'], Quiet: ['spa', 'spe'], Rash: ['spa', 'spd'],
  Calm: ['spd', 'atk'], Gentle: ['spd', 'def'], Sassy: ['spd', 'spe'], Careful: ['spd', 'spa'],
}

/** Stat que sube y stat que baja una naturaleza, o `null` si es neutra. */
export const natureEffect = (nature: string): { up: keyof StatsTable; down: keyof StatsTable } | null => {
  const effect = NATURE_EFFECTS[nature]
  return effect ? { up: effect[0], down: effect[1] } : null
}

/** Stats reales (fórmula de Gen 3-5). */
export function calcStats(base: StatsTable, ivs: StatsTable, evs: StatsTable, nature: string, level: number): StatsTable {
  const effect = NATURE_EFFECTS[nature]
  const result = {} as StatsTable
  for (const key of STAT_KEYS) {
    const core = Math.floor(((2 * base[key] + ivs[key] + Math.floor(evs[key] / 4)) * level) / 100)
    if (key === 'hp') {
      result.hp = base.hp === 1 ? 1 : core + level + 10
      continue
    }
    const multiplier = effect?.[0] === key ? 1.1 : effect?.[1] === key ? 0.9 : 1
    result[key] = Math.floor((core + 5) * multiplier)
  }
  return result
}
