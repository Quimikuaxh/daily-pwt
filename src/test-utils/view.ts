/** Fixtures de BattleView (forma documentada en src/test-utils/harness.ts). */
export type MonView = { species: string; hpPercent: number; status: string | null; fainted: boolean; hp?: number; maxHp?: number; substitute?: boolean }
export type SideView = { remaining: number; active: number | null; team: MonView[] }
export type BattleView = { turn: number; weather: string | null; weatherTurns?: number | null; player: SideView; rival: SideView }

export const pMon = (species: string, hp = 150, maxHp = 150, over: Partial<MonView> = {}): MonView =>
  ({ species, hp, maxHp, hpPercent: Math.round((hp / maxHp) * 100), status: null, fainted: hp <= 0, ...over })
export const rMon = (species: string, hpPercent = 100, over: Partial<MonView> = {}): MonView =>
  ({ species, hpPercent, status: null, fainted: hpPercent <= 0, ...over })

export function mkView(over: { player?: MonView[]; rival?: MonView[]; turn?: number; weather?: string | null; pActive?: number; rActive?: number } = {}): BattleView {
  const player = over.player ?? [pMon('garchomp', 183, 183), pMon('starmie', 150, 150), pMon('gengar', 140, 140)]
  const rival = over.rival ?? [rMon('snorlax'), rMon('tyranitar'), rMon('heatran')]
  return {
    turn: over.turn ?? 1,
    weather: over.weather ?? null,
    player: { remaining: player.filter((m) => !m.fainted).length, active: over.pActive ?? 0, team: player },
    rival: { remaining: rival.filter((m) => !m.fainted).length, active: over.rActive ?? 0, team: rival },
  }
}
