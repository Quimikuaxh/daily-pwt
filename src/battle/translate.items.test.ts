import { describe, it, expect } from 'vitest'
import { createBattleEngine } from './engine'
import { translateLine, translateLines } from './translate'
import { loadGameData } from '../data/gameData'
import { mon } from '../test-utils/teams'
import { playOut } from '../test-utils/harness'

// DEC-36 · UT-45, UT-46. Un objeto consumible no debe dar dos mensajes (uso + "ha desaparecido").
// Las secuencias de los tests unitarios están capturadas del motor real (@pkmn/sim, gen5); los casos de motor lo vuelven a ejecutar.
const data = loadGameData()
const ctx = { names: data.names, trainer: { nameEs: 'Camila', category: 'leader' as const, gender: 'F' as const } }
const itemEs = (id: string): string => data.names.items[id]

/** Juega `turns` turnos con el jugador usando siempre su primer movimiento y el rival el suyo (IA trivial). */
function play(player: ReturnType<typeof mon>, rival: ReturnType<typeof mon>, turns: number): { raw: string[]; text: string[] } {
  const engine = createBattleEngine({ battleSeed: `items-${player.item}-${rival.moves[0]}`, player: [player, mon('pikachu', ['splash', 'tackle', 'recover', 'protect'])], rival: [rival], ai: 'trivial', maxTurns: 300 } as any)
  let update = engine.start()
  const lines = [...update.lines]
  for (let turn = 0; turn < turns && !update.ended && !update.request?.forceSwitch; turn++) {
    update = engine.choose({ type: 'move', slot: 1 })
    lines.push(...update.lines)
  }
  return { raw: lines, text: translateLines(lines, ctx) }
}
const mentions = (text: string[], itemId: string) => text.filter((line) => line.includes(itemEs(itemId)))
const tank = (item: string, moves: [string, string, string, string] = ['splash', 'tackle', 'recover', 'protect']) => mon('snorlax', moves, { item, ability: 'immunity' })
const attacker = (moves: [string, string, string, string], item = '') => mon('machamp', moves, { item, ability: 'noguard' })

describe('translateLine: -enditem (DEC-36), secuencias capturadas del motor', () => {
  const line = (raw: string) => translateLine(raw, ctx)

  it.each([
    ['baya comida', '|-enditem|p1a: Snorlax|Aguav Berry|[eat]'],
    ['baya comida (Zidra)', '|-enditem|p1a: Snorlax|Sitrus Berry|[eat]'],
    ['baya de estado', '|-enditem|p1a: Snorlax|Cheri Berry|[eat]'],
    ['baya de Jaboca', '|-enditem|p1a: Snorlax|Jaboca Berry|[eat]'],
    ['baya Custap (la sigue -activate)', '|-enditem|p1a: Snorlax|Custap Berry|[eat]'],
    ['robado por Ladrón (lo cuenta -item)', '|-enditem|p1a: Snorlax|Sitrus Berry|[silent]|[from] move: Thief|[of] p2a: Machamp'],
    ['intercambiado con Truco (lo cuenta -activate/-item)', '|-enditem|p1a: Snorlax|Leftovers|[silent]|[from] move: Trick'],
    ['robado por Antihurto', '|-enditem|p2a: Machamp|Oran Berry|[silent]|[from] ability: Pickpocket|[of] p2a: Machamp'],
    ['Bulbo Absorbente (lo cuenta -boost)', '|-enditem|p1a: Snorlax|Absorb Bulb'],
    ['Pila (lo cuenta -boost)', '|-enditem|p1a: Snorlax|Cell Battery'],
    ['Hierba Espejo', '|-enditem|p1a: Snorlax|Mirror Herb'],
    ['Orbe Adrenalina', '|-enditem|p1a: Snorlax|Adrenaline Orb'],
    ['Aerosol Garganta', '|-enditem|p1a: Snorlax|Throat Spray'],
  ])('%s -> sin mensaje', (_name, raw) => {
    expect(line(raw)).toBeNull()
  })

  it.each([
    ['Golpe Bajo', '|-enditem|p1a: Snorlax|Sitrus Berry|[from] move: Knock Off|[of] p2a: Machamp', /perdido.*Baya Zidra/],
    ['Calcinación', '|-enditem|p1a: Snorlax|Sitrus Berry|[from] move: Incinerate', /perdido.*Baya Zidra/],
    ['Picoteo (Pluck)', '|-enditem|p1a: Snorlax|Sitrus Berry|[from] stealeat|[move] Pluck|[of] p2a: Machamp', /perdido.*Baya Zidra/],
    ['Lanzamiento (Fling)', '|-enditem|p2a: Machamp|Iron Ball|[from] move: Fling', /perdido/],
    ['Baya Anti-X', '|-enditem|p1a: Snorlax|Chople Berry|[weaken]', /redu.*daño/],
    ['Gema', '|-enditem|p1a: Snorlax|Normal Gem|[from] gem', /potenci/],
    ['Banda Focus (Sash)', '|-enditem|p1a: Snorlax|Focus Sash', /aguantado el golpe/],
    ['Hierba Blanca', '|-enditem|p1a: Snorlax|White Herb', /restaurado/],
    ['Hierba Única', '|-enditem|p1a: Snorlax|Power Herb', /sin esperar/],
    ['Globo Helio explotado', '|-enditem|p1a: Snorlax|Air Balloon', /explotado/],
    ['Botón Escape (sin otra línea)', '|-enditem|p1a: Snorlax|Eject Button', /gastado/],
  ])('%s -> un único mensaje con el objeto', (_name, raw, expected) => {
    const out = line(raw)
    expect(out).toMatch(expected)
    expect(out).not.toMatch(/consumido/)
  })

  it('el objeto sin traducir no filtra el nombre inglés', () => {
    expect(line('|-enditem|p1a: Snorlax|Objeto Raro')).not.toMatch(/Objeto Raro|\|/)
  })

  it('los objetos que se activan con efecto propio siguen mostrándose (Restos, Vidasfera, Cinta Palo...)', () => {
    expect(line('|-heal|p1a: Snorlax|213/235|[from] item: Leftovers')).toMatch(/Restos/)
    expect(line('|-damage|p1a: Snorlax|176/235|[from] item: Life Orb')).toMatch(/Vidasfera/)
    expect(line('|-damage|p1a: Snorlax|163/235|[from] item: Sticky Barb')).toMatch(new RegExp(itemEs('stickybarb')))
    expect(line('|-activate|p1a: Snorlax|item: Custap Berry|[consumed]')).toMatch(/Chiri|activado/)
  })
})

