/** Id de @pkmn: minúsculas y solo letras y dígitos ("Stone Edge" -> "stoneedge"). */
export const toId = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '')
