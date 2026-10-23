import { describe, it, expect } from 'vitest'
import { translateLine, translateLines, introLines } from './translate'
import type { NamesEs } from '../test-utils/types'

// UT-45, UT-47 · RF-51, RF-53 · DEC-13. Traducción del registro del sim (inglés) a español.
// TODO-CONTRATO (src/battle/translate.ts):
//   translateLine(line: string, ctx: TranslateContext): string | null   (null = línea sin texto o descartada)
//   translateLines(lines: string[], ctx): string[]                       (sin los null)
//   introLines({ trainer: { nameEs, category: 'leader' | 'champion', gender: 'M' | 'F' }, rivalLead: string, playerLead: string }): string[]
//   TranslateContext = { names: NamesEs; trainer: { nameEs: string; category: 'leader' | 'champion'; gender: 'M' | 'F' } }
// TODO-CONTRATO: el trainer del Challenge no tiene `gender`; hace falta el dato (o derivarlo) para "La Líder"/"El Campeón".
// TODO-CONTRATO: los textos exactos de las plantillas no se fijan aquí salvo los de RF-53; se comprueba el contenido clave en español.
const names: NamesEs = {
  species: { garchomp: 'Garchomp', starmie: 'Starmie', gengar: 'Gengar' },
  moves: { earthquake: 'Terremoto', surf: 'Surf', swordsdance: 'Danza Espada', stealthrock: 'Trampa Rocas', protect: 'Protección', fly: 'Vuelo', thunderbolt: 'Rayo' },
  abilities: { intimidate: 'Intimidación', drizzle: 'Llovizna', levitate: 'Levitación' },
  items: { leftovers: 'Restos', lifeorb: 'Vidasfera', sitrusberry: 'Baya Zidra', salacberry: 'Baya Aslac', weaknesspolicy: 'Seguro Debilidad' },
  types: { Water: 'Agua', Ground: 'Tierra' },
}
const ctx = { names, trainer: { nameEs: 'Camila', category: 'leader' as const, gender: 'F' as const } }
const tr = (l: string) => translateLine(l, ctx)

const ENGLISH = /\b(used|fainted|sent out|super effective|not very effective|The opposing|critical hit|But it failed|avoided|went down|came back|was hurt|is paralyzed|is burned|Go!|foe|lost|won|Switch)\b/i
const clean = (s: string) => !/\|/.test(s) && !/\bp[12][ab]?:/.test(s) && !ENGLISH.test(s)

