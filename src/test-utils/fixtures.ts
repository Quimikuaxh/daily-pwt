import { gen5, makeDex, makeNames, statsOf, toId } from './dex'
import type { GameData, PokemonSet, ResolvedSet, Trainer, TeamVariant } from './types'

/** Atajo para un set de datos (PokemonSet). */
export function mkSet(
  species: string,
  item: string,
  abilities: string[],
  moves: [string, string, string, string],
  extra: Partial<PokemonSet> = {},
): PokemonSet {
  return { species, level: 50, item, abilities, moves, verified: true, ...extra }
}

/** Atajo para un ResolvedSet (jugador: IV 31 / EV 0; rival: ivs configurables). */
export function mkResolved(
  species: string,
  item: string,
  ability: string,
  moves: [string, string, string, string],
  extra: Partial<ResolvedSet> = {},
): ResolvedSet {
  return {
    species,
    nameEs: gen5.species.get(species)?.name ?? species,
    level: 50,
    item,
    ability,
    moves,
    nature: 'Serious',
    ivs: statsOf(31),
    evs: statsOf(0),
    ...extra,
  }
}

const X = 'splash' // relleno inocuo para completar los 4 movimientos
const url = 'https://example.test/torneo'

function variant(id: string, tournament: string, team: PokemonSet[]): TeamVariant {
  return { id, sourceTournament: tournament, sourceUrl: url, team }
}

export const trainerAlpha: Trainer = {
  id: 'alpha', nameEs: 'Alfa', nameEn: 'Alpha', category: 'leader', region: 'kanto', specialtyType: 'Rock',
  sprite: 'alpha', ivs: 20, alwaysLeadsWith: 'onix',
  variants: [
    variant('alpha-a', 'Kanto Leaders', [
      mkSet('onix', 'everstone', ['sturdy'], ['rockslide', 'earthquake', 'stealthrock', X]),
      mkSet('golem', 'leftovers', ['sturdy'], ['earthquake', 'rockslide', 'explosion', X]),
      mkSet('kabutops', 'lifeorb', ['swiftswim'], ['waterfall', 'stoneedge', 'swordsdance', X]),
      mkSet('omastar', 'sitrusberry', ['shellarmor'], ['surf', 'icebeam', 'stealthrock', X]),
      mkSet('aerodactyl', 'choicescarf', ['pressure'], ['stoneedge', 'earthquake', 'roost', X]),
      mkSet('relicanth', 'leftovers', ['swiftswim'], ['waterfall', 'headsmash', 'earthquake', X]),
    ]),
    variant('alpha-b', 'World Leaders', [
      mkSet('onix', 'everstone', ['sturdy'], ['rockslide', 'earthquake', 'stealthrock', X]),
      mkSet('golem', 'leftovers', ['sturdy'], ['earthquake', 'rockslide', 'explosion', X]),
      mkSet('kabutops', 'lifeorb', ['swiftswim'], ['waterfall', 'stoneedge', 'swordsdance', X]),
      mkSet('tyranitar', 'leftovers', ['sandstream'], ['crunch', 'stoneedge', 'earthquake', X]),
      mkSet('aerodactyl', 'choicescarf', ['pressure'], ['stoneedge', 'earthquake', 'roost', X]),
      mkSet('rhyperior', 'lifeorb', ['solidrock'], ['earthquake', 'rockblast', 'megahorn', X]),
    ]),
  ],
}

export const trainerBeta: Trainer = {
  id: 'beta', nameEs: 'Beta', nameEn: 'Beta', category: 'leader', region: 'kanto', specialtyType: 'Water',
  sprite: 'beta', ivs: 20, alwaysLeadsWith: 'starmie',
  variants: [
    variant('beta-a', 'Kanto Leaders', [
      mkSet('starmie', 'leftovers', ['naturalcure', 'illuminate'], ['surf', 'icebeam', 'thunderbolt', X]),
      mkSet('gyarados', 'sitrusberry', ['intimidate'], ['waterfall', 'earthquake', 'dragondance', X]),
      mkSet('lapras', 'leftovers', ['waterabsorb', 'shellarmor'], ['surf', 'icebeam', 'thunderbolt', X]),
      mkSet('golduck', 'lifeorb', ['cloudnine'], ['surf', 'icebeam', 'psyshock', X]),
      mkSet('quagsire', 'leftovers', ['waterabsorb'], ['earthquake', 'recover', 'toxic', X]),
      mkSet('politoed', 'leftovers', ['drizzle'], ['surf', 'icebeam', 'toxic', X]),
    ]),
  ],
}

