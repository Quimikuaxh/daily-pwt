/**
 * Utilidades de nombres copiadas de claude-test/backend/src/randomizer/dexNames.ts
 * (sin acceso a base de datos ni red).
 */

/** Identificador de PokeAPI: minúsculas con guiones. */
export function toSlug(name) {
  // Los apóstrofos se borran en vez de separar: PokeAPI llama `kings-rock` a King's Rock,
  // y `king-s-rock` no existe. Las tildes se descomponen (Poké Ball -> poke-ball).
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’´`.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const TIPOS_ES = {
  bug: 'Bicho', dark: 'Siniestro', dragon: 'Dragón', electric: 'Eléctrico',
  fairy: 'Hada', fighting: 'Lucha', fire: 'Fuego', flying: 'Volador',
  ghost: 'Fantasma', grass: 'Planta', ground: 'Tierra', ice: 'Hielo',
  normal: 'Normal', poison: 'Veneno', psychic: 'Psíquico', rock: 'Roca',
  steel: 'Acero', water: 'Agua',
}

/** Nombres con grafía distinta en PokeAPI, para reintentar con la suya. */
export const SLUGS_ALTERNATIVOS = {
  'vise-grip': 'vice-grip',
}

/** Traducción que se puede resolver sin datos externos: Hidden Power <Tipo> no existe en PokeAPI. */
export function traduccionDerivada(name) {
  const oculto = /^hidden power\s+(\w+)$/i.exec(name.trim())
  if (oculto) {
    const tipo = TIPOS_ES[oculto[1].toLowerCase()]
    return tipo ? `Poder Oculto ${tipo}` : null
  }
  return null
}
