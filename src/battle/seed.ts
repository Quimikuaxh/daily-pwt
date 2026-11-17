const SUBSTITUTE_AI_PREFIX = 'sub1:'

/** Los oficiales y directos antiguos fijan la política de la IA mediante la semilla con la que empezaron. */
export function substituteAiForSeed(seed: string): 'avoid-status' | 'legacy' {
  return seed.startsWith(SUBSTITUTE_AI_PREFIX) ? 'avoid-status' : 'legacy'
}

/** Semilla nueva para cada combate (RF-43): nunca sale del reto ni de la hora. */
export function newBattleSeed(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return SUBSTITUTE_AI_PREFIX + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