const cases: [string, string, RegExp[]][] = [
  ['move', '|move|p1a: Garchomp|Earthquake|p2a: Starmie', [/Garchomp/, /Terremoto/]],
  ['move rival', '|move|p2a: Starmie|Surf|p1a: Garchomp', [/Starmie/, /Surf/]],
  ['switch jugador', '|switch|p1a: Garchomp|Garchomp, L50, M|183/183', [/Garchomp/]],
  ['switch rival', '|switch|p2a: Starmie|Starmie, L50|100/100', [/Camila/, /Starmie/]],
  ['drag', '|drag|p1a: Gengar|Gengar, L50, M|120/120', [/Gengar/]],
  ['faint', '|faint|p2a: Starmie', [/Starmie/, /debilit/i]],
  ['supereffective', '|-supereffective|p2a: Starmie', [/eficaz/i]],
  ['resisted', '|-resisted|p2a: Starmie', [/poco eficaz/i]],
  ['crit', '|-crit|p2a: Starmie', [/crítico/i]],
  ['miss', '|-miss|p1a: Garchomp|p2a: Starmie', [/fall/i]],
  ['immune', '|-immune|p2a: Gengar', [/no afecta|inmune/i]],
  ['fail', '|-fail|p1a: Garchomp', [/fall|sin efecto|no tuvo/i]],
  ['status quemado', '|-status|p2a: Starmie|brn', [/quem/i]],
  ['status paralizado', '|-status|p2a: Starmie|par', [/paraliz/i]],
  ['status dormido', '|-status|p2a: Starmie|slp', [/dorm/i]],
  ['status envenenado', '|-status|p2a: Starmie|psn', [/envenen/i]],
  ['status gravemente envenenado', '|-status|p2a: Starmie|tox', [/envenen/i]],
  ['status congelado', '|-status|p2a: Starmie|frz', [/congel/i]],
  ['curestatus', '|-curestatus|p2a: Starmie|brn', [/cur|recuper|libr|despiert/i]],
  ['boost', '|-boost|p1a: Garchomp|atk|2', [/Ataque/i]],
  ['unboost', '|-unboost|p1a: Garchomp|def|1', [/Defensa/i]],
  ['weather lluvia', '|-weather|RainDance', [/lluvia/i]],
  ['weather sol', '|-weather|SunnyDay', [/sol/i]],
  ['weather arena', '|-weather|Sandstorm', [/arena/i]],
  ['weather granizo', '|-weather|Hail', [/granizo/i]],
  ['ability', '|-ability|p2a: Starmie|Intimidate|boost', [/Intimidación/]],
  ['item', '|-item|p1a: Garchomp|Life Orb', [/Vidasfera/]],
  ['enditem', '|-enditem|p1a: Garchomp|Sitrus Berry', [/Baya Zidra/]],
  ['cant parálisis', '|cant|p1a: Garchomp|par', [/paraliz/i]],
  ['cant recarga', '|cant|p1a: Garchomp|recharge', [/recarg/i]],
  ['mustrecharge', '|-mustrecharge|p1a: Garchomp', [/recarg/i]],
  ['turn', '|turn|5', [/5/]],
  ['win', '|win|Jugador', [/victoria|gan/i]],
  ['tie', '|tie', [/empate/i]],
  ['start confusión', '|-start|p1a: Garchomp|confusion', [/confus/i]],
  ['end confusión', '|-end|p1a: Garchomp|confusion', [/confus/i]],
  ['sidestart', '|-sidestart|p2: Rival|move: Stealth Rock', [/Trampa Rocas/]],
  ['activate', '|-activate|p1a: Garchomp|move: Protect', [/Protección/]],
  ['prepare', '|-prepare|p1a: Garchomp|Fly', [/Vuelo/]],
  ['hitcount', '|-hitcount|p2a: Starmie|3', [/3/]],
  ['ohko', '|-ohko', [/un golpe|KO/i]],
]

describe('translateLine: líneas con texto (UT-45)', () => {
  it.each(cases)('%s -> español con lo esencial', (_n, line, patterns) => {
    const out = tr(line)
    expect(out).not.toBeNull()
    for (const p of patterns) expect(out).toMatch(p)
  })

  it.each(cases)('%s -> sin ids, marcadores ni inglés', (_n, line) => {
    expect(clean(tr(line) ?? '')).toBe(true)
  })

  it('los puntos suspensivos son el carácter tipográfico, no tres puntos', () => {
    const line = tr('|-immune|p2a: Gengar')
    expect(line).toMatch(/…/)
    expect(line).not.toMatch(/\.\.\./)
  })

  it('un movimiento no deja su nombre inglés cuando hay traducción', () => {
    expect(tr('|move|p1a: Garchomp|Swords Dance|p1a: Garchomp')).not.toMatch(/Swords Dance/)
  })

  it('la habilidad no deja su nombre inglés', () => {
    expect(tr('|-ability|p2a: Starmie|Intimidate|boost')).not.toMatch(/Intimidate/)
  })

  it('una baya que sube una característica lo dice en el mensaje; otros objetos, el mensaje de siempre (decisión de Jose)', () => {
    expect(tr('|-enditem|p2a: Garchomp|Salac Berry|[eat]')).toBeNull()
    expect(tr('|-boost|p2a: Garchomp|spe|1|[from] item: Salac Berry')).toBe('¡La Baya Aslac ha subido la Velocidad de Garchomp de Camila!')
    expect(tr('|-boost|p1a: Garchomp|atk|2|[from] item: Weakness Policy')).toBe('¡El Ataque de Garchomp ha subido mucho!')
  })

  it('el objeto no deja su nombre inglés', () => {
    expect(tr('|-item|p1a: Garchomp|Life Orb')).not.toMatch(/Life Orb/)
  })
})

