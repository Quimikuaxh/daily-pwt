import type { DexData, ResolvedSet } from './types'

/** Legendarios prohibidos en el PWT (PRD §6), por id de especie (base; se compara por prefijo). */
export const FORBIDDEN_SPECIES = [
  'mewtwo', 'mew', 'lugia', 'hooh', 'celebi', 'kyogre', 'groudon', 'rayquaza', 'jirachi', 'deoxys',
  'dialga', 'palkia', 'giratina', 'phione', 'manaphy', 'darkrai', 'shaymin', 'arceus', 'victini',
  'reshiram', 'zekrom', 'kyurem', 'keldeo', 'meloetta', 'genesect',
]
export const isForbidden = (speciesId: string): boolean =>
  FORBIDDEN_SPECIES.some((f) => speciesId === f || (speciesId.startsWith(f) && f !== 'mew'))

export const multiplier = (dex: DexData, moveType: string, defTypes: string[]): number =>
  defTypes.reduce((acc, t) => acc * (dex.typeChart[moveType]?.[t] ?? 1), 1)

export function hasSuperEffectiveMove(dex: DexData, team: ResolvedSet[], rival: ResolvedSet[]): boolean {
  return team.some((p) =>
    p.moves.some((id) => {
      const mv = dex.moves[id]
      if (!mv || mv.category === 'Status' || mv.basePower <= 0) return false
      return rival.some((r) => multiplier(dex, mv.type, dex.species[r.species].types) >= 2)
    }),
  )
}

export function distinctTypes(dex: DexData, team: ResolvedSet[]): string[] {
  return [...new Set(team.flatMap((p) => dex.species[p.species].types))]
}

export const baseStatTotal = (dex: DexData, team: ResolvedSet[]): number =>
  team.reduce((total, p) => total + Object.values(dex.species[p.species].baseStats).reduce((sum, stat) => sum + stat, 0), 0)

export const maxSharingAType = (dex: DexData, team: ResolvedSet[]): number => {
  const counts = new Map<string, number>()
  for (const p of team) for (const t of dex.species[p.species].types) counts.set(t, (counts.get(t) ?? 0) + 1)
  return Math.max(...counts.values())
}

/** Devuelve la lista de reglas RF-12/13/13b/13c/14/16 incumplidas por un equipo del jugador (RF-16: los IV son los del rival del día). */
export function teamViolations(dex: DexData, team: ResolvedSet[], rival: ResolvedSet[], relaxed: string[] = []): string[] {
  const out: string[] = []
  if (team.length !== 6) out.push(`tamaño ${team.length}`)
  if (team.some((p) => dex.species[p.species].nfe)) out.push('RF-12 nfe')
  if (new Set(team.map((p) => p.species)).size !== team.length) out.push('RF-12 especie repetida')
  if (new Set(team.map((p) => p.item)).size !== team.length) out.push('RF-12 objeto repetido')
  if (team.some((p) => isForbidden(p.species))) out.push('RF-12 prohibido')
  if (distinctTypes(dex, team).length < 4) out.push('RF-13 <4 tipos')
  if (!relaxed.includes('RF-13b') && baseStatTotal(dex, team) < 3060) out.push('RF-13b suma < 3060')
  if (maxSharingAType(dex, team) > 2) out.push('RF-13c >2 del mismo tipo')
  if (!relaxed.includes('RF-14') && !hasSuperEffectiveMove(dex, team, rival)) out.push('RF-14 sin x2')
  if (team.some((p) => p.level !== 50)) out.push('RF-16 nivel')
  const rivalIv = rival[0]?.ivs.hp
  if (team.some((p) => Object.values(p.ivs).some((v) => v !== rivalIv))) out.push('RF-16 IV')
  if (team.some((p) => Object.values(p.evs).some((v) => v !== 0))) out.push('RF-16 EV')
  return out
}
