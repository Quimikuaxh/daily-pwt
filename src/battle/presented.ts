import type { MonView, SideView } from './protocol'

/**
 * El activo tal como se ve en el campo: con Ilusión, con la especie del Pokémon que imita y lo demás (PS, estado, nivel por `teamIndex`)
 * del real. Para el sprite, el nombre y el género del combate; los menús y Datos usan el real (Jose, 17/11/2026).
 */
export function presentedActive(side: Pick<SideView, 'active' | 'team'>): MonView | null {
  const mon = side.active === null ? null : side.team[side.active] ?? null
  if (!mon || mon.illusion === undefined) return mon
  const disguise = side.team[mon.illusion]
  return disguise ? { ...mon, species: disguise.species } : mon
}

/** Índice del puesto que el combate presenta como activo (el imitado con Ilusión). */
export function presentedActiveIndex(side: Pick<SideView, 'active' | 'team'>): number | null {
  if (side.active === null) return null
  return side.team[side.active]?.illusion ?? side.active
}
