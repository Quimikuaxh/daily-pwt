import type { Prng } from '../../core/prng'
import { damageOrZero, type DamageField, type DamageSide } from '../damage'
import { moveInfo, speciesTypes, typeMultiplier, type BoostId, type MoveInfo, type StatusId } from './moveInfo'
import type { AiMon, AiState, Choice } from './state'

/** Semilla del PRNG de la IA: propia, para no consumir nunca el del simulador. */
export const aiSeed = (battleSeed: string): string => `${battleSeed}:ai`

// Umbrales de "es razonable" (PRD §9 regla 3). Se ajustan con la calibración de F2.
/** Un ataque que quita menos de esto de los PS del rival no basta: se prefiere otra cosa. */
const WEAK_ATTACK_FRACTION = 0.2
/** Una mejora (Danza Espada...) vale la pena si el mejor ataque no pasa de esta fracción de los PS del rival. */
const SETUP_ATTACK_LIMIT = 0.35
/** Clima y trampas se ponen salvo que ya se pueda debilitar al rival en dos golpes. */
const SETUP_TERRAIN_ATTACK_LIMIT = 0.5
/** Con menos PS que esta fracción del máximo se prefiere curarse (si el rival no quita más de lo que se cura). */
const HEAL_BELOW_FRACTION = 0.5
const MAX_USEFUL_BOOST = 2
const MIN_FOE_HP_FRACTION_FOR_STATUS = 0.25
const MIN_BENCH_FOR_HAZARDS = 2
const MAX_LAYERS = { stealthrock: 1, spikes: 3, toxicspikes: 2 } as const

const STATUS_IMMUNE_TYPES: Record<StatusId, readonly string[]> = {
  par: [],
  brn: ['Fire'],
  slp: [],
  psn: ['Poison', 'Steel'],
  tox: ['Poison', 'Steel'],
  frz: ['Ice'],
}
const STATUS_IMMUNE_ABILITIES: Record<StatusId, readonly string[]> = {
  par: ['limber'],
  // Absorbe Fuego: Fuego Fatuo (tipo Fuego) no le afecta.
  brn: ['waterveil', 'flashfire'],
  slp: ['insomnia', 'vitalspirit'],
  psn: ['immunity'],
  tox: ['immunity'],
  frz: ['magmaarmor'],
}

type Candidate = { slot: number; move: AiMon['moves'][number]; info: MoveInfo }
type AttackOption = Candidate & { min: number; max: number; expected: number }

const asDamageSide = (mon: AiMon): DamageSide => ({
  set: mon.set,
  hp: mon.hp,
  boosts: mon.boosts,
  status: mon.status,
})

/** Robustez y Banda Focus dejan a 1 PS a quien está a PS completos: un golpe suficiente no basta para el KO. */
function survivesAnyOneHit(mon: AiMon): boolean {
  return mon.hp >= mon.maxHp && (mon.set.ability === 'sturdy' || mon.set.item === 'focussash')
}

const hasPp = (move: AiMon['moves'][number]): boolean => !move.disabled && move.pp > 0

function activeFoe(state: AiState): AiMon {
  const [active] = state.foe.pokemon
  if (!active.fainted) return active
  return state.foe.pokemon.find((mon) => !mon.fainted) ?? active
}

function attackOption(candidate: Candidate, attacker: AiMon, defender: AiMon, field: DamageField): AttackOption {
  const range = damageOrZero(asDamageSide(attacker), asDamageSide(defender), candidate.move.id, field)
  // Dos turnos o recarga: el golpe llega, pero cuesta otro turno.
  const turnCost = candidate.info.twoTurn || candidate.info.recharge ? 2 : 1
  const expected = (((range.min + range.max) / 2) * candidate.info.accuracy) / turnCost
  return { ...candidate, min: range.min, max: range.max, expected }
}

/** El mayor daño que `attacker` puede hacer a `defender` con cualquiera de sus movimientos (en PS, sin crítico). */
function strongestHit(attacker: AiMon, defender: AiMon, field: DamageField): number {
  let strongest = 0
  for (const move of attacker.moves) {
    const info = moveInfo(move.id)
    if (info.kind !== 'attack') continue
    strongest = Math.max(strongest, damageOrZero(asDamageSide(attacker), asDamageSide(defender), move.id, field).max)
  }
  return strongest
}

function bestExpectedHit(attacker: AiMon, defender: AiMon, field: DamageField): number {
  let best = 0
  for (const move of attacker.moves) {
    const info = moveInfo(move.id)
    if (info.kind !== 'attack') continue
    best = Math.max(best, attackOption({ slot: 0, move, info }, attacker, defender, field).expected)
  }
  return best
}

/** Positivo si `candidate` lleva ventaja sobre `foe`: fracción de PS que quita menos la que pierde. */
function matchupScore(candidate: AiMon, foe: AiMon, field: DamageField): number {
  const dealt = Math.min(1, bestExpectedHit(candidate, foe, field) / Math.max(1, foe.hp))
  const taken = Math.min(1, bestExpectedHit(foe, candidate, field) / Math.max(1, candidate.hp))
  return dealt - taken
}

