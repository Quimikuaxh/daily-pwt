import type { NamesEs, TrainerGender } from '../core/types'
import { es } from '../i18n/es'
import { toId } from '../core/id'

export type TranslateContext = {
  names: NamesEs
  trainer: { nameEs: string; category: 'leader' | 'champion'; gender: TrainerGender }
}

type Fields = { type: string; args: string[]; tags: Map<string, string> }

const log = es.log

// Tipos de línea del simulador que no se muestran (protocolo, cabeceras y mensajes del propio sim en inglés).
const SILENT_TYPES = new Set([
  '', 'upkeep', 't:', 'player', 'teamsize', 'gametype', 'gen', 'tier', 'start', 'rule', 'clearpoke', 'poke', 'teampreview',
  'request', 'rated', 'inactive', 'inactiveoff', 'split', 'raw', 'debug', 'html', 'uhtml', 'uhtmlchange', 'error',
  '-message', '-hint', '-anim', '-sethp', 'swap', 'replace', '-fieldactivate', '-center', '-combine',
  '-waiting', '-nothing', '-endability', '-burst', '-primal', '-mega', '-zpower', '-zbroken', 'c', 'c:', 'chat', 'j', 'l', 'n',
])


function parseLine(line: string): Fields {
  const [, type = '', ...rest] = line.split('|')
  const args: string[] = []
  const tags = new Map<string, string>()
  for (const part of rest) {
    const tag = /^\[(\w+)\]\s*(.*)$/.exec(part)
    if (tag) tags.set(tag[1], tag[2])
    else args.push(part)
  }
  return { type, args, tags }
}

function lookup(table: Record<string, string>, name: string | undefined): string | undefined {
  return name ? table[toId(name)] : undefined
}

/** "move: Stealth Rock" / "ability: Intimidate" / "Stealth Rock" -> nombre en español del efecto, o undefined. */
function effectName(ctx: TranslateContext, text: string | undefined): string | undefined {
  if (!text) return undefined
  const prefixed = /^(move|ability|item):\s*(.*)$/.exec(text)
  const name = prefixed ? prefixed[2] : text
  const tables = prefixed ? [prefixed[1] === 'move' ? ctx.names.moves : prefixed[1] === 'item' ? ctx.names.items : ctx.names.abilities]
    : [ctx.names.moves, ctx.names.abilities, ctx.names.items]
  for (const table of tables) {
    const found = lookup(table, name)
    if (found) return found
  }
  return undefined
}

const moveName = (ctx: TranslateContext, name: string | undefined): string => lookup(ctx.names.moves, name) ?? log.unknownMove
const itemName = (ctx: TranslateContext, name: string | undefined): string => lookup(ctx.names.items, name) ?? log.unknownItem
const abilityName = (ctx: TranslateContext, name: string | undefined): string => lookup(ctx.names.abilities, name) ?? log.unknownAbility

type MonRef = { isRival: boolean; name: string }

/** "p2a: Starmie" -> el Pokémon rival "Starmie". */
function parseMon(ref: string | undefined): MonRef | null {
  const match = /^p([12])[a-c]?: (.*)$/.exec(ref ?? '')
  return match ? { isRival: match[1] === '2', name: match[2] } : null
}

function monText(ctx: TranslateContext, ref: string | undefined): string {
  const mon = parseMon(ref)
  if (!mon) return log.unknownMon
  const species = lookup(ctx.names.species, mon.name) ?? mon.name
  return mon.isRival ? log.rivalMon(species, ctx.trainer.nameEs) : species
}

const teamText = (ref: string | undefined): string => (/^p2/.test(ref ?? '') ? log.rivalTeam : log.yourTeam)

const statusKey = (status: string | undefined): keyof typeof log.statusInflicted | null =>
  status && status in log.statusInflicted ? (status as keyof typeof log.statusInflicted) : null

function translateDamage(f: Fields, ctx: TranslateContext): string | null {
  const mon = monText(ctx, f.args[0])
  const source = f.tags.get('from')
  if (!source || f.tags.has('silent')) return null
  const prefixed = /^(item|ability|move):\s*(.*)$/.exec(source)
  if (prefixed?.[1] === 'item') return log.damageFromItem(mon, itemName(ctx, prefixed[2]))
  if (prefixed?.[1] === 'ability') return log.damageFromAbility(mon, abilityName(ctx, prefixed[2]))
  const id = toId(prefixed ? prefixed[2] : source)
  const known = (log.damageSources as Record<string, (mon: string) => string>)[id]
  return known ? known(mon) : null
}

