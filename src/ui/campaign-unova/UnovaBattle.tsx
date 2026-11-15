/** Adaptador de la campaña de Teselia al combate del diario; la sesión conserva el motor y el guardado. */
import { lazy, useMemo, useState } from 'react'
import type { BattleChallenge, BattleTeamSet } from '../battle/battleTypes'
import { BattleScreen, type CampaignPresentation } from '../battle/BattleScreen'
import type { CampaignBattleProps } from '../campaign/EmeraldBattle'
import { sessionBattleClient } from '../campaign/campaignBattle'
import type { SideSets } from '../campaign/sidePanelsModel'
import { unovaSounds } from './unovaMusic'
import { AVATARS } from '../battle/introAssets'
import { esUnova } from '../../i18n/esUnova'
import { esCampaign } from '../../i18n/esCampaign'

const UnovaBattleSide = lazy(() => import('./UnovaBattleSide').then((module) => ({ default: module.UnovaBattleSide })))

/** Los sets de campaña tienen niveles y hasta cuatro movimientos; los modelos del diario aceptan ambas cosas en ejecución. */
function resolvedTeam(sets: SideSets['player'], data: CampaignBattleProps['data']): BattleTeamSet[] {
  return sets.map((set) => ({ ...set, nameEs: data.names.species[set.species] ?? set.species, moves: [...set.moves] }))
}

export function UnovaBattle({ session, start, onRetry, data, trainer, trainerId, resumed, intro, music, registerMusic, sounds = unovaSounds, onEnded, sides, reservedHeight = 150, protagonist, playerName, sound }: CampaignBattleProps) {
  const [sets, setSets] = useState(() => sides?.sets() ?? { player: [], rival: [] })
  // El registro preparado manda sobre los sets provisionales: habilidad, sexo, objeto, nivel y orden exactos del motor.
  const client = useMemo(() => {
    const adapter = sessionBattleClient(session, start)
    return { ...adapter, subscribe: (listener: Parameters<typeof adapter.subscribe>[0]) => adapter.subscribe((message) => {
      const prepared = sides?.sets()
      if (prepared) setSets(prepared)
      listener(message)
    }) }
    // La sesión y su arranque fijan un intento; las lecturas del registro permanecen válidas durante él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, start])
  const challenge = useMemo((): BattleChallenge => ({
    number: 0, date: '', dataVersion: data.dataVersion,
    variant: { id: '', sourceTournament: '', sourceUrl: '' }, meta: { teamAttempts: 0, relaxedRules: [] },
    trainer: { ...trainer, id: trainerId ?? '', sprite: trainerId ?? '', region: 'unova' },
    playerTeam: resolvedTeam(sets.player, data), rivalTeam: resolvedTeam(sets.rival, data),
  }), [sets, data, trainer, trainerId])
  const campaign = useMemo((): CampaignPresentation => ({
    avatar: protagonist ? AVATARS[protagonist === 'may' ? 'rosa' : 'nate'] : undefined,
    SidePanel: UnovaBattleSide, reservedHeight, resumed, intro, music, registerMusic, onRetry,
    retryLabel: esUnova.battle.retry, runLabel: esCampaign.battle.run, noRun: esCampaign.battle.noRun, modeLabel: esUnova.modeLabel,
    playSfx: (id) => {
      // useBattle ya sincroniza las bolas de N2/B2; el filtro de Esmeralda no se aplica a estos dos efectos.
      const mapped = id === 'ball-throw' ? sounds.ballThrow : id === 'ball-open' ? sounds.ballOpen : sounds.sfxFor(id)
      if (mapped) sounds.playSfx(mapped)
    },
    playCry: (species, faint) => sounds.playCry(data.dex.species[species]?.spriteId ?? species, faint),
    preload: (species) => { sounds.preloadSfx(sounds.battleIds); sounds.preloadCries(species.map((id) => data.dex.species[id]?.spriteId ?? id)) },
  }), [resumed, intro, music, registerMusic, onRetry, sounds, reservedHeight, protagonist, data.dex.species])
  return <BattleScreen client={client} data={data} challenge={challenge} playerLead={0} battleSeed={trainerId ?? ''}
    campaign={campaign} sound={sound} trainerName={playerName} onFinish={onEnded} onExit={() => undefined} />
}