export const trainerGamma: Trainer = {
  id: 'gamma', nameEs: 'Gamma', nameEn: 'Gamma', category: 'champion', region: null,
  sprite: 'gamma', ivs: 30,
  variants: [
    variant('gamma-a', 'Champions', [
      mkSet('pikachu', 'lightball', ['static'], ['thunderbolt', 'irontail', 'brickbreak', X]),
      mkSet('venusaur', 'whiteherb', ['overgrow'], ['leafstorm', 'sludgebomb', 'earthquake', X]),
      mkSet('charizard', 'focussash', ['blaze'], ['fireblast', 'aerialace', 'dragonpulse', X]),
      mkSet('blastoise', 'choicescarf', ['torrent'], ['surf', 'icebeam', 'aurasphere', X]),
      mkSet('snorlax', 'quickclaw', ['immunity', 'thickfat'], ['bodyslam', 'earthquake', 'crunch', X]),
      mkSet('lapras', 'sitrusberry', ['waterabsorb', 'shellarmor'], ['icebeam', 'surf', 'thunderbolt', X]),
    ]),
  ],
}

/** Pool sintético: totalmente evolucionados, tipos variados, objetos distintos. */
export const poolSets: PokemonSet[] = [
  mkSet('garchomp', 'lifeorb', ['roughskin'], ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { tags: ['source:alpha'] }),
  mkSet('gengar', 'focussash', ['levitate'], ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast'], { tags: ['source:beta'] }),
  mkSet('scizor', 'choiceband', ['technician'], ['bulletpunch', 'uturn', 'superpower', 'roost'], { tags: ['source:gamma'] }),
  mkSet('heatran', 'airballoon', ['flashfire'], ['fireblast', 'earthpower', 'flashcannon', 'stealthrock'], { tags: ['source:alpha'] }),
  mkSet('milotic', 'leftovers', ['marvelscale'], ['surf', 'icebeam', 'recover', 'toxic'], { tags: ['source:beta'] }),
  mkSet('jolteon', 'expertbelt', ['voltabsorb'], ['thunderbolt', 'shadowball', 'hiddenpowerice', 'voltswitch'], { tags: ['source:gamma'] }),
  mkSet('ferrothorn', 'rockyhelmet', ['ironbarbs'], ['leechseed', 'gyroball', 'stealthrock', 'powerwhip'], { tags: ['source:alpha'] }),
  mkSet('infernape', 'lifeorb', ['blaze'], ['closecombat', 'flareblitz', 'uturn', 'machpunch'], { tags: ['source:beta'] }),
  mkSet('blissey', 'sitrusberry', ['naturalcure'], ['softboiled', 'toxic', 'seismictoss', 'thunderwave'], { tags: ['source:gamma'] }),
  mkSet('skarmory', 'shedshell', ['sturdy'], ['roost', 'spikes', 'bravebird', 'whirlwind'], { tags: ['source:alpha'] }),
  mkSet('excadrill', 'focussash', ['sandrush'], ['earthquake', 'ironhead', 'rockslide', 'swordsdance'], { tags: ['source:beta'] }),
  mkSet('togekiss', 'wiseglasses', ['serenegrace'], ['airslash', 'aurasphere', 'nastyplot', 'roost'], { tags: ['source:gamma'] }),
  mkSet('lucario', 'metronome', ['innerfocus'], ['closecombat', 'extremespeed', 'crunch', 'swordsdance'], { tags: ['source:alpha'] }),
  mkSet('tentacruel', 'blacksludge', ['clearbody'], ['surf', 'sludgebomb', 'toxicspikes', 'rapidspin'], { tags: ['source:beta'] }),
  mkSet('flygon', 'yacheberry', ['levitate'], ['earthquake', 'uturn', 'dragonclaw', 'roost'], { tags: ['source:gamma'] }),
  mkSet('snorlax', 'chestoberry', ['immunity'], ['bodyslam', 'rest', 'earthquake', 'curse'], { tags: ['source:gamma'] }),
]

function allIds(trainers: Trainer[], pool: PokemonSet[]) {
  const sets = [...trainers.flatMap((t) => t.variants.flatMap((v) => v.team)), ...pool]
  return {
    species: sets.map((s) => s.species),
    moves: sets.flatMap((s) => s.moves).filter((m) => m !== 'struggle'),
    abilities: sets.flatMap((s) => s.abilities),
    items: sets.map((s) => s.item),
  }
}

/** GameData sintético mínimo: 3 entrenadores (ciclo de 3 días), 16 sets de pool. */
export function makeGameData(over: Partial<GameData> = {}): GameData {
  const trainers = over.trainers ?? [trainerAlpha, trainerBeta, trainerGamma]
  const pool = over.playerSets ?? poolSets
  const ids = allIds(trainers, pool)
  return {
    dataVersion: 'test-1',
    trainers,
    rosterSchedule: [{ fromDayIndex: 0, trainerIds: trainers.map((t) => t.id) }],
    playerSets: pool,
    dex: makeDex(ids.species, ids.moves),
    names: makeNames(ids),
    ...over,
  }
}

/** Pool imposible para RF-14: todos los sets sin ningún movimiento de daño ×2 contra el rival Normal. */
export function impossibleRf14Data(): GameData {
  // Rival de un solo Pokémon repetido de tipo Normal (los Normal solo reciben ×2 de Lucha).
  const rival: Trainer = {
    ...trainerGamma, id: 'normalrival', alwaysLeadsWith: undefined,
    variants: [variant('normalrival-a', 'Champions', Array.from({ length: 6 }, () =>
      mkSet('snorlax', 'leftovers', ['immunity'], ['bodyslam', 'rest', 'curse', X])))],
  }
  const pool = [
    mkSet('milotic', 'leftovers', ['marvelscale'], ['surf', 'recover', 'toxic', X], { tags: ['source:other'] }),
    mkSet('jolteon', 'lifeorb', ['voltabsorb'], ['thunderbolt', 'thunderwave', X, 'toxic'], { tags: ['source:other'] }),
    mkSet('garchomp', 'choicescarf', ['roughskin'], ['earthquake', 'outrage', 'swordsdance', X], { tags: ['source:other'] }),
    mkSet('heatran', 'airballoon', ['flashfire'], ['fireblast', 'toxic', 'stealthrock', X], { tags: ['source:other'] }),
    mkSet('skarmory', 'shedshell', ['sturdy'], ['roost', 'spikes', 'whirlwind', X], { tags: ['source:other'] }),
    mkSet('togekiss', 'wiseglasses', ['serenegrace'], ['airslash', 'roost', 'nastyplot', X], { tags: ['source:other'] }),
  ]
  return makeGameData({ trainers: [rival], playerSets: pool })
}

/** Pool que nunca puede dar 4 tipos distintos (todos Agua) -> error de datos. */
export function fewTypesData(): GameData {
  const pool = ['milotic', 'vaporeon', 'golduck', 'politoed', 'blastoise', 'feraligatr', 'samurott', 'seaking']
    .map((sp, i) => mkSet(sp, ['leftovers', 'lifeorb', 'sitrusberry', 'chestoberry', 'shedshell', 'expertbelt', 'metronome', 'yacheberry'][i],
      ['pressure'], ['surf', 'icebeam', 'thunderbolt', 'toxic'], { tags: ['source:other'] }))
  return makeGameData({ playerSets: pool })
}

export { toId }
