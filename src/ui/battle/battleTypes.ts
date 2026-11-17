/** Datos visuales compartidos por el reto diario (Nv. 50) y la campaña (niveles y hasta cuatro movimientos). */
import type { Challenge, ResolvedSet } from '../../core/types'

export type BattleTeamSet = Omit<ResolvedSet, 'level' | 'moves'> & { level: number; moves: string[] }
export type BattleChallenge = Omit<Challenge, 'playerTeam' | 'rivalTeam'> & { playerTeam: BattleTeamSet[]; rivalTeam: BattleTeamSet[] }

import type { ComponentType } from 'react'
import type { BattleParams } from '../../hooks/useBattle'
import type { Avatar } from './introAssets'
import type { PartyMember } from './party/partyModel'
import type { SidePanelProps } from './side/SidePanel'

/** Opciones de una sesión de campaña; el diario conserva sus valores por defecto. */
export type CampaignPresentation = {
  avatar?: Avatar
  SidePanel?: ComponentType<SidePanelProps>
  reservedHeight?: number
  resumed?: boolean
  intro: { rivalLead: string; playerLead: string }
  music: string
  registerMusic?: () => void
  playSfx: NonNullable<BattleParams['playSfx']>
  playCry: NonNullable<BattleParams['playCry']>
  preload: (species: readonly string[]) => void
  onRetry: () => void
  /** Botón de abajo de la pantalla táctil: HUIR en vez de RENDIRSE, y su aviso (no se huye de un entrenador, como en Hoenn). */
  runLabel: string
  noRun: string
  retryLabel: string
  modeLabel: string
  evolutionsOf?: (species: string) => PartyMember['evolutions']
}

