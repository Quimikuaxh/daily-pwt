import { gen5 } from './dex.mjs'

/**
 * ¿Tiene sentido un set del PWT en el equipo del jugador? (Jose, 04/11/2026; PRD §0 «Sets del PWT con sinergia», DEC-79). Los de Smogon no
 * se miran: ya son competitivos. Devuelve los motivos por los que no (vacío si vale). Reglas, por orden:
 * 1. Ataques fuertes (70 o más de potencia, de varios golpes, de potencia variable o de daño fijo): al menos 2; o 1 si el set es de muro
 *    (recupera PS y pone un estado o una trampa).
 * 2. De esos, al menos uno de su tipo (o de daño fijo, como Sísmico) y con 90 o más de precisión.
 * 3. Lado: con 30 o más de diferencia entre Ataque y At. Esp. base, como mucho un ataque del lado flojo.
 * 4. Movimientos sin uso en un combate 1 contra 1 a Nv. 50 (Danza Caos, Gruñido, Malicioso…).
 * 5. Movimientos de azar o de relleno que Jose no quiere en su equipo (Doble Equipo, Rayo Confuso, Contoneo, Atracción, Comesueños…).
 * 6. Precisión: no todos sus ataques pueden tener 80 de precisión o menos (Megapatada, Electrocañón…); los que no fallan cuentan como 100.
 */

/** Etiqueta de los sets del PWT que no pasan: el reto no los usa desde `POOL_RULES_FROM` (`src/core/launch.ts`). */
export const NO_SYNERGY_TAG = 'quality:no-synergy'

/** Daño fijo o que no depende de la estadística: valen como ataque de cualquier lado. */
const FIXED_DAMAGE = new Set(['seismictoss', 'nightshade', 'superfang', 'endeavor', 'psywave', 'finalgambit', 'counter', 'mirrorcoat', 'metalburst', 'bide', 'sonicboom', 'dragonrage'])
/** Potencia que depende de algo (peso, PS, felicidad…): cuentan como fuertes. */
const VARIABLE_POWER = new Set(['return', 'frustration', 'gyroball', 'electroball', 'lowkick', 'grassknot', 'heavyslam', 'heatcrash', 'reversal', 'flail', 'eruption', 'waterspout', 'crushgrip', 'wringout', 'storedpower', 'punishment', 'trumpcard', 'naturalgift', 'fling', 'acrobatics', 'hex', 'payback', 'avalanche', 'revenge', 'facade', 'brine', 'venoshock', 'assurance', 'retaliate', 'beatup', 'present', 'magnitude', 'hiddenpower', 'weatherball'])
const RECOVERY = new Set(['recover', 'softboiled', 'milkdrink', 'roost', 'slackoff', 'moonlight', 'morningsun', 'synthesis', 'wish', 'rest', 'healorder', 'leechseed', 'painsplit', 'aquaring', 'ingrain'])
const STATUS_OR_HAZARD = new Set(['toxic', 'willowisp', 'thunderwave', 'glare', 'stunspore', 'spore', 'sleeppowder', 'hypnosis', 'yawn', 'leechseed', 'stealthrock', 'spikes', 'toxicspikes', 'perishsong', 'curse', 'haze', 'whirlwind', 'roar', 'encore', 'taunt'])
const USELESS = new Set(['teeterdance', 'growl', 'tailwhip', 'leer', 'splash', 'focusenergy', 'harden', 'withdraw', 'sandattack', 'smokescreen', 'flash', 'kinesis', 'sweetscent', 'charm', 'featherdance', 'tickle', 'stringshot', 'scaryface', 'cottonspore', 'defensecurl', 'sharpen', 'howl', 'meditate', 'growth', 'odorsleuth', 'foresight', 'miracleeye', 'helpinghand', 'followme', 'ragepowder', 'wideguard', 'quickguard', 'allyswitch', 'afteryou', 'quash', 'mudsport', 'watersport', 'lockon', 'mindreader', 'camouflage', 'conversion', 'conversion2', 'mimic', 'sketch', 'transform', 'celebrate', 'holdhands', 'happyhour'])

const DUBIOUS = new Set(['doubleteam', 'minimize', 'confuseray', 'supersonic', 'swagger', 'flatter', 'attract', 'captivate', 'sweetkiss', 'metronome', 'nightmare', 'sing', 'grasswhistle', 'dreameater'])

const STRONG_POWER = 70
const MIN_STAB_ACCURACY = 90
const SIDE_GAP = 30

export function synergyProblems(set) {
  const species = gen5.species.get(set.species)
  const moves = set.moves.map((id) => gen5.moves.get(id))
  const attacks = moves.filter((move) => move.category !== 'Status')
  const problems = []

  // Fuertes: 70 o más de potencia, de varios golpes (Triple Patada, Carámbano…), de potencia variable o de daño fijo.
  const strong = attacks.filter((move) => FIXED_DAMAGE.has(move.id) || VARIABLE_POWER.has(move.id) || Boolean(move.multihit) || move.basePower >= STRONG_POWER)
  // Muro: recupera PS y pone un estado o una trampa; le basta un ataque fuerte.
  const wall = set.moves.some((id) => RECOVERY.has(id)) && set.moves.some((id) => STATUS_OR_HAZARD.has(id))
  if (strong.length < (wall ? 1 : 2)) problems.push(strong.length === 0 ? 'ningún ataque fuerte' : 'un solo ataque fuerte')

  // De esos, al menos uno de su tipo (o de daño fijo) y con 90 o más de precisión (los que no fallan cuentan como 100).
  const accurate = (move) => move.accuracy === true || move.accuracy >= MIN_STAB_ACCURACY
  if (!strong.some((move) => (FIXED_DAMAGE.has(move.id) || species.types.includes(move.type)) && accurate(move))) problems.push('ningún ataque fuerte y preciso de su tipo')

  const { atk, spa } = species.baseStats
  if (Math.abs(atk - spa) >= SIDE_GAP) {
    const weak = atk > spa ? 'Special' : 'Physical'
    const offSide = attacks.filter((move) => move.category === weak && !FIXED_DAMAGE.has(move.id))
    if (offSide.length > 1) problems.push(`${offSide.length} ataques del lado flojo (${weak === 'Special' ? 'especial' : 'físico'})`)
  }

  const useless = set.moves.filter((id) => USELESS.has(id))
  if (useless.length) problems.push(`movimientos sin uso: ${useless.join(', ')}`)
  const MAX_LOW_ACCURACY = 80
  if (attacks.length > 0 && attacks.every((move) => move.accuracy !== true && move.accuracy <= MAX_LOW_ACCURACY)) problems.push('todos sus ataques con 80 de precisión o menos')
  const dubious = set.moves.filter((id) => DUBIOUS.has(id))
  if (dubious.length) problems.push(`movimientos de azar o de relleno: ${dubious.join(', ')}`)
  return problems
}
