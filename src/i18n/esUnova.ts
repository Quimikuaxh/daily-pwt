/**
 * Textos de la campaña de Teselia (N2/B2; maqueta Ruta A3 aprobada el 13/11/2026: nombres de la edición española). Aparte de esCampaign
 * para que solo los cargue el módulo de Teselia (unovaKit, con `import()`) y no pesen en la ruta crítica del reto diario (E2E-21). La
 * entrada de Modos de juego, que sí usa la portada, sigue en `esCampaign.unovaEntry`.
 */
export const esUnova = {
  modeLabel: 'Nuzlocke · Teselia',
  region: 'TESELIA',
  cities: {
    cheren: 'Ciudad Engobe', hiedra: 'Ciudad Hormigón', camus: 'Ciudad Porcelana', camila: 'Ciudad Mayólica', yakon: 'Ciudad Fayenza',
    gerania: 'Ciudad Loza', lirio: 'Ciudad Caolín', ciprian: 'Ciudad Marga', iris: 'Liga Pokémon',
  } as Record<string, string>,
  types: {
    cheren: 'normal', hiedra: 'poison', camus: 'bug', camila: 'electric', yakon: 'ground', gerania: 'flying', lirio: 'dragon', ciprian: 'water',
  } as Record<string, string>,
  badges: {
    cheren: 'BÁSICA', hiedra: 'TÓXICA', camus: 'INSECTO', camila: 'VOLTIO', yakon: 'TEMBLOR', gerania: 'JET', lirio: 'LEYENDA', ciprian: 'OLA',
  } as Record<string, string>,
  typeNames: {
    normal: 'Normal', poison: 'Veneno', bug: 'Bicho', electric: 'Eléctrico', ground: 'Tierra', flying: 'Volador', dragon: 'Dragón', water: 'Agua',
  } as Record<string, string>,
  leaderTitle: (name: string) => `LÍDER ${name.toUpperCase()}`,
  eliteTitle: (name: string) => `ALTO MANDO ${name.toUpperCase()}`,
  championTitle: (name: string) => `CAMPEONA ${name.toUpperCase()}`,
  gymHead: (gym: number, city: string) => `Gimnasio ${gym} · ${city}`,
  leagueHead: 'Liga Pokémon',
  nextLine: (level: number) => `PRÓXIMO · Nv. máx. ${level}`,
  wonLine: (badge: string) => `SUPERADO · Medalla ${badge.charAt(0)}${badge.slice(1).toLowerCase()}`,
  pendingLine: (level: number) => `PENDIENTE · Nv. máx. ${level}`,
  leagueWonLine: 'SUPERADO',
  count: (n: number) => `${n} Pokémon`,
  medals: 'MEDALLAS',
  level: (n: number) => `Nv${n}`,
  // Draft (maqueta aprobada el 14/11/2026).
  draftTitle: 'ELIGE UN POKÉMON',
  draftPick: (n: number, total: number) => `${n} DE ${total}`,
  draftRival: (name: string, level: number) => `Rival: ${name.toUpperCase()} · Nv. máx. ${level}`,
  yourTeam: 'TU EQUIPO',
  yourTeamLabel: 'Ver tu equipo y la caja',
  // Movimientos (maqueta aprobada el 14/11/2026): la lista de lo que puede aprender y la categoría de Gen 5 en el texto accesible.
  canLearn: 'PUEDE APRENDER',
  categoryNames: { Physical: 'físico', Special: 'especial', Status: 'de estado' } as Record<string, string>,
  // Tienda (maqueta aprobada el 14/11/2026).
  shopTitle: 'CANJE DE PUNTOS BATALLA',
  shopLeft: (points: number) => `Te quedarían ${points} PB`,
  shopMissing: (points: number) => `Te faltan ${points} PB`,
  shopTeam: 'TU EQUIPO LLEVA',
  shopOwned: 'Tienes',
  // Evolución (maqueta aprobada el 14/11/2026): el botón grande del combate dice CONTINUAR.
  continueLabel: 'CONTINUAR',
  evolutionProgress: (n: number, total: number) => `Evolución ${n} de ${total}`,
  // Liga (maqueta aprobada el 14/11/2026): el orden de cada participante, dentro de su placa verde.
  leagueOrder: (n: number) => `${n}.º`,
  // Protagonistas de N2/B2 con su nombre de la edición española (Rizzo y Nanci; Nate y Rosa en inglés), según la semilla.
  protagonist: { brendan: 'Rizzo', may: 'Nanci' } as Record<'brendan' | 'may', string>,
  // Ficha de Entrenador de Teselia (maqueta del resultado, 14/11/2026): PB, especies y tiempo en lugar de dinero y Pokédex.
  cardTitle: 'FICHA DE ENTRENADOR',
  cardName: (name: string) => `NOMBRE: ${name}`,
  cardId: (id: string) => `ID Nº ${id}`,
  cardPoints: 'PUNTOS BATALLA',
  cardSpecies: 'ESPECIES',
  cardTime: 'TIEMPO',
  resultTeam: 'Tu equipo tras el combate.',
  // Salón de la Fama de Teselia (maqueta aprobada, 14/11/2026).
  hallBand: '¡Campeón de la Liga! ¡Enhorabuena!',
  hallTeam: 'Equipo campeón.',
  hallLabel: (names: string) => `Salón de la Fama. Campeones: ${names}. Continuar`,
  hallNext: 'Continuar a la pantalla final',
  // Imagen para compartir de Teselia (PRD §0, «Locke de N2/B2: compartir», 14/11/2026).
  shareLost: (rival: string) => `Derrota ante ${rival.toUpperCase()}`,
  shareMode: 'NUZLOCKE · TESELIA',
  shareFile: (date: string) => `nuzlocke-teselia-${date}.png`,
  shareDate: (date: string) => date.split('-').reverse().join('/'),
  shareText: (player: string, won: boolean, rival: string) =>
    won ? `¡${player} ha completado la Nuzlocke de Teselia en Daily PWT!` : `${player} cayó ante ${rival} en la Nuzlocke de Teselia de Daily PWT.`,
  leagueProgress: (beaten: number) => `Liga Pokémon: ${beaten} de 5 superados`,
  leagueMaxLevel: (level: number) => `Nivel máximo ${level}`,
  leagueBoxClosed: 'La CAJA está cerrada',
  leagueChoose: 'Elige de 1 a 6 Pokémon.',
  leagueLocked: 'La CAJA está cerrada.',
} as const
