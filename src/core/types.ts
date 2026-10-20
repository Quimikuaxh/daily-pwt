export type StatsTable = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }

export type PokemonSet = {
  species: string
  level: 50
  item: string
  abilities: string[]
  moves: [string, string, string, string]
  nature?: string
  natureAssumed?: boolean
  evs?: Partial<StatsTable>
  evsAssumed?: boolean
  gender?: 'M' | 'F'
  verified: boolean
  tags?: string[]
}

export type TrainerGender = 'F' | 'M'

export type TeamVariant = { id: string; sourceTournament: string; sourceUrl: string; team: PokemonSet[] }

export type Trainer = {
  id: string
  nameEs: string
  nameEn: string
  /** Género gramatical del entrenador ("La Líder Camila", "El Campeón Rojo"). */
  gender?: TrainerGender
  category: 'leader' | 'champion'
  region: 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'unova' | null
  specialtyType?: string
  sprite: string
  ivs: number
  alwaysLeadsWith?: string
  variants: TeamVariant[]
}

export type ResolvedSet = {
  species: string
  nameEs: string
  level: 50
  item: string
  ability: string
  moves: [string, string, string, string]
  nature: string
  ivs: StatsTable
  evs: StatsTable
  gender?: 'M' | 'F'
}

export type RosterScheduleEntry = { fromDayIndex: number; trainerIds: string[] }

export type DexSpecies = {
  id: string
  name: string
  types: string[]
  baseStats: StatsTable
  abilities: string[]
  nfe: boolean
  spriteId: string
}

export type DexMove = {
  id: string
  name: string
  type: string
  category: 'Physical' | 'Special' | 'Status'
  basePower: number
  accuracy: number | true
  pp: number
}

export type DexData = {
  species: Record<string, DexSpecies>
  moves: Record<string, DexMove>
  /** typeChart[ataque][defensa] = multiplicador (17 tipos Gen 5, sin Hada). */
  typeChart: Record<string, Record<string, number>>
}

export type NamesEs = {
  species: Record<string, string>
  moves: Record<string, string>
  abilities: Record<string, string>
  items: Record<string, string>
  types: Record<string, string>
}

export type GameData = {
  dataVersion: string
  trainers: Trainer[]
  rosterSchedule: RosterScheduleEntry[]
  playerSets: PokemonSet[]
  dex: DexData
  names: NamesEs
}

export type Challenge = {
  number: number
  date: string
  dataVersion: string
  trainer: { id: string; nameEs: string; gender: TrainerGender; category: Trainer['category']; region: Trainer['region']; specialtyType?: string; sprite: string }
  variant: { id: string; sourceTournament: string; sourceUrl: string }
  rivalTeam: ResolvedSet[]
  playerTeam: ResolvedSet[]
  meta: { teamAttempts: number; relaxedRules: string[] }
}
