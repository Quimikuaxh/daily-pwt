import type { BattleView, MonView, SideView } from './protocol'
import { isFaintedCondition } from './condition'
import { toId } from '../core/id'

export type ViewAction = { type: 'lines'; lines: string[] } | { type: 'snapshot'; view: BattleView }


/** Porcentaje que muestra el simulador al rival (HP Percentage Mod): nunca 0 si vive, nunca 100 si le falta algo. */
export function hpPercentOf(hp: number, maxHp: number): number {
  if (hp <= 0) return 0
  const percent = Math.ceil((100 * hp) / maxHp)
  return percent === 100 && hp < maxHp ? 99 : percent
}

type Condition = { hp: number; maxHp: number; fainted: boolean; status: string | null }

/** "183/183", "40/100 par" o "0 fnt". */
function parseCondition(text: string | undefined): Condition | null {
  if (!text) return null
  const match = /^(\d+)(?:\/(\d+))?(?: (\w+))?/.exec(text.trim())
  if (!match) return null
  if (isFaintedCondition(text)) return { hp: 0, maxHp: Number(match[2] ?? 0), fainted: true, status: null }
  return { hp: Number(match[1]), maxHp: Number(match[2] ?? 0), fainted: false, status: match[3] ?? null }
}

type Target = { side: 'player' | 'rival'; name: string }

/** "p2a: Snorlax" -> rival, snorlax. */
function parseTarget(text: string | undefined): Target | null {
  const match = /^p([12])[a-c]?: (.*)$/.exec(text ?? '')
  if (!match) return null
  return { side: match[1] === '1' ? 'player' : 'rival', name: toId(match[2]) }
}

function indexOfMon(side: SideView, speciesId: string, preferBench: boolean): number {
  const matches = side.team.flatMap((mon, index) => (mon.species === speciesId ? [index] : []))
  if (matches.length <= 1) return matches[0] ?? -1
  const alive = matches.filter((index) => !side.team[index].fainted)
  if (preferBench) return alive.find((index) => index !== side.active) ?? alive[0] ?? matches[0]
  return alive.find((index) => index === side.active) ?? alive[0] ?? matches[0]
}

function applyCondition(side: SideView, mon: MonView, condition: Condition, isPlayer: boolean): void {
  mon.fainted = condition.fainted
  if (condition.status) mon.status = condition.status
  if (condition.fainted) mon.status = null
  if (isPlayer) {
    mon.hp = condition.hp
    if (condition.maxHp > 0) mon.maxHp = condition.maxHp
    mon.hpPercent = hpPercentOf(mon.hp, mon.maxHp ?? condition.maxHp)
  } else {
    mon.hpPercent = condition.fainted ? 0 : condition.maxHp === 100 ? condition.hp : hpPercentOf(condition.hp, condition.maxHp || 100)
  }
  side.remaining = side.team.filter((member) => !member.fainted).length
}

function applyLine(view: BattleView, line: string): void {
  const fields = line.split('|')
  const type = fields[1]

  switch (type) {
    case 'turn':
      view.turn = Number(fields[2])
      return
    case '-weather': {
      const weather = toId(fields[2] ?? '')
      view.weather = weather === '' || weather === 'none' ? null : weather
      return
    }
    case 'switch':
    case 'drag': {
      const target = parseTarget(fields[2])
      if (!target) return
      const side = view[target.side]
      const detailsSpecies = toId((fields[3] ?? '').split(',')[0])
      const index = indexOfMon(side, detailsSpecies || target.name, true)
      if (index < 0) return
      side.active = index
      const condition = parseCondition(fields[4])
      if (condition) applyCondition(side, side.team[index], condition, target.side === 'player')
      return
    }
    case 'faint': {
      const target = parseTarget(fields[2])
      if (!target) return
      const side = view[target.side]
      const index = indexOfMon(side, target.name, false)
      if (index < 0) return
      applyCondition(side, side.team[index], { hp: 0, maxHp: 0, fainted: true, status: null }, target.side === 'player')
      return
    }
    case '-damage':
    case '-heal':
    case '-sethp': {
      const target = parseTarget(fields[2])
      const condition = parseCondition(fields[3])
      if (!target || !condition) return
      const side = view[target.side]
      const index = indexOfMon(side, target.name, false)
      if (index < 0) return
      applyCondition(side, side.team[index], condition, target.side === 'player')
      return
    }
    case '-status':
    case '-curestatus': {
      const target = parseTarget(fields[2])
      if (!target) return
      const side = view[target.side]
      const index = indexOfMon(side, target.name, false)
      if (index < 0) return
      side.team[index].status = type === '-status' ? fields[3] ?? null : null
      return
    }
    default:
  }
}

/** Aplica al estado de la vista las líneas del registro (para animar) o lo sustituye por la instantánea autoritativa (DEC-10). Puro. */
export function viewReducer(view: BattleView, action: ViewAction): BattleView {
  if (action.type === 'snapshot') return structuredClone(action.view)
  const next = structuredClone(view)
  for (const line of action.lines) applyLine(next, line)
  return next
}
