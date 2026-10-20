import { DataError } from '../core/errors'
import type { NamesEs } from '../core/types'

export type NameCategory = keyof NamesEs

/** Nombre en español de un id de @pkmn. Nunca devuelve el id: un nombre ausente es un error de datos (RF-21). */
export function nameEs(names: NamesEs, category: NameCategory, id: string): string {
  const name = names[category][id]
  if (!name) throw new DataError(`Falta el nombre en español de «${id}» (${category}).`)
  return name
}