describe('translateLine: líneas sin texto o descartadas', () => {
  it.each([
    ['-message', '|-message|Garchomp lost the battle'],
    ['-hint', '|-hint|Some hint text'],
    ['raw', '|raw|<div class="infobox">x</div>'],
    ['debug', '|debug|foo bar'],
    ['split', '|split|p1'],
  ])('descarta %s', (_n, line) => {
    expect(tr(line)).toBeNull()
  })

  it.each([
    ['vacía', '|'],
    ['upkeep', '|upkeep'],
    ['t:', '|t:|1792342230'],
    ['player', '|player|p1|Jugador||'],
    ['teamsize', '|teamsize|p1|6'],
    ['gametype', '|gametype|singles'],
    ['gen', '|gen|5'],
    ['tier', '|tier|[Gen 5] Custom Game'],
    ['start', '|start'],
    ['-damage solo barra', '|-damage|p2a: Starmie|50/100'],
  ])('%s no produce texto sucio', (_n, line) => {
    const out = tr(line)
    expect(out === null || clean(out)).toBe(true)
  })
})

describe('translateLine: robustez', () => {
  it('un tipo de mensaje desconocido da un texto genérico en español, sin filtrar el tipo', () => {
    const out = tr('|-foobar|p1a: Garchomp|xyz')
    expect(out).toEqual(expect.any(String))
    expect(out).not.toMatch(/foobar|xyz|\|/)
  })

  it('el texto genérico no está vacío', () => {
    expect((tr('|-foobar|p1a: Garchomp|xyz') ?? '').length).toBeGreaterThan(0)
  })

  it('una especie sin traducción no deja marcadores de lado', () => {
    expect(tr('|faint|p2a: Desconocidomon') ?? '').not.toMatch(/p2a/)
  })

  it('un movimiento sin traducción no filtra tuberías', () => {
    expect(tr('|move|p1a: Garchomp|Frustration|p2a: Starmie') ?? '').not.toMatch(/\|/)
  })

  it('una línea con campos de menos no lanza', () => {
    expect(() => tr('|move|p1a: Garchomp')).not.toThrow()
  })

  it('una línea vacía de texto no lanza', () => {
    expect(() => tr('')).not.toThrow()
  })

  it('un apodo con HTML se devuelve como texto plano (no se interpreta ni se elimina)', () => {
    const out = tr('|faint|p2a: <b>x</b>') ?? ''
    expect(out).not.toMatch(/\|/)
  })

  it('translateLines descarta los null y conserva el orden', () => {
    const out = translateLines(['|raw|x', '|move|p1a: Garchomp|Earthquake|p2a: Starmie', '|debug|y', '|faint|p2a: Starmie'], ctx)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatch(/Terremoto/)
  })
})

describe('introducción (UT-47, RF-53)', () => {
  const intro = (over = {}) => introLines({ trainer: { nameEs: 'Camila', category: 'leader', gender: 'F', ...over } as any, rivalLead: 'Starmie', playerLead: 'Garchomp' })

  it('primera línea: "¡La Líder Camila te desafía!"', () => {
    expect(intro()[0]).toBe('¡La Líder Camila te desafía!')
  })

  it('campeón masculino: "¡El Campeón Rojo te desafía!"', () => {
    expect(intro({ nameEs: 'Rojo', category: 'champion', gender: 'M' })[0]).toBe('¡El Campeón Rojo te desafía!')
  })

  it('líder masculino: "¡El Líder Brock te desafía!"', () => {
    expect(intro({ nameEs: 'Brock', category: 'leader', gender: 'M' })[0]).toBe('¡El Líder Brock te desafía!')
  })

  it('campeona femenina: "¡La Campeona Cintia te desafía!"', () => {
    expect(intro({ nameEs: 'Cintia', category: 'champion', gender: 'F' })[0]).toBe('¡La Campeona Cintia te desafía!')
  })

  it('segunda línea: "¡Camila saca a Starmie!"', () => {
    expect(intro()[1]).toBe('¡Camila saca a Starmie!')
  })

  it('tercera línea: envío del inicial del jugador', () => {
    expect(intro()[2]).toMatch(/Garchomp/)
  })

  it('son exactamente 3 líneas', () => {
    expect(intro()).toHaveLength(3)
  })

  it('ninguna línea de la introducción contiene inglés ni marcadores', () => {
    expect(intro().every(clean)).toBe(true)
  })
})
