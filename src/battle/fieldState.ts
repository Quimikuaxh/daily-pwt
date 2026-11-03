import { toId } from '../core/id'

/**
 * Estado del campo de la pantalla «Estado» (RF-44b, DEC-78): efectos de todo el campo, de cada lado y de los dos Pokémon en combate, con
 * los turnos que les quedan, y las subidas y bajadas de estadísticas. Lo calcula el motor en cada instantánea (`engine.ts`, autoritativo) y
 * el reductor de la vista lo sigue línea a línea mientras se presenta el turno (`applyFieldLine`), sin turnos hasta la instantánea, como
 * el clima.
 */

/** Un efecto que se enseña: `turns`, los que le quedan (null si no caduca o no se sabe aún); `layers`, capas (Púas, Reserva). */
export type FieldEffect = { id: string; turns: number | null; layers?: number }

export const BOOST_IDS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'] as const
export type BoostId = (typeof BOOST_IDS)[number]
export type Boosts = Partial<Record<BoostId, number>>

/** Lo de un Pokémon en combate: subidas y bajadas (solo las distintas de 0) y sus efectos. */
export type ActiveState = { boosts: Boosts; effects: FieldEffect[] }

export type FieldState = {
  field: FieldEffect[]
  player: FieldEffect[]
  rival: FieldEffect[]
  playerActive: ActiveState
  rivalActive: ActiveState
}

/** Efectos de todo el campo (`pseudoWeather` del simulador). El clima va en la pastilla, no aquí. */
export const FIELD_EFFECTS = ['trickroom', 'gravity', 'magicroom', 'wonderroom', 'mudsport', 'watersport'] as const

/** De un lado (`sideConditions`) y de su hueco (`slotConditions`: Deseo, Premonición…). Las trampas, con capas. */
export const SIDE_EFFECTS = [
  'tailwind', 'reflect', 'lightscreen', 'safeguard', 'mist', 'luckychant', 'spikes', 'toxicspikes', 'stealthrock',
  'wish', 'futuremove', 'healingwish', 'lunardance',
] as const

/** Del Pokémon (`volatiles`). Los de un solo turno (Protección, Rapidez…) no se enseñan. */
export const MON_EFFECTS = [
  'substitute', 'confusion', 'leechseed', 'taunt', 'encore', 'disable', 'yawn', 'perishsong', 'attract', 'curse', 'nightmare',
  'torment', 'embargo', 'healblock', 'magnetrise', 'telekinesis', 'ingrain', 'aquaring', 'focusenergy', 'partiallytrapped',
  'trapped', 'stockpile', 'charge', 'lockon', 'smackdown', 'foresight', 'miracleeye', 'imprison', 'uproar', 'flashfire', 'slowstart',
  'mudsport', 'watersport',
] as const

/**
 * Turnos que se enseñan de cada efecto con duración. La confusión no: el juego no los dice y el simulador los sortea. Los demás que no
 * están aquí (Drenadoras, Sustituto…) duran hasta que se van.
 */
const SHOWS_TURNS = new Set<string>([
  ...FIELD_EFFECTS, 'tailwind', 'reflect', 'lightscreen', 'safeguard', 'mist', 'luckychant', 'wish', 'futuremove',
  'taunt', 'encore', 'disable', 'yawn', 'perishsong', 'embargo', 'healblock', 'magnetrise', 'telekinesis', 'partiallytrapped', 'uproar',
  'slowstart', 'lockon',
])

const LAYERED = new Set<string>(['spikes', 'toxicspikes', 'stockpile'])

export const emptyActive = (): ActiveState => ({ boosts: {}, effects: [] })
export const emptyFieldState = (): FieldState => ({ field: [], player: [], rival: [], playerActive: emptyActive(), rivalActive: emptyActive() })

type SimCondition = { duration?: number; layers?: number; time?: number }

/** Del simulador al estado: solo los efectos de la lista, en su orden, con turnos y capas. */
export function effectsFrom(conditions: Record<string, SimCondition | undefined>, known: readonly string[]): FieldEffect[] {
  return known.flatMap((id) => {
    const condition = conditions[id]
    if (!condition) return []
    const effect: FieldEffect = { id, turns: SHOWS_TURNS.has(id) && condition.duration ? condition.duration : null }
    if (LAYERED.has(id) && condition.layers) effect.layers = condition.layers
    return [effect]
  })
}

