import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { existsInRoot, importScript } from '../src/test-utils/paths'

const { N2B2_CATALOG, N2B2_ENCOUNTERS, parseSerebiiTeam, validateN2b2Catalog } = await importScript('scripts/import-n2b2.mjs')

// Rivales de la locke de N2/B2 (PRD §0, 13/11/2026): primera tabla del modo Normal de Serebii, validada con los datos de Gen 5.
const table = (title: string, challenge: boolean, species: [number, string, number, string, string[], string | null][]) => `
<table class="trainer">${challenge ? '<tr><td colspan="8" class="interact">Challenge Mode</td></tr>' : ''}
  <tr><td class="tcol"></td>${species.map(([dex]) => `<td><a href="/pokedex-bw/${dex}.shtml"><img /></a></td>`).join('')}</tr>
  <tr><td >${title}</td>${species.map(([dex, name]) => `<td align="center"><a href="/pokedex-bw/${dex}.shtml">${name}</a></td>`).join('')}</tr>
  <tr><td rowspan="4"><b>Items</b><br /><table><tr><td><a href="/itemdex/potion.shtml"></a></td></tr></table></td>
    ${species.map(([, , level]) => `<td class="level" height="1">Level ${level}</td>`).join('')}</tr>
  <tr>${species.map(([, , , ability]) => `<td align="center"><a href="/abilitydex/${ability}.shtml">x</a></td>`).join('')}</tr>
  <tr>${species.map(([, , , , moves]) => `<td valign="top" class="bor"><b>Attacks</b>:<br />${moves.map((move) => `<a href="/attackdex-bw/${move}.shtml">x</a><br />`).join('')}</td>`).join('')}</tr>
  <tr>${species.map(([, , , , , item]) => `<td valign="top" class="bor"><b>Hold Item</b>:<br />${item ? `<a href="/itemdex/${item}.shtml">x</a>` : 'No Item'}</td>`).join('')}</tr>
</table>`

describe('importador de la locke de N2/B2', () => {
  it('toma la tabla del modo Normal aunque la de Desafío vaya antes y lee nivel, habilidad, ataques y objeto', () => {
    const html = table('Leader Cheren', true, [[504, 'Patrat', 12, 'keeneye', ['workup'], null]])
      + table('Leader Cheren', false, [[504, 'Patrat', 11, 'keeneye', ['workup', 'bite'], null], [506, 'Lillipup', 13, 'vitalspirit', ['tackle'], 'sitrusberry']])
    expect(parseSerebiiTeam(html, 'Leader Cheren')).toEqual([
      { species: 'patrat', level: 11, ability: 'keeneye', item: null, moves: ['workup', 'bite'] },
      { species: 'lillipup', level: 13, ability: 'vitalspirit', item: 'sitrusberry', moves: ['tackle'] },
    ])
  })

  it('falla si falta la tabla o las columnas no cuadran', () => {
    expect(() => parseSerebiiTeam('', 'Leader Roxie')).toThrow(/modo Normal/)
    const broken = table('Leader Roxie', false, [[109, 'Koffing', 16, 'levitate', ['smog'], null]]).replace('Level 16', '')
    expect(() => parseSerebiiTeam(broken, 'Leader Roxie')).toThrow(/descuadradas/)
  })

  it('cada rival de campaña tiene su retrato recortado para el VS', () => {
    for (const { id } of N2B2_ENCOUNTERS) {
      expect(existsInRoot('public/sprites/trainers', `${id}-vs.png`), id).toBe(true)
    }
  })

  it('el catálogo versionado tiene los 13 rivales en orden, con datos de Gen 5 válidos y sin IV (20 a todos en combate)', () => {
    const catalog = JSON.parse(readFileSync(N2B2_CATALOG, 'utf8'))
    expect(() => validateN2b2Catalog(catalog)).not.toThrow()
    expect(catalog.encounters.map((encounter: { id: string }) => encounter.id)).toEqual(N2B2_ENCOUNTERS.map((encounter: { id: string }) => encounter.id))
    expect(catalog.encounters.flatMap((encounter: { team: object[] }) => encounter.team).some((member: object) => 'iv' in member)).toBe(false)
    const wrongGender = structuredClone(catalog)
    wrongGender.encounters[0].team[0].gender = 'F'
    expect(() => validateN2b2Catalog(wrongGender)).toThrow(/sexo original incorrecto/)
    const wrongMove = structuredClone(catalog)
    wrongMove.encounters[0].team[0].moves = ['notamove']
    expect(() => validateN2b2Catalog(wrongMove)).toThrow(/movimientos inválidos/)
  })
})
