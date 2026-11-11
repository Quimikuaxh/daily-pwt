import { describe, expect, it } from 'vitest'
import { importScript } from '../src/test-utils/paths'

const { buildMoves, parseDescriptions } = await importScript('scripts/build-emerald-moves.mjs')

// UT-174 · Generador de movimientos de Esmeralda (gen:emerald-moves): textos del juego con sus saltos y datos de Gen 3.
const header = `
static const u8 sPoundDescription[] = _(
    "Pounds the foe with\\n"
    "forelegs or tail.");
static const u8 sBiteDescription[] = _(
    "Bites with vicious fangs.\\n"
    "May cause flinching.");
const u8 *const gMoveDescriptionPointers[MOVES_COUNT - 1] =
{
    [MOVE_POUND - 1] = sPoundDescription,
    [MOVE_BITE - 1] = sBiteDescription,
};`

describe('gen:emerald-moves', () => {
  it('lee cada descripción con su salto y la asigna a su movimiento', () => {
    expect(parseDescriptions(header)).toEqual({ pound: 'Pounds the foe with\nforelegs or tail.', bite: 'Bites with vicious fangs.\nMay cause flinching.' })
  })

  it('solo incluye los movimientos de la campaña, con la categoría de Gen 3 por tipo', () => {
    const progression = { species: { a: { levelUp: [{ level: 1, move: 'pound' }], machines: ['bite'] } } }
    const moves = buildMoves(progression, parseDescriptions(header))
    expect(Object.keys(moves)).toEqual(['bite', 'pound'])
    expect(moves.bite).toMatchObject({ type: 'Dark', category: 'Special', power: 60, accuracy: 100, pp: 25 })
    expect(moves.pound).toMatchObject({ type: 'Normal', category: 'Physical', power: 40 })
  })

  it('falla si un movimiento de la campaña no tiene descripción', () => {
    expect(() => buildMoves({ species: { a: { levelUp: [{ level: 1, move: 'tackle' }], machines: [] } } }, {})).toThrow(/tackle/)
  })
})
