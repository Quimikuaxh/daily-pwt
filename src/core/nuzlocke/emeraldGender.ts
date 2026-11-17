/**
 * Sexo de los Pokémon de los entrenadores de Esmeralda (Jose, 17/11/2026: el del juego original). No es azar: CreateNPCTrainerParty
 * (pokeemerald, src/battle_main.c, revisión 731ad5bf) da a cada Pokémon un valor de personalidad cuyo byte bajo es fijo, 0x80 en los
 * combates dobles, 0x78 con entrenadora (F_TRAINER_FEMALE) y 0x88 con entrenador; el resto del valor (el hash de los nombres) no influye
 * en el sexo. GetGenderFromSpeciesAndPersonality: hembra si la proporción de la especie (PERCENT_FEMALE, 0–254) supera ese byte.
 */
export const EMERALD_TRAINER_PERSONALITY: Readonly<Record<string, number>> = {
  // src/data/trainers.h: Petra (ROXANNE_1), Candela (FLANNERY_1), Alana (WINONA_1), Fátima (PHOEBE) y Nívea (GLACIA) son entrenadoras;
  // Vito y Leti (TATE_AND_LIZA_1) es un combate doble en el original, aunque en la campaña sea individual.
  petra: 0x78, marcial: 0x88, erico: 0x88, candela: 0x78, norman: 0x88, alana: 0x78, 'vito-y-leti': 0x80, galano: 0x88,
  sixto: 0x88, fatima: 0x78, nivea: 0x78, dracon: 0x88, plubio: 0x88,
}

/** `femaleShare`: proporción de hembras (0–1); `null` sin sexo. Devuelve el sexo con el que sale en el juego original. */
export function emeraldTrainerGender(femaleShare: number | null, personality: number): 'M' | 'F' | null {
  if (femaleShare === null) return null
  if (femaleShare <= 0) return 'M'
  if (femaleShare >= 1) return 'F'
  // PERCENT_FEMALE(percent) = min(254, percent * 255 / 100), en enteros como el macro.
  const ratio = Math.min(254, Math.floor((femaleShare * 100 * 255) / 100))
  return ratio > (personality & 0xff) ? 'F' : 'M'
}

/**
 * Sexo de un Pokémon rival de la campaña (Jose, 17/11/2026: el del juego original; si no tiene, lo sortea el simulador). Teselia lo trae en
 * su catálogo; en Hoenn sale de la regla de Esmeralda con el entrenador del encuentro. `femaleShareOf` da la proporción de hembras de la
 * especie: el simulador en el worker y el dex de la app en la interfaz, para no cargar el simulador en el hilo principal.
 */
export function campaignRivalGender(encounterId: string, generation: number, member: { species: string; gender?: 'M' | 'F' | null },
  femaleShareOf: (species: string) => number | null | undefined): 'M' | 'F' | null | undefined {
  if (member.gender !== undefined) return member.gender
  const personality = EMERALD_TRAINER_PERSONALITY[encounterId]
  if (personality === undefined || generation !== 3) return undefined
  const share = femaleShareOf(member.species)
  return share === undefined ? undefined : emeraldTrainerGender(share, personality) ?? undefined
}
