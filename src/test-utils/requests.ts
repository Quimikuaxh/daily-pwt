/**
 * Builders de `request` en el formato del simulador de Pokémon Showdown (lo que llega en `update.request`).
 * DEC-11: la UI y la IA trivial leen las restricciones de aquí, no las reimplementan.
 */
export type PsMove = { move: string; id: string; pp?: number; maxpp?: number; target?: string; disabled?: boolean }
export type PsSidePokemon = { ident: string; details: string; condition: string; active: boolean; moves?: string[]; item?: string; baseAbility?: string }
export type PsRequest = {
  rqid?: number
  active?: { moves: PsMove[]; trapped?: boolean; maybeTrapped?: boolean }[]
  forceSwitch?: boolean[]
  wait?: boolean
  side: { name: string; id: string; pokemon: PsSidePokemon[] }
}

export const mkPsMove = (id: string, move: string, over: Partial<PsMove> = {}): PsMove =>
  ({ move, id, pp: 16, maxpp: 16, target: 'normal', disabled: false, ...over })

export const mkSidePokemon = (species: string, over: Partial<PsSidePokemon> & { fainted?: boolean } = {}): PsSidePokemon => {
  const { fainted, ...rest } = over
  return {
    ident: `p1: ${species}`,
    details: `${species}, L50`,
    condition: fainted ? '0 fnt' : '150/150',
    active: false,
    ...rest,
  }
}

export function mkRequest(opts: {
  moves?: PsMove[]
  trapped?: boolean
  side?: PsSidePokemon[]
  forceSwitch?: boolean
  wait?: boolean
}): PsRequest {
  const side = {
    name: 'Jugador', id: 'p1',
    pokemon: opts.side ?? [mkSidePokemon('Garchomp', { active: true }), mkSidePokemon('Starmie'), mkSidePokemon('Gengar')],
  }
  if (opts.wait) return { wait: true, side }
  if (opts.forceSwitch) return { forceSwitch: [true], side }
  return { active: [{ moves: opts.moves ?? [mkPsMove('earthquake', 'Earthquake'), mkPsMove('outrage', 'Outrage'), mkPsMove('stoneedge', 'Stone Edge'), mkPsMove('swordsdance', 'Swords Dance')], trapped: opts.trapped }], side }
}