function bestBy<T>(items: readonly T[], score: (item: T) => number, rng: Prng): T {
  const scores = items.map(score)
  const top = Math.max(...scores)
  return rng.pick(items.filter((_, index) => Math.abs(scores[index] - top) < 1e-9))
}

function livingBench(state: AiState): { mon: AiMon; slot: number }[] {
  return state.self.pokemon
    .map((mon, index) => ({ mon, slot: index + 1 }))
    .filter(({ mon }, index) => index > 0 && !mon.fainted)
}

// Regla 5: sucesor por mejor emparejamiento.
function chooseSuccessor(state: AiState, rng: Prng): Choice {
  const bench = livingBench(state)
  if (bench.length === 0) return { type: 'switch', slot: 2 }
  const field = { weather: state.weather }
  const foe = activeFoe(state)
  const best = bestBy(bench, ({ mon }) => matchupScore(mon, foe, field), rng)
  return { type: 'switch', slot: best.slot }
}

function canInflict(status: StatusId, move: MoveInfo, foe: AiMon): boolean {
  if (foe.status !== null || foe.fainted) return false
  if (foe.hp < foe.maxHp * MIN_FOE_HP_FRACTION_FOR_STATUS) return false
  if (STATUS_IMMUNE_ABILITIES[status].includes(foe.set.ability)) return false
  if (speciesTypes(foe.set.species).some((type) => STATUS_IMMUNE_TYPES[status].includes(type))) return false
  return move.ignoresImmunity || typeMultiplier(move.type, foe.set.species) > 0
}

function hasMoveOfCategory(mon: AiMon, category: 'Physical' | 'Special'): boolean {
  return mon.moves.some((move) => moveInfo(move.id).category === category)
}

function setupIsUseful(move: MoveInfo, me: AiMon): boolean {
  const boosts = Object.entries(move.boosts ?? {}) as [BoostId, number][]
  return boosts.some(([stat, amount]) => {
    if (amount <= 0 || stat === 'accuracy' || stat === 'evasion') return false
    if (stat === 'atk' && !hasMoveOfCategory(me, 'Physical')) return false
    if (stat === 'spa' && !hasMoveOfCategory(me, 'Special')) return false
    return (me.boosts[stat] ?? 0) < MAX_USEFUL_BOOST
  })
}

function hazardIsUseful(move: MoveInfo, state: AiState): boolean {
  const benchSize = state.foe.pokemon.filter((mon, index) => index > 0 && !mon.fainted).length
  if (benchSize < MIN_BENCH_FOR_HAZARDS) return false
  const layers = state.foe.hazards?.[move.hazard!] ?? 0
  return layers < MAX_LAYERS[move.hazard!]
}

/** ¿Tiene sentido ahora este movimiento que no es de daño? (regla 3). */
function nonDamageMoveApplies(info: MoveInfo, state: AiState, me: AiMon, foe: AiMon): boolean {
  switch (info.kind) {
    case 'weather':
      return state.weather === null
    case 'inflictStatus':
      return canInflict(info.status!, info, foe)
    case 'setup':
      return setupIsUseful(info, me)
    case 'heal':
      return me.hp < me.maxHp
    case 'hazard':
      return hazardIsUseful(info, state)
    default:
      return false
  }
}

// Regla 4: cambiar ante clara desventaja.
function chooseEscape(state: AiState, me: AiMon, foe: AiMon, rng: Prng): Choice | null {
  const field = { weather: state.weather }
  const threats = foe.moves.filter((move) => {
    if (moveInfo(move.id).kind !== 'attack') return false
    return damageOrZero(asDamageSide(foe), asDamageSide(me), move.id, field).max >= me.hp
  })
  const resistsEveryThreat = (candidate: AiMon): boolean => {
    const survivesHit = strongestHit(foe, candidate, field) < candidate.hp
    const resists = threats.every((threat) => {
      const info = moveInfo(threat.id)
      return typeMultiplier(info.type, candidate.set.species) < 1 ||
        damageOrZero(asDamageSide(foe), asDamageSide(candidate), threat.id, field).max === 0
    })
    return survivesHit && resists
  }
  const resistant = livingBench(state).filter(({ mon }) => resistsEveryThreat(mon))
  if (resistant.length === 0) return null
  const best = bestBy(resistant, ({ mon }) => matchupScore(mon, foe, field), rng)
  return { type: 'switch', slot: best.slot }
}

/**
 * Decisión del rival (PRD §9, RF-50): función pura de (estado, rng). Toda la aleatoriedad sale del `rng` recibido.
 * Orden: 1) KO garantizado más preciso; 4) cambio ante desventaja clara; curarse; 3) clima, trampas, estado y
 * mejoras cuando el ataque no basta y es seguro; 2) mayor daño esperado.
 */