function translateHeal(f: Fields, ctx: TranslateContext): string | null {
  if (f.tags.has('silent')) return null
  const mon = monText(ctx, f.args[0])
  const source = f.tags.get('from')
  if (!source) return log.healed(mon)
  const prefixed = /^(item|ability|move):\s*(.*)$/.exec(source)
  if (prefixed?.[1] === 'item') return log.healedByItem(mon, itemName(ctx, prefixed[2]))
  if (prefixed?.[1] === 'ability') return log.healedByAbility(mon, abilityName(ctx, prefixed[2]))
  const id = toId(prefixed ? prefixed[2] : source)
  if (id === 'drain') return log.drained(monText(ctx, f.tags.get('of') ?? f.args[0]))
  if (id === 'wish') return log.wishCameTrue(mon)
  return log.healed(mon)
}

function translateBoost(f: Fields, ctx: TranslateContext, direction: 'up' | 'down'): string | null {
  const mon = monText(ctx, f.args[0])
  const stat = (log.statLabels as Record<string, string>)[f.args[1]]
  if (!stat) return null
  const stages = Number(f.args[2]) || 1
  // Bayas que suben una característica (Aslac, Lichi…): el mensaje dice que ha sido la baya (decisión de Jose). Su `-enditem [eat]` no se enseña.
  const from = f.tags.get('from') ?? ''
  const berry = direction === 'up' && /^item:/.test(from) && toId(from.replace(/^item:\s*/, '')).endsWith('berry')
  if (berry) return log.berryStatRose(itemName(ctx, from.replace(/^item:\s*/, '')), stat, mon, stages)
  return direction === 'up' ? log.statRose(stat, mon, stages) : log.statFell(stat, mon, stages)
}

function translateWeather(f: Fields): string | null {
  const weather = toId(f.args[0] ?? '')
  if (weather === 'none' || weather === '') return log.weatherEnded[toId(f.tags.get('previous') ?? '') as keyof typeof log.weatherEnded] ?? log.weatherCleared
  const started = log.weatherStarted[weather as keyof typeof log.weatherStarted]
  if (!started) return log.weatherCleared
  return f.tags.has('upkeep') ? log.weatherContinues[weather as keyof typeof log.weatherContinues] : started
}

function translateCant(f: Fields, ctx: TranslateContext): string {
  const mon = monText(ctx, f.args[0])
  const reason = f.args[1] ?? ''
  const known = (log.cantMove as Record<string, (mon: string) => string>)[toId(reason)]
  if (known) return known(mon)
  const prefixed = /^move:\s*(.*)$/.exec(reason)
  if (toId(reason) === 'taunt' || (prefixed && toId(prefixed[1]) === 'taunt')) return log.cantMoveTaunt(mon, moveName(ctx, f.args[2]))
  return log.cantMoveFallback(mon)
}

function translateStart(f: Fields, ctx: TranslateContext): string | null {
  const mon = monText(ctx, f.args[0])
  const effect = f.args[1] ?? ''
  const id = toId(effect.replace(/^(move|ability|item):\s*/, ''))
  if (id === 'confusion') return f.tags.has('silent') ? null : log.confused(mon)
  if (id === 'substitute') return log.substituteCreated(mon)
  const named = effectName(ctx, effect)
  return named ? log.effectStarted(mon, named) : null
}

function translateEnd(f: Fields, ctx: TranslateContext): string | null {
  const mon = monText(ctx, f.args[0])
  const effect = f.args[1] ?? ''
  const id = toId(effect.replace(/^(move|ability|item):\s*/, ''))
  if (id === 'confusion') return log.confusionEnded(mon)
  if (id === 'substitute') return log.substituteFaded(mon)
  const named = effectName(ctx, effect)
  return named ? log.effectEnded(mon, named) : null
}

function translateActivate(f: Fields, ctx: TranslateContext): string | null {
  const mon = monText(ctx, f.args[0])
  const effect = f.args[1] ?? ''
  const id = toId(effect.replace(/^(move|ability|item):\s*/, ''))
  if (id === 'protect' || id === 'detect') return log.protectedBy(mon, moveName(ctx, id))
  if (id === 'confusion') return log.confusionActive(mon)
  if (id === 'substitute') return f.tags.has('damage') ? log.substituteTookHit(mon) : null
  const named = effectName(ctx, effect)
  return named ? log.effectActivated(mon, named) : null
}

