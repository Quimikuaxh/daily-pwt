/** Compara datos JSON sin depender del orden de las claves; se usa al verificar una reconstrucción determinista. */
export function sameJson(left: unknown, right: unknown): boolean {
  const encode = (value: unknown) => JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
  return encode(left) === encode(right)
}
