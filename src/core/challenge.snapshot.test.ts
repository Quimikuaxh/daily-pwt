import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDailyChallenge } from './challenge'
import { loadGameData } from '../data/gameData'
import { REFERENCE_DATES } from '../test-utils/dates'

/**
 * UT-17 · criterio de aceptación 4. Snapshot de getDailyChallenge con datos REALES.
 *
 * Cómo se genera (lo hace el developer, UNA vez, tras revisar a mano el resultado):
 *   npx vitest run src/core/challenge.snapshot.test.ts -u
 * El fichero `__snapshots__/challenge.reference.json` debe revisarse (rival, variante, equipo coherentes con los datos)
 * y versionarse. Hasta que exista, el primer test falla a propósito: un snapshot ausente no es una referencia.
 * Se regenera (de nuevo con revisión) al fijar LAUNCH_DATE en F2 o al cambiar datos; cambiar un dato debe romperlo.
 * Con CI=true vitest no escribe snapshots nuevos.
 */
const SNAP = join(import.meta.dirname, '__snapshots__', 'challenge.reference.json')
const data = loadGameData()
const result = () => Object.fromEntries(REFERENCE_DATES.map((d) => [d, getDailyChallenge(d, data)]))

describe('snapshot de getDailyChallenge', () => {
  it('existe el snapshot de referencia revisado', () => {
    expect(existsSync(SNAP)).toBe(true)
  })

  it('coincide con el snapshot de referencia en las fechas de referencia', async () => {
    await expect(JSON.stringify(result(), null, 2)).toMatchFileSnapshot(SNAP)
  })

  it('cada fecha de referencia incluye number, trainer, variant, rivalTeam, playerTeam y meta', () => {
    const r = result()
    for (const d of REFERENCE_DATES) {
      expect(Object.keys(r[d])).toEqual(expect.arrayContaining(['number', 'trainer', 'variant', 'rivalTeam', 'playerTeam', 'meta']))
    }
  })

  it('cambiar un dato (un movimiento de todos los rivales) cambia el reto', () => {
    const changed = structuredClone(data)
    for (const t of changed.trainers) for (const v of t.variants) for (const s of v.team) s.moves[0] = 'splash'
    const a = Object.values(result())
    const b = REFERENCE_DATES.map((d) => getDailyChallenge(d, changed))
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a))
  })
})