function translateSingleTurn(f: Fields, ctx: TranslateContext): string | null {
  const mon = monText(ctx, f.args[0])
  const id = toId((f.args[1] ?? '').replace(/^move:\s*/, ''))
  if (id === 'protect' || id === 'detect' || id === 'endure') return log.protectedItself(mon)
  if (id === 'focuspunch') return log.bracing(mon)
  return null
}

/**
 * Objetos cuyo `-enditem` (sin etiquetas) va seguido de su propio `-boost [from] item:`: esa línea ya es el mensaje.
 * DEC-36: la desaparición del objeto no se muestra cuando otra línea cuenta lo que ha hecho.
 */
const ITEMS_ANNOUNCED_BY_BOOST = new Set([
  'absorbbulb', 'cellbattery', 'luminousmoss', 'snowball', 'adrenalineorb', 'roomservice', 'throatspray',
  'weaknesspolicy', 'mirrorherb', 'blunderpolicy',
])

const SELF_USE_MESSAGES: Record<string, (mon: string, item: string) => string> = {
  focussash: log.focusSashHeld,
  whiteherb: log.whiteHerbRestored,
  powerherb: log.powerHerbCharged,
  airballoon: log.airBalloonPopped,
}

/**
 * Solo se muestra el `-enditem` cuando es la única noticia: objeto quitado por otro (con `[from]`) o gastado sin
 * otra línea que lo cuente. Se descartan `[eat]` (el efecto de la baya llega en la línea siguiente), `[silent]`
 * (lo cuenta el `-item`/`-activate` de Ladrón, Truco, Antihurto...) y los objetos con `-boost [from] item:`.
 */
function translateEndItem(f: Fields, ctx: TranslateContext): string | null {
  if (f.tags.has('eat') || f.tags.has('silent')) return null
  const mon = monText(ctx, f.args[0])
  const itemId = toId(f.args[1] ?? '')
  const item = itemName(ctx, f.args[1])
  if (f.tags.has('weaken')) return log.itemWeakenedHit(mon, item)
  const source = f.tags.get('from')
  if (source === 'gem') return log.gemBoosted(mon, item)
  if (source) return log.itemLost(mon, item)
  if (ITEMS_ANNOUNCED_BY_BOOST.has(itemId)) return null
  return (SELF_USE_MESSAGES[itemId] ?? log.itemSpent)(mon, item)
}

