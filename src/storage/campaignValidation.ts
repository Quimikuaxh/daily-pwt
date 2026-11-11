import type { CampaignRecord } from './campaignStore'

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const text = (v: unknown): v is string => typeof v === 'string'
const list = (v: unknown): v is string[] => Array.isArray(v) && v.every(text)
const stats = (v: unknown) => object(v) && ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every(k => count(v[k]))

function state(v: unknown): boolean {
  return object(v) && text(v.seed) && count(v.encounterIndex) && count(v.pick) &&
    ['draft', 'prepare', 'battle', 'won', 'lost'].includes(String(v.phase)) && list(v.offer) && list(v.previousOffer) &&
    (v.leagueRoster === null || list(v.leagueRoster)) && list(v.battleTeam) &&
    (v.battleSeed === undefined || text(v.battleSeed)) && Array.isArray(v.members) && v.members.every(m =>
      object(m) && text(m.id) && text(m.species) && count(m.level) && m.level > 0 && m.level <= 100 &&
      typeof m.fainted === 'boolean' && count(m.victories) && (m.hiddenPowerIvs === undefined || stats(m.hiddenPowerIvs)) &&
      Array.isArray(m.history) && m.history.every(h => object(h) && text(h.species) && count(h.evolvedAt)) &&
      (m.recruitmentHistoryLength === undefined || (count(m.recruitmentHistoryLength) && m.recruitmentHistoryLength <= m.history.length))) &&
    (v.scannerChoice === undefined || v.scannerChoice === 'deepseatooth' || v.scannerChoice === 'deepseascale') &&
    (v.draftTypeCovered === undefined || typeof v.draftTypeCovered === 'boolean')
}

function set(v: unknown): boolean {
  return object(v) && text(v.species) && text(v.nameEs) && text(v.item) && text(v.ability) && text(v.nature) &&
    count(v.level) && v.level > 0 && v.level <= 100 && stats(v.ivs) && stats(v.evs) &&
    list(v.moves) && v.moves.length > 0 && v.moves.length <= 4 &&
    (v.gender === undefined || v.gender === 'M' || v.gender === 'F') &&
    (v.happiness === undefined || (count(v.happiness) && v.happiness <= 255))
}

function init(v: unknown): boolean {
  return object(v) && text(v.battleSeed) && v.generation === 3 && (v.ai === 'heuristic' || v.ai === 'trivial') &&
    count(v.maxTurns) && v.maxTurns > 0 && Array.isArray(v.player) && v.player.length > 0 && v.player.length <= 6 && v.player.every(set) &&
    Array.isArray(v.rival) && v.rival.length > 0 && v.rival.length <= 6 && v.rival.every(set) &&
    (v.playerLead === undefined || (count(v.playerLead) && v.playerLead < v.player.length))
}

function battle(v: unknown): boolean {
  if (!object(v) || !object(v.source) || !object(v.source.preparation)) return false
  const source = v.source, prep = source.preparation as Record<string, unknown>
  if (!state(source.state) || !list(prep.unlockedMoves) || !object(prep.movesByMember) ||
    !Object.values(prep.movesByMember).every(list) || (prep.leadId !== undefined && !text(prep.leadId)) ||
    (source.selected !== undefined && !list(source.selected))) return false
  if (!(v.init === null || init(v.init)) || !Array.isArray(v.decisions) || !v.decisions.every(d => object(d) &&
    (d.type === 'forfeit' || ((d.type === 'move' || d.type === 'switch') && count(d.slot) && d.slot > 0)))) return false
  if (v.init === null) return v.decisions.length === 0 && v.checkpoint === null
  const cp = v.checkpoint
  return cp === null || (object(cp) && count(cp.decisions) && cp.decisions <= v.decisions.length && object(cp.update) &&
    list(cp.update.lines) && object(cp.update.view) && count(cp.update.view.turn) &&
    object(cp.update.view.player) && Array.isArray(cp.update.view.player.team) &&
    object(cp.update.view.rival) && Array.isArray(cp.update.view.rival.team) &&
    (cp.update.request === null || object(cp.update.request)))
}

/** Valida la forma local; el worker verifica la preparación, la identidad y la reproducción completas. */
export function validCampaignRecord(v: unknown): v is CampaignRecord {
  if (!object(v) || v.version !== 1 || !count(v.revision) || v.revision < 1 || !state(v.state)) return false
  if (v.battle === null) return (v.state as Record<string, unknown>).phase !== 'battle'
  if (!battle(v.battle)) return false
  const saved = v.battle as Record<string, unknown>
  const current = v.state as Record<string, unknown>
  return saved.init === null ? current.phase === 'prepare' : current.phase === 'battle' &&
    current.battleSeed === (saved.init as Record<string, unknown>).battleSeed
}
