import { readFileSync, writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gen5 } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'

const OUTPUT_PATH = fromRoot('src', 'generated', 'move-fx.json')

const HEALING = new Set(['recover', 'roost', 'softboiled', 'milkdrink', 'moonlight', 'morningsun', 'synthesis', 'slackoff', 'healorder', 'rest', 'wish', 'aquaring', 'ingrain'])
const SELF_TARGETS = new Set(['self', 'allySide', 'allyTeam', 'adjacentAllyOrSelf'])
// Suben características por código y no por `boosts` en los datos (Tambor, Reserva, Acupresión).
const STAT_RAISERS = new Set(['bellydrum', 'stockpile', 'acupressure'])

/**
 * Animación genérica de cada movimiento según lo que hace: los físicos por cómo golpean (mordisco, puñetazo, corte, patada u otro golpe),
 * los especiales por su tipo (en el cliente) y los de estado por su efecto.
 * Solo los movimientos que pueden salir en el juego (rivales del PWT y pool del jugador): el fichero va con el combate, no con Hoy.
 */
export function fxKindOf(move) {
  if (move.category === 'Physical') {
    if (move.flags?.bite) return 'bite'
    if (move.flags?.punch) return 'punch'
    if (move.flags?.slicing) return 'slash'
    // Las patadas no llevan marca en los datos: por el nombre (Patada Ígnea, Patada Salto…).
    if (/kick/i.test(move.name)) return 'kick'
    return 'hit'
  }
  if (move.category === 'Special') return 'shot'
  if (move.weather) return 'weather'
  if (move.stallingMove) return 'protect'
  if (move.id === 'substitute') return 'substitute'
  if (move.sideCondition) return move.target === 'foeSide' ? 'hazard' : 'screen'
  if (HEALING.has(move.id) || move.heal || move.flags?.heal) return 'heal'
  const selfTarget = SELF_TARGETS.has(move.target)
  if ((move.boosts && selfTarget) || move.self?.boosts || STAT_RAISERS.has(move.id)) return 'boost'
  // Al rival: bajarle (Encanto, Chirrido…) o subirle para confundirlo (Contoneo, que no es bajar).
  if (move.boosts) return Object.values(move.boosts).some((stages) => stages < 0) ? 'drop' : 'status'
  if (move.status || move.volatileStatus) return selfTarget ? 'self' : 'status'
  return selfTarget ? 'self' : 'foe'
}

function usedMoveIds() {
  const trainers = JSON.parse(readFileSync(fromRoot('data', 'trainers.json'), 'utf8')).trainers
  const pool = JSON.parse(readFileSync(fromRoot('data', 'player-sets.json'), 'utf8'))
  const ids = new Set()
  for (const trainer of trainers) for (const variant of trainer.variants) for (const set of variant.team) for (const move of set.moves) ids.add(move)
  for (const set of pool) for (const move of set.moves) ids.add(move)
  return [...ids].sort()
}

export function buildMoveFx() {
  const fx = {}
  for (const id of usedMoveIds()) {
    // Los Poder Oculto de cada tipo comparten datos en @pkmn ('hiddenpower').
    const move = gen5.moves.get(id.startsWith('hiddenpower') ? 'hiddenpower' : id)
    if (!move) throw new Error(`Movimiento desconocido en los datos: ${id}`)
    fx[id] = fxKindOf(move)
  }
  return fx
}

if (isMain(import.meta.url)) {
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(buildMoveFx())}\n`)
  console.log(`Escrito ${OUTPUT_PATH}`)
}
