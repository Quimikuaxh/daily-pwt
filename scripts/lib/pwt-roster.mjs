/**
 * Roster del MVP (PRD §7.3): 46 líderes y 7 campeones del PWT de Negro 2 / Blanco 2.
 * `nameEn` es el nombre que usan Bulbapedia y Serebii; `nameEs` el de WikiDex (`wikidexHeading` solo si el encabezado difiere).
 * `gender` es el género gramatical ("La Líder", "El Campeón").
 */
const leader = (region, id, nameEn, nameEs, gender, extra = {}) => ({ id, nameEn, nameEs, category: 'leader', region, gender, ivs: 20, ...extra })
const champion = (region, id, nameEn, nameEs, gender, ivs = 25) => ({ id, nameEn, nameEs, category: 'champion', region, gender, ivs })

export const ROSTER = [
  leader('kanto', 'brock', 'Brock', 'Brock', 'M'),
  leader('kanto', 'misty', 'Misty', 'Misty', 'F'),
  leader('kanto', 'teniente-surge', 'Lt. Surge', 'Teniente Surge', 'M', { wikidexHeading: 'Lt. Surge' }),
  leader('kanto', 'erika', 'Erika', 'Erika', 'F'),
  leader('kanto', 'sachiko', 'Janine', 'Sachiko', 'F'),
  leader('kanto', 'sabrina', 'Sabrina', 'Sabrina', 'F'),
  leader('kanto', 'blaine', 'Blaine', 'Blaine', 'M'),
  leader('kanto', 'giovanni', 'Giovanni', 'Giovanni', 'M'),

  leader('johto', 'pegaso', 'Falkner', 'Pegaso', 'M'),
  leader('johto', 'anton', 'Bugsy', 'Antón', 'M'),
  leader('johto', 'blanca', 'Whitney', 'Blanca', 'F'),
  leader('johto', 'morti', 'Morty', 'Morti', 'M'),
  leader('johto', 'anibal', 'Chuck', 'Aníbal', 'M'),
  leader('johto', 'yasmina', 'Jasmine', 'Yasmina', 'F'),
  leader('johto', 'fredo', 'Pryce', 'Fredo', 'M'),
  leader('johto', 'debora', 'Clair', 'Débora', 'F'),

  leader('hoenn', 'petra', 'Roxanne', 'Petra', 'F'),
  leader('hoenn', 'marcial', 'Brawly', 'Marcial', 'M'),
  leader('hoenn', 'erico', 'Wattson', 'Erico', 'M'),
  leader('hoenn', 'candela', 'Flannery', 'Candela', 'F'),
  leader('hoenn', 'norman', 'Norman', 'Norman', 'M'),
  leader('hoenn', 'alana', 'Winona', 'Alana', 'F'),
  leader('hoenn', 'vito', 'Tate', 'Vito', 'M'),
  leader('hoenn', 'leti', 'Liza', 'Leti', 'F'),
  leader('hoenn', 'galano', 'Juan', 'Galano', 'M'),

  leader('sinnoh', 'roco', 'Roark', 'Roco', 'M'),
  leader('sinnoh', 'gardenia', 'Gardenia', 'Gardenia', 'F'),
  leader('sinnoh', 'brega', 'Maylene', 'Brega', 'F'),
  leader('sinnoh', 'mananti', 'Crasher Wake', 'Mananti', 'M'),
  leader('sinnoh', 'fantina', 'Fantina', 'Fantina', 'F'),
  leader('sinnoh', 'aceron', 'Byron', 'Acerón', 'M'),
  leader('sinnoh', 'inverna', 'Candice', 'Inverna', 'F'),
  leader('sinnoh', 'lectro', 'Volkner', 'Lectro', 'M'),

  leader('unova', 'millo', 'Cilan', 'Millo', 'M'),
  leader('unova', 'zeo', 'Chili', 'Zeo', 'M'),
  leader('unova', 'maiz', 'Cress', 'Maíz', 'M'),
  leader('unova', 'aloe', 'Lenora', 'Aloe', 'F'),
  leader('unova', 'camus', 'Burgh', 'Camus', 'M'),
  leader('unova', 'camila', 'Elesa', 'Camila', 'F'),
  leader('unova', 'yakon', 'Clay', 'Yakón', 'M'),
  leader('unova', 'gerania', 'Skyla', 'Gerania', 'F'),
  leader('unova', 'junco', 'Brycen', 'Junco', 'M'),
  leader('unova', 'lirio', 'Drayden', 'Lirio', 'M'),
  leader('unova', 'cheren', 'Cheren', 'Cheren', 'M'),
  leader('unova', 'hiedra', 'Roxie', 'Hiedra', 'F'),
  leader('unova', 'ciprian', 'Marlon', 'Ciprián', 'M'),

  champion('kanto', 'rojo', 'Red', 'Rojo', 'M', 30),
  champion('kanto', 'azul', 'Blue', 'Azul', 'M'),
  champion('johto', 'lance', 'Lance', 'Lance', 'M'),
  champion('hoenn', 'maximo', 'Steven', 'Máximo', 'M'),
  champion('hoenn', 'plubio', 'Wallace', 'Plubio', 'M'),
  champion('sinnoh', 'cintia', 'Cynthia', 'Cintia', 'F'),
  champion('unova', 'mirto', 'Alder', 'Mirto', 'M'),
]

const NAME_KEYS = { en: (trainer) => trainer.nameEn, es: (trainer) => trainer.wikidexHeading ?? trainer.nameEs }

/** Entrenador del roster a partir del nombre que usa una fuente ('en': Bulbapedia/Serebii; 'es': WikiDex), o null si no está en el roster. */
export function findRosterTrainer(sourceName, language) {
  return ROSTER.find((trainer) => NAME_KEYS[language](trainer) === sourceName || (language === 'es' && trainer.nameEs === sourceName)) ?? null
}

/**
 * Torneos de líderes en los que participa cada región; el Mundial y el Supertorneo Tipo incluyen a todos los líderes.
 * Torneo Campeones: solo los campeones.
 */
export function expectedTournaments(trainer) {
  if (trainer.category === 'champion') return ['champions']
  return [`${trainer.region}-leaders`, 'world-leaders']
}