describe('motor real + traducción: un solo mensaje por objeto consumido (DEC-36)', () => {
  it('Baya Zidra comida: solo "recuperado PS con Baya Zidra"', () => {
    const { raw, text } = play(tank('sitrusberry'), attacker(['seismictoss', 'tackle', 'recover', 'protect']), 4)
    expect(raw.some((l) => /^\|-enditem\|.*Sitrus Berry\|\[eat\]/.test(l))).toBe(true)
    const about = mentions(text, 'sitrusberry')
    expect(about).toHaveLength(1)
    expect(about[0]).toMatch(/recuperado PS/)
  })

  it('Baya Aranja comida (no llega a verse "consumido"): un mensaje con el objeto', () => {
    const { raw, text } = play(tank('oranberry'), attacker(['seismictoss', 'tackle', 'recover', 'protect']), 5)
    expect(raw.some((l) => /^\|-enditem\|.*Oran Berry\|\[eat\]/.test(l))).toBe(true)
    expect(mentions(text, 'oranberry')).toHaveLength(1)
  })

  it('Baya Anti-X: un solo mensaje (antes "consumido" + "perdido")', () => {
    const { raw, text } = play(tank('chopleberry'), attacker(['closecombat', 'tackle', 'recover', 'protect']), 1)
    expect(raw.filter((l) => l.startsWith('|-enditem|'))).toHaveLength(2)
    expect(mentions(text, 'chopleberry')).toHaveLength(1)
  })

  it('Baya Safre cura el estado: el mensaje es la curación, sin aviso de objeto', () => {
    const { raw, text } = play(tank('cheriberry'), attacker(['thunderwave', 'tackle', 'recover', 'protect']), 1)
    expect(raw.some((l) => l.includes('Cheri Berry|[eat]'))).toBe(true)
    expect(mentions(text, 'cheriberry')).toHaveLength(0)
    expect(text.some((l) => /paraliz/i.test(l))).toBe(true)
    expect(text.some((l) => /cur|recuper|libr/i.test(l))).toBe(true)
  })

  it('Banda Focus (Sash): un único mensaje', () => {
    const { text } = play(tank('focussash'), attacker(['closecombat', 'tackle', 'recover', 'protect']), 1)
    expect(mentions(text, 'focussash')).toHaveLength(1)
  })

  it('Banda Focus (Band) activada: un único mensaje, el objeto no se consume', () => {
    const { raw, text } = play(tank('focusband'), attacker(['closecombat', 'tackle', 'recover', 'protect']), 2)
    expect(raw.some((l) => l.startsWith('|-enditem|'))).toBe(false)
    expect(mentions(text, 'focusband').length).toBeLessThanOrEqual(1)
  })

  it('Hierba Blanca: baja de característica y un único mensaje de la hierba', () => {
    const { raw, text } = play(tank('whiteherb'), attacker(['growl', 'tackle', 'recover', 'protect']), 1)
    expect(raw.some((l) => l.startsWith('|-enditem|') && l.includes('White Herb'))).toBe(true)
    expect(mentions(text, 'whiteherb')).toHaveLength(1)
  })

  it('Gema: un único mensaje', () => {
    const { raw, text } = play(attacker(['tackle', 'splash', 'recover', 'protect'], 'normalgem'), tank('', ['splash', 'tackle', 'recover', 'protect']), 1)
    expect(raw.some((l) => l.includes('[from] gem'))).toBe(true)
    expect(mentions(text, 'normalgem')).toHaveLength(1)
  })

  it('Bulbo Absorbente: el mensaje es la subida de característica, sin aviso de objeto', () => {
    const { raw, text } = play(tank('absorbbulb'), attacker(['watergun', 'tackle', 'recover', 'protect']), 1)
    expect(raw.some((l) => l.includes('|Absorb Bulb'))).toBe(true)
    expect(mentions(text, 'absorbbulb')).toHaveLength(0)
    expect(text.some((l) => /Ataque Especial/i.test(l))).toBe(true)
  })

  it('Globo Helio explotado: se ve', () => {
    const { text } = play(tank('airballoon'), attacker(['tackle', 'splash', 'recover', 'protect']), 1)
    expect(text.filter((l) => /explotado/.test(l))).toHaveLength(1)
  })

  it('Ladrón: solo se cuenta que el ladrón obtiene el objeto', () => {
    const { raw, text } = play(tank('sitrusberry'), attacker(['thief', 'tackle', 'recover', 'protect']), 1)
    expect(raw.some((l) => l.includes('[silent]|[from] move: Thief'))).toBe(true)
    const about = mentions(text, 'sitrusberry')
    expect(about).toHaveLength(1)
    expect(about[0]).toMatch(/obtenido/)
  })

  it('Truco: se cuentan los dos objetos recibidos, sin avisos de pérdida', () => {
    const { text } = play(tank('sitrusberry', ['trick', 'tackle', 'recover', 'protect']), attacker(['splash', 'tackle', 'recover', 'protect'], 'leftovers'), 1)
    expect(text.some((l) => /perdido/.test(l))).toBe(false)
    expect(mentions(text, 'sitrusberry').every((l) => /obtenido/.test(l))).toBe(true)
    expect(text.filter((l) => /obtenido/.test(l)).length).toBeGreaterThanOrEqual(2)
  })

  it('Golpe Bajo: el objeto perdido se sigue mostrando', () => {
    const { text } = play(tank('sitrusberry'), attacker(['knockoff', 'tackle', 'recover', 'protect']), 1)
    const about = mentions(text, 'sitrusberry')
    expect(about).toHaveLength(1)
    expect(about[0]).toMatch(/perdido/)
  })

  it('Restos y Vidasfera siguen mostrándose', () => {
    const { text } = play(mon('garchomp', ['tackle', 'splash', 'recover', 'protect'], { item: 'lifeorb' }), tank('leftovers', ['tackle', 'splash', 'recover', 'protect']), 2)
    expect(mentions(text, 'lifeorb').length).toBeGreaterThan(0)
    expect(mentions(text, 'leftovers').length).toBeGreaterThan(0)
  })
})

describe('partidas completas: ningún objeto consumido deja dos mensajes seguidos (DEC-36)', () => {
  it('ninguna línea -enditem [eat]/[silent] produce texto en 10 partidas con equipos con objetos', () => {
    const teamWithItems = (items: string[]) => items.map((item, index) => mon(['snorlax', 'machamp', 'gengar', 'starmie', 'tyranitar', 'scizor'][index], ['tackle', 'seismictoss', 'thief', 'knockoff'], { item }))
    const items = ['sitrusberry', 'oranberry', 'focussash', 'whiteherb', 'cheriberry', 'chopleberry']
    const offenders: string[] = []
    for (let seed = 0; seed < 10; seed++) {
      const engine = createBattleEngine({ battleSeed: `items-full-${seed}`, player: teamWithItems(items), rival: teamWithItems([...items].reverse()), ai: 'heuristic', maxTurns: 300 } as any)
      const game = playOut(engine as any)
      for (const raw of game.lines) {
        if (/^\|-enditem\|/.test(raw) && /\[(eat|silent)\]/.test(raw) && translateLine(raw, ctx) !== null) offenders.push(raw)
      }
    }
    expect(offenders).toEqual([])
  })
})