export function chooseRivalAction(state: AiState, rng: Prng): Choice {
  if (state.self.mustSwitch) return chooseSuccessor(state, rng)

  const me = state.self.pokemon[0]
  const foe = activeFoe(state)
  const field = { weather: state.weather }

  const usable: Candidate[] = me.moves
    .map((move, index) => ({ slot: index + 1, move, info: moveInfo(move.id) }))
    .filter(({ move }) => hasPp(move))
  if (usable.length === 0) return { type: 'move', slot: 1 }

  const attacks = usable.filter(({ info }) => info.kind === 'attack').map((candidate) => attackOption(candidate, me, foe, field))
  const reliableAttacks = attacks.filter(({ info }) => !info.unreliable)
  const choiceOf = (candidate: Candidate): Choice => ({ type: 'move', slot: candidate.slot })

  // Regla 1: KO garantizado (sin crítico) con más precisión. Los de dos turnos no llegan a tiempo, los poco fiables (Sorpresa...)
  // pueden fallar y no cuentan, y Robustez o Banda Focus a PS completos impiden el KO; los suicidas, solo si no hay otro.
  const guaranteedKos = survivesAnyOneHit(foe)
    ? []
    : attacks.filter(({ min, info }) => min > 0 && min >= foe.hp && !info.twoTurn && !info.unreliable)
  const nonSuicideKos = guaranteedKos.filter(({ info }) => !info.suicide)
  const koPool = nonSuicideKos.length > 0 ? nonSuicideKos : guaranteedKos
  if (koPool.length > 0) {
    const topAccuracy = Math.max(...koPool.map(({ info }) => info.accuracy))
    return choiceOf(rng.pick(koPool.filter(({ info }) => info.accuracy === topAccuracy)))
  }

  const foeStrongestHit = strongestHit(foe, me, field)
  const facesKo = foeStrongestHit >= me.hp
  const applicable = usable.filter(({ info }) => nonDamageMoveApplies(info, state, me, foe))
  const bestAttack = reliableAttacks.reduce<AttackOption | null>((best, option) => (!best || option.expected > best.expected ? option : best), null)
  const hasUsefulMove = applicable.length > 0 || attacks.some(({ max }) => max > 0)

  // Regla 4.
  if (facesKo && !state.self.trapped && !hasUsefulMove) {
    const escape = chooseEscape(state, me, foe, rng)
    if (escape) return escape
  }

  const attackFraction = bestAttack ? bestAttack.expected / Math.max(1, foe.hp) : 0

  const heals = applicable.filter(({ info }) => info.kind === 'heal')
  if (heals.length > 0 && me.hp <= me.maxHp * HEAL_BELOW_FRACTION && foeStrongestHit < me.maxHp * HEAL_BELOW_FRACTION) {
    return choiceOf(rng.pick(heals))
  }

  // Regla 3. Clima y trampas valen aunque nos vayan a debilitar si el ataque no sirve de nada; estado y mejoras, solo si sobrevivimos.
  const ofKind = (...kinds: MoveInfo['kind'][]) => applicable.filter(({ info }) => kinds.includes(info.kind))
  const terrainLimit = facesKo ? WEAK_ATTACK_FRACTION : SETUP_TERRAIN_ATTACK_LIMIT
  const terrain = attackFraction < terrainLimit ? ofKind('weather', 'hazard') : []
  if (terrain.length > 0) return choiceOf(rng.pick(terrain))
  if (!facesKo && attackFraction < WEAK_ATTACK_FRACTION) {
    const statusMoves = ofKind('inflictStatus')
    if (statusMoves.length > 0) return choiceOf(rng.pick(statusMoves))
  }
  const canAffordSetup = !facesKo && foeStrongestHit * 2 < me.hp
  if (canAffordSetup && attackFraction < SETUP_ATTACK_LIMIT) {
    const setupMoves = ofKind('setup')
    if (setupMoves.length > 0) return choiceOf(rng.pick(setupMoves))
  }

  // Regla 2: mayor daño esperado. Los suicidas y los poco fiables solo entran si no hay otra cosa.
  const withDamage = attacks.filter(({ expected }) => expected > 0)
  const preferred = [
    withDamage.filter(({ info }) => !info.suicide && !info.unreliable),
    withDamage.filter(({ info }) => !info.suicide),
    withDamage,
  ].find((pool) => pool.length > 0)
  if (preferred) {
    const topExpected = Math.max(...preferred.map(({ expected }) => expected))
    return choiceOf(rng.pick(preferred.filter(({ expected }) => Math.abs(expected - topExpected) < 1e-9)))
  }

  // Nada daña: cualquier ataque antes que un movimiento de estado que no aplica.
  const fallback = [attacks, usable.filter(({ info }) => info.kind === 'other'), applicable, usable].find((pool) => pool.length > 0)!
  return choiceOf(rng.pick(fallback))
}