export function boostsFrom(boosts: Record<string, number>): Boosts {
  const out: Boosts = {}
  for (const id of BOOST_IDS) if (boosts[id]) out[id] = boosts[id]
  return out
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Seguir el registro entre instantáneas
// ---------------------------------------------------------------------------------------------------------------------------------

const sideOf = (text: string | undefined): 'player' | 'rival' | null => (/^p1/.test(text ?? '') ? 'player' : /^p2/.test(text ?? '') ? 'rival' : null)
/** «move: Trick Room», «Spikes», «confusion» -> id. */
const effectId = (text: string | undefined): string => toId((text ?? '').replace(/^(move|ability|item):\s*/i, ''))
const clamp = (value: number) => Math.max(-6, Math.min(6, value))

function setBoost(active: ActiveState, stat: string, value: number): void {
  if (!(BOOST_IDS as readonly string[]).includes(stat)) return
  const id = stat as BoostId
  if (value === 0) delete active.boosts[id]
  else active.boosts[id] = clamp(value)
}

function addEffect(list: FieldEffect[], id: string, known: readonly string[]): void {
  if (!known.includes(id)) return
  const current = list.find((effect) => effect.id === id)
  if (current) {
    if (LAYERED.has(id)) current.layers = (current.layers ?? 1) + 1
    return
  }
  list.push(LAYERED.has(id) ? { id, turns: null, layers: 1 } : { id, turns: null })
  // Mismo orden que en la instantánea.
  list.sort((a, b) => known.indexOf(a.id) - known.indexOf(b.id))
}

function removeEffect(list: FieldEffect[], id: string): void {
  const index = list.findIndex((effect) => effect.id === id)
  if (index >= 0) list.splice(index, 1)
}

/**
 * Aplica una línea del protocolo al estado (puro sobre la copia que le pasa `viewReducer`). Los turnos de lo nuevo llegan con la
 * instantánea del final del update. Al entrar otro Pokémon se vacía lo de ese lado (Relevo lo devuelve la instantánea).
 */
export function applyFieldLine(state: FieldState, line: string): void {
  const fields = line.split('|')
  const type = fields[1]
  const side = sideOf(fields[2])
  const active = side === 'player' ? state.playerActive : side === 'rival' ? state.rivalActive : null
  switch (type) {
    case 'switch':
    case 'drag':
      if (side) state[side === 'player' ? 'playerActive' : 'rivalActive'] = emptyActive()
      return
    case '-boost':
    case '-unboost': {
      if (!active) return
      const amount = Number(fields[4] ?? 0) * (type === '-boost' ? 1 : -1)
      setBoost(active, fields[3] ?? '', (active.boosts[fields[3] as BoostId] ?? 0) + amount)
      return
    }
    case '-setboost':
      if (active) setBoost(active, fields[3] ?? '', Number(fields[4] ?? 0))
      return
    case '-clearboost':
    case '-clearpositiveboost':
      if (!active) return
      for (const id of BOOST_IDS) if (type === '-clearboost' || (active.boosts[id] ?? 0) > 0) delete active.boosts[id]
      return
    case '-clearnegativeboost':
      if (!active) return
      for (const id of BOOST_IDS) if ((active.boosts[id] ?? 0) < 0) delete active.boosts[id]
      return
    case '-clearallboost':
      state.playerActive.boosts = {}
      state.rivalActive.boosts = {}
      return
    case '-invertboost':
      if (!active) return
      for (const id of BOOST_IDS) if (active.boosts[id]) active.boosts[id] = -active.boosts[id]!
      return
    case '-start': {
      if (!active) return
      // Canto Mortal cuenta con `perish3`, `perish2`…: son los turnos que le quedan.
      const perish = /^perish(\d)$/.exec(effectId(fields[3]))
      if (perish) {
        addEffect(active.effects, 'perishsong', MON_EFFECTS)
        active.effects.find((effect) => effect.id === 'perishsong')!.turns = Number(perish[1])
        return
      }
      addEffect(active.effects, effectId(fields[3]), MON_EFFECTS)
      return
    }
    case '-end':
      if (active) removeEffect(active.effects, effectId(fields[3]))
      return
    case '-sidestart':
      if (side) addEffect(state[side], effectId(fields[3]), SIDE_EFFECTS)
      return
    case '-sideend':
      if (side) removeEffect(state[side], effectId(fields[3]))
      return
    case '-fieldstart':
      addEffect(state.field, effectId(fields[2]), FIELD_EFFECTS)
      return
    case '-fieldend':
      removeEffect(state.field, effectId(fields[2]))
      return
    default:
  }
}
