import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error módulo .mjs sin tipos
import { NO_SYNERGY_TAG, synergyProblems } from './set-synergy.mjs'
import { NO_SYNERGY_TAG as CORE_TAG } from '../../src/core/launch'

// UT-145 · Sets del PWT con sinergia (Jose, 04/11/2026; DEC-79).
const set = (species: string, moves: string[]) => ({ species, moves })

describe('sinergia de los sets del PWT (UT-145)', () => {
  it('pasa un set normal, un muro con un solo ataque y uno con ataques de varios golpes', () => {
    expect(synergyProblems(set('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance']))).toEqual([])
    expect(synergyProblems(set('blissey', ['seismictoss', 'softboiled', 'toxic', 'protect']))).toEqual([])
    expect(synergyProblems(set('cloyster', ['iciclespear', 'rockblast', 'shellsmash', 'iceshard']))).toEqual([])
  })

  it('no pasan: un solo ataque fuerte, ninguno fuerte y preciso de su tipo, ataques del lado flojo, movimientos sin uso y los de azar o relleno', () => {
    expect(synergyProblems(set('altaria', ['outrage', 'dragondance', 'cottonguard', 'roost']))).toContain('un solo ataque fuerte')
    expect(synergyProblems(set('garbodor', ['psychic', 'thunderbolt', 'focusblast', 'protect']))).toContain('ningún ataque fuerte y preciso de su tipo')
    // Su único ataque fuerte de su tipo falla demasiado (Megacuerno, 85).
    expect(synergyProblems(set('heracross', ['megahorn', 'stoneedge', 'protect', 'swordsdance']))).toContain('ningún ataque fuerte y preciso de su tipo')
    // Dos ataques, pero solo uno fuerte (Acua Jet tiene 40).
    expect(synergyProblems(set('floatzel', ['aquajet', 'icepunch', 'bulkup', 'protect']))).toContain('ningún ataque fuerte y preciso de su tipo')
    expect(synergyProblems(set('ampharos', ['firepunch', 'earthquake', 'thunderpunch', 'brickbreak']))).toContain('4 ataques del lado flojo (físico)')
    expect(synergyProblems(set('emolga', ['wildcharge', 'uturn', 'acrobatics', 'charm']))).toContain('movimientos sin uso: charm')
    expect(synergyProblems(set('crobat', ['bravebird', 'uturn', 'doubleteam', 'confuseray']))).toContain('movimientos de azar o de relleno: doubleteam, confuseray')
    expect(synergyProblems(set('gardevoir', ['dreameater', 'shadowball', 'thunderbolt', 'hypnosis']))).toContain('movimientos de azar o de relleno: dreameater')
    expect(synergyProblems(set('charizard', ['inferno', 'dragonrush', 'focusblast', 'honeclaws']))).toContain('todos sus ataques con 80 de precisión o menos')
  })

  it('el pool marca los del PWT que no pasan (nunca uno de Smogon) y la etiqueta es la misma que lee el reto', () => {
    expect(NO_SYNERGY_TAG).toBe(CORE_TAG)
    const pool: { species: string; moves: string[]; tags: string[] }[] = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'data', 'player-sets.json'), 'utf8'))
    const marked = pool.filter((entry) => entry.tags.includes(NO_SYNERGY_TAG))
    expect(marked.length).toBeGreaterThan(0)
    for (const entry of marked) {
      expect(entry.tags.some((tag) => tag.startsWith('source:smogon-'))).toBe(false)
      expect(synergyProblems(entry).length).toBeGreaterThan(0)
    }
    for (const entry of pool.filter((candidate) => !candidate.tags.includes(NO_SYNERGY_TAG) && !candidate.tags.some((tag) => tag.startsWith('source:smogon-')))) {
      expect(synergyProblems(entry)).toEqual([])
    }
  })
})
