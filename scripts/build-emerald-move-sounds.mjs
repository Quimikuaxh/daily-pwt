#!/usr/bin/env node
/**
 * Sonidos de los ataques de la campaña de Hoenn (Jose, 12/11/2026): de `data/battle_anim_scripts.s` de pokeemerald, los efectos `SE_*` que
 * toca el guion de animación de cada ataque, con el fotograma en que suenan (sumando `delay`; `waitforvisualfinish` cuenta como
 * WAIT_FRAMES, porque la duración real depende de los sprites). Sigue `goto` y `call`; `loopsewithpan` repite y `waitplaysewithpan`
 * espera. Escribe `src/generated/emerald/move-sounds.json` ({ ataque: [[fotograma, idDeEfecto], …] }) y añade a `data/audio.json`
 * cada efecto que falte, como `emerald-se-<nombre>`, con su entrada del ZIP (`emerald_XXXX.wav`: el número de songs.h en hexadecimal).
 * Después, `npm run gen:audio` los codifica.
 *
 * Uso: node scripts/build-emerald-move-sounds.mjs <ruta de pokeemerald>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const WAIT_FRAMES = 12
/** Como mucho, este número de efectos por ataque y este tiempo: lo demás de un guion largo no se oye con el combate avanzando. */
const MAX_SOUNDS = 6
const MAX_FRAME = 240

export function parseSongs(text) {
  const songs = {}
  for (const match of text.matchAll(/^#define\s+(SE_\w+)\s+(\d+)/gm)) songs[match[1]] = Number(match[2])
  return songs
}

/** Bloques etiquetados del guion: `Etiqueta:` y sus líneas hasta la siguiente etiqueta. */
export function parseBlocks(text) {
  const blocks = {}
  let current = null
  for (const raw of text.split('\n')) {
    const label = /^(\w+):/.exec(raw)
    if (label) { current = label[1]; blocks[current] = []; continue }
    if (current) blocks[current].push(raw.trim())
  }
  return blocks
}

/** Efectos de un bloque con su fotograma, siguiendo saltos y llamadas (sin repetir un bloque en la misma rama). */
export function soundsOf(blocks, label, frame = 0, seen = new Set(), out = []) {
  if (!blocks[label] || seen.has(label)) return { frame, out }
  seen = new Set(seen).add(label)
  for (const line of blocks[label]) {
    if (out.length >= MAX_SOUNDS || frame > MAX_FRAME) break
    const [command, ...rest] = line.split(/[\s,]+/).filter(Boolean)
    const args = rest
    if (command === 'delay') frame += Number(args[0]) || 0
    else if (command === 'waitforvisualfinish') frame += WAIT_FRAMES
    else if (['playsewithpan', 'playse', 'panse', 'panse_adjustall', 'panse_adjustnone'].includes(command) && args[0]?.startsWith('SE_')) out.push([frame, args[0]])
    else if (command === 'waitplaysewithpan' && args[0]?.startsWith('SE_')) out.push([frame + (Number(args[2]) || 0), args[0]])
    else if (command === 'loopsewithpan' && args[0]?.startsWith('SE_')) {
      const wait = Number(args[2]) || 0
      const times = Number(args[3]) || 1
      for (let i = 0; i < times && out.length < MAX_SOUNDS; i++) out.push([frame + i * wait, args[0]])
    } else if (command === 'createsoundtask' && args[1]?.startsWith('SE_')) out.push([frame, args[1]])
    else if (command === 'goto') return soundsOf(blocks, args[0], frame, seen, out)
    // Ramas: se sigue una (contra quién va o el turno en que se ataca de los de dos turnos, que es el del daño).
    else if (command === 'choosetwoturnanim') return soundsOf(blocks, args[1], frame, seen, out)
    else if (['jumprettrue', 'jumpretfalse', 'jumpreteq', 'jumpargeq', 'jumpifcontest', 'jumpifmoveturn'].includes(command)) return soundsOf(blocks, args.at(-1), frame, seen, out)
    else if (command === 'call') frame = soundsOf(blocks, args[0], frame, seen, out).frame
    else if (command === 'end' || command === 'return') break
  }
  return { frame, out }
}

export const moveLabel = (id, moveConstants) => moveConstants[id]
export const sfxId = (se) => `emerald-se-${se.slice(3).toLowerCase().replace(/_/g, '-')}`

function main() {
  const decomp = process.argv[2]
  if (!decomp) throw new Error('Uso: node scripts/build-emerald-move-sounds.mjs <ruta de pokeemerald>')
  const songs = parseSongs(readFileSync(resolve(decomp, 'include/constants/songs.h'), 'utf8'))
  const blocks = parseBlocks(readFileSync(resolve(decomp, 'data/battle_anim_scripts.s'), 'utf8'))
  // MOVE_DOUBLE_EDGE -> doubleedge, como los ids de moves.json.
  const constants = {}
  for (const match of readFileSync(resolve(decomp, 'include/constants/moves.h'), 'utf8').matchAll(/^#define\s+MOVE_(\w+)\s+\d+/gm)) {
    constants[match[1].toLowerCase().replace(/_/g, '')] = `Move_${match[1]}`
  }
  // Nombres que cambiaron entre el juego y Showdown.
  Object.assign(constants, { visegrip: 'Move_VICE_GRIP', highjumpkick: 'Move_HI_JUMP_KICK', feintattack: 'Move_FAINT_ATTACK', smellingsalts: 'Move_SMELLING_SALT' })
  const moves = JSON.parse(readFileSync(resolve(ROOT, 'src/generated/emerald/moves.json'), 'utf8'))
  const result = {}
  const used = new Set()
  for (const id of Object.keys(moves).sort()) {
    const label = constants[id.replace(/^hiddenpower\w+$/, 'hiddenpower')]
    if (!label) continue
    const sounds = soundsOf(blocks, label).out.filter(([, se]) => songs[se] !== undefined)
    if (!sounds.length) continue
    result[id] = sounds.map(([frame, se]) => { used.add(se); return [frame, sfxId(se)] })
  }
  writeFileSync(resolve(ROOT, 'src/generated/emerald/move-sounds.json'), `${JSON.stringify(result, null, 1)}\n`)
  const manifestPath = resolve(ROOT, 'data/audio.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const have = new Set(manifest.sfx.map((item) => item.id))
  let added = 0
  for (const se of [...used].sort()) {
    const id = sfxId(se)
    if (have.has(id)) continue
    manifest.sfx.push({ id, source: 'tsr-sfx-emerald', entry: `emerald_${songs[se].toString(16).toUpperCase().padStart(4, '0')}.wav`, _nota: `Campaña de Hoenn: ${se} (sonido ${songs[se]} de songs.h), de los guiones de animación de los ataques.` })
    added++
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Sonidos de ${Object.keys(result).length} ataques con ${used.size} efectos (${added} nuevos en data/audio.json). Ahora: npm run gen:audio`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