function translateKnownLine(f: Fields, ctx: TranslateContext): string | null | undefined {
  const first = f.args[0]
  switch (f.type) {
    case 'move':
      return log.moveUsed(monText(ctx, first), moveName(ctx, f.args[1]))
    case 'switch': {
      const mon = parseMon(first)
      if (!mon?.isRival) return log.playerSends(monText(ctx, first))
      return log.rivalSwitchIn(ctx.trainer.nameEs, lookup(ctx.names.species, mon.name) ?? mon.name)
    }
    case 'drag':
      return parseMon(first)?.isRival ? log.rivalDragged(monText(ctx, first)) : log.playerDragged(monText(ctx, first))
    case 'faint':
      return log.fainted(monText(ctx, first))
    case '-damage':
      return translateDamage(f, ctx)
    case '-heal':
      return translateHeal(f, ctx)
    case '-supereffective':
      return log.superEffective
    case '-resisted':
      return log.notVeryEffective
    case '-crit':
      return log.critical
    case '-miss':
      return log.missed(monText(ctx, first))
    case '-immune': {
      const from = f.tags.get('from')
      const ability = from && /^ability:/.test(from) ? abilityName(ctx, from.replace(/^ability:\s*/, '')) : null
      const mon = monText(ctx, first)
      return ability ? log.immuneByAbility(mon, ability) : log.noEffect(mon)
    }
    case '-fail':
      return log.failed
    case '-notarget':
      return log.noTarget
    case '-ohko':
      return log.oneHitKo
    case '-hitcount':
      return log.hitCount(Number(f.args[1]) || 1)
    case '-status': {
      const key = statusKey(f.args[1])
      return key ? log.statusInflicted[key](monText(ctx, first)) : null
    }
    case '-curestatus': {
      const key = statusKey(f.args[1])
      return key ? log.statusCured[key](monText(ctx, first)) : log.statusCuredFallback(monText(ctx, first))
    }
    case '-cureteam':
      return log.teamStatusCured
    case '-boost':
      return translateBoost(f, ctx, 'up')
    case '-unboost':
      return translateBoost(f, ctx, 'down')
    case '-setboost': {
      const stat = (log.statLabels as Record<string, string>)[f.args[1]]
      return stat ? log.statMaxed(stat, monText(ctx, first)) : null
    }
    case '-clearboost':
      return log.boostsReset(monText(ctx, first))
    case '-clearnegativeboost':
      return log.negativeBoostsReset(monText(ctx, first))
    case '-clearallboost':
      return log.allBoostsReset
    case '-copyboost':
      return log.boostsCopied(monText(ctx, first))
    case '-swapboost':
      return log.boostsSwapped(monText(ctx, first))
    case '-invertboost':
      return log.boostsInverted(monText(ctx, first))
    case '-weather':
      return translateWeather(f)
    case '-ability':
      return f.tags.has('silent') ? null : log.abilityActivated(monText(ctx, first), abilityName(ctx, f.args[1]))
    case '-block':
      return log.abilityBlocks(monText(ctx, first), effectName(ctx, f.args[1]) ?? log.unknownAbility)
    case '-item':
      return log.itemObtained(monText(ctx, first), itemName(ctx, f.args[1]))
    case '-enditem':
      return translateEndItem(f, ctx)
    case 'cant':
      return translateCant(f, ctx)
    case '-mustrecharge':
      return log.mustRecharge(monText(ctx, first))
    case 'turn':
      return log.turn(Number(first))
    case 'win':
      return first === 'Jugador' ? log.playerWon : log.rivalWon(ctx.trainer.nameEs)
    case 'tie':
      return log.tie
    case '-start':
      return translateStart(f, ctx)
    case '-end':
      return translateEnd(f, ctx)
    case '-activate':
      return translateActivate(f, ctx)
    case '-prepare':
      return log.preparing(monText(ctx, first), moveName(ctx, f.args[1]))
    case '-singleturn':
      return translateSingleTurn(f, ctx)
    case '-singlemove':
      return toId(f.args[1] ?? '') === 'destinybond' ? log.destinyBond(monText(ctx, first)) : null
    case '-sidestart':
    case '-sideend': {
      const effect = effectName(ctx, f.args[1])
      if (!effect) return null
      return f.type === '-sidestart' ? log.sideEffectStarted(effect, teamText(first)) : log.sideEffectEnded(effect, teamText(first))
    }
    case '-fieldstart':
    case '-fieldend': {
      const effect = effectName(ctx, f.args[0])
      if (!effect) return null
      return f.type === '-fieldstart' ? log.fieldEffectStarted(effect) : log.fieldEffectEnded(effect)
    }
    case '-transform': {
      const target = parseMon(f.args[1])
      const species = target ? lookup(ctx.names.species, target.name) ?? target.name : monText(ctx, f.args[1])
      return log.transformed(monText(ctx, first), species)
    }
    case '-formechange':
    case 'detailschange':
      return log.formChanged(monText(ctx, first))
    default:
      return undefined
  }
}

/** Traduce una línea del registro del simulador. `null` = sin texto (protocolo, barras de PS, descartada). Nunca devuelve inglés ni ids. */
export function translateLine(line: string, ctx: TranslateContext): string | null {
  const fields = parseLine(line)
  if (SILENT_TYPES.has(fields.type)) return null
  const known = translateKnownLine(fields, ctx)
  return known === undefined ? log.generic : known
}

export function translateLines(lines: string[], ctx: TranslateContext): string[] {
  return lines.flatMap((line) => {
    const text = translateLine(line, ctx)
    return text === null ? [] : [text]
  })
}

/** Las tres líneas de apertura (RF-53). Sustituyen a las líneas `|switch|` iniciales del registro, que la UI no debe traducir además. */
export function introLines(options: {
  trainer: TranslateContext['trainer']
  rivalLead: string
  playerLead: string
}): string[] {
  const { trainer } = options
  const title = log.trainerTitle[trainer.category][trainer.gender]
  return [
    log.challenge(title, trainer.nameEs),
    log.trainerSends(trainer.nameEs, options.rivalLead),
    log.playerSends(options.playerLead),
  ]
}
