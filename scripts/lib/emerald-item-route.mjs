// Anotaciones geográficas revisables: no son desbloqueos de la campaña.
// Los eventos y sus banderas se extraen aparte del código fijado de Esmeralda.
const regions = [
  ['petra', [], [ 'LittlerootTown', 'Route101', 'Route102', 'Route103', 'PetalburgWoods', 'Route116','Route104', 'RustboroCity']],
  ['marcial', ['rescate de Peeko; carta de Devon; barco de Mr. Briney'], [ 'Route109', 'Route117',
    'GraniteCave', 'DewfordTown', 'SlateportCity', 'MauvilleCity', 'VerdanturfTown', 'Route110',
  ]],
  ['candela', ['FLAG_BADGE03_GET', 'MO06: Rock Smash'], [ 'Route112', 'JaggedPass',
    'Route111', 'Route113', 'Route114', 'MeteorFalls', 'FallarborTown', 'LavaridgeTown', 'RusturfTunnel',
  ]],
  ['norman', ['FLAG_BADGE04_GET', 'MO04: Strength'], [ 'MirageTower','FieryPath']],
  ['alana', ['FLAG_BADGE05_GET', 'MO03: Surf'], [ 'Route118', 'Route130',
    'Route115', 'Route119', 'Route123', 'Route124', 'Route126', 'FortreeCity', 'LilycoveCity', 'MossdeepCity',
    'PacifidlogTown', 'NewMauville', 'AbandonedShip', 'ScorchedSlab', 'SafariZone', 'MtPyre', 'ShoalCave',
    'Route132', 'Route133', 'Route134',
  ]],
  ['vito-y-leti', ['FLAG_BADGE06_GET', 'Visor Devon tras Alana'], ['Route120', 'Route121', 'MagmaHideout']],
  ['galano', ['FLAG_BADGE07_GET', 'MO08: Dive'], [ 'SkyPillar','SootopolisCity', 'SeafloorCavern']],
  ['sixto', ['FLAG_BADGE08_GET', 'MO07: Waterfall'], ['VictoryRoad']],
]

const gyms = {
  RustboroCity: 'marcial', DewfordTown: 'erico', MauvilleCity: 'candela', LavaridgeTown: 'norman',
  PetalburgCity: 'alana', FortreeCity: 'vito-y-leti', MossdeepCity: 'galano', SootopolisCity: 'sixto',
}

export function itemRoute(map, label, item) {
  if (map?.startsWith('Underwater_')) return { earliestBefore: 'galano', requirements: ['FLAG_BADGE07_GET', 'MO08: Dive'] }
  if (/^ITEM_(RED|BLUE|GREEN)_SHARD$/.test(item)) return {
    earliestBefore: 'galano', requirements: ['FLAG_BADGE07_GET', 'MO08: Dive', 'isla aislada: acceso por los pasajes submarinos de Rutas 124/126'],
  }
  if (map?.startsWith('BattleFrontier') || map?.startsWith('SSTidal') || map?.startsWith('DesertUnderpass') || map?.startsWith('AlteringCave')) {
    return { earliestBefore: null, requirements: ['FLAG_SYS_GAME_CLEAR'], decision: 'postgame' }
  }
  if (map?.includes('_Gym')) {
    const city = map.split('_')[0]
    const badge = Object.keys(gyms).indexOf(city) + 1
    return { earliestBefore: gyms[city], requirements: [`FLAG_BADGE0${badge}_GET`] }
  }
  if (item === 'ITEM_HM_SURF') return { earliestBefore: 'alana', requirements: ['FLAG_BADGE05_GET'] }
  if (item === 'ITEM_HM_DIVE') return {
    earliestBefore: label.endsWith('DiveItemBall') ? null : 'galano',
    requirements: label.endsWith('DiveItemBall') ? ['FLAG_SYS_GAME_CLEAR'] : ['FLAG_BADGE07_GET', 'Centro Espacial: combate con Steven'],
    ...(label.endsWith('DiveItemBall') ? { decision: 'postgame' } : {}),
  }
  if (item === 'ITEM_HM_STRENGTH') return { earliestBefore: 'candela', requirements: ['FLAG_BADGE03_GET', 'MO06: Rock Smash'] }
  if (item === 'ITEM_HM_FLY') return { earliestBefore: 'alana', requirements: ['FLAG_BADGE05_GET', 'MO03: Surf', 'Instituto Meteorológico y combate del rival en Ruta 119'] }
  if (item === 'ITEM_HM_WATERFALL') return { earliestBefore: 'galano', requirements: ['FLAG_BADGE07_GET', 'resolución de la crisis de Rayquaza'] }
  if (item === 'ITEM_TM_SLUDGE_BOMB') return { earliestBefore: 'alana', requirements: ['FLAG_BADGE05_GET', 'clearflag FLAG_HIDE_DEWFORD_HALL_SLUDGE_BOMB_MAN'] }
  if (label.includes('CompletedNewMauville')) return { earliestBefore: 'alana', requirements: ['FLAG_BADGE05_GET', 'MO03: Surf', 'apagar el generador de Malvalanova'] }
  if (item === 'ITEM_TM_TAUNT') return { earliestBefore: 'vito-y-leti', requirements: ['FLAG_BADGE06_GET', 'VAR_TRICK_HOUSE_LEVEL: puzzle 5'] }
  // Premios de la Casa Trampa: el puzle N se abre con la medalla N + 1 (como el 5, la MT de Mofa, con la 6.ª).
  const trickPuzzle = map?.startsWith('Route110_TrickHouse') && label.match(/Puzzle(\d)/)?.[1]
  if (trickPuzzle) {
    const badge = Number(trickPuzzle) + 1
    return { earliestBefore: ['petra', 'marcial', 'erico', 'candela', 'norman', 'alana', 'vito-y-leti', 'galano', 'sixto'][badge], requirements: [`FLAG_BADGE0${badge}_GET`, `VAR_TRICK_HOUSE_LEVEL: puzzle ${trickPuzzle}`] }
  }
  if (item === 'ITEM_TM_SANDSTORM') return { earliestBefore: 'norman', requirements: ['gafas aislantes tras Candela'] }
  if ((map?.startsWith('MeteorFalls_') && map !== 'MeteorFalls_1F_1R') || item === 'ITEM_TM_IRON_TAIL') return { earliestBefore: 'sixto', requirements: ['FLAG_BADGE08_GET', 'MO07: Waterfall'] }
  if (map?.startsWith('AbandonedShip_HiddenFloor')) return { earliestBefore: 'galano', requirements: ['FLAG_BADGE07_GET', 'MO08: Dive', 'llaves de los camarotes'] }
  if (map === 'RustboroCity_CuttersHouse') return { earliestBefore: 'petra', requirements: [] }
  if (label.endsWith('SunStoneManMagma')) return { earliestBefore: 'galano', requirements: ['FLAG_BADGE07_GET', 'VAR_MOSSDEEP_CITY_STATE == 2'] }
  const region = regions.find(([, , prefixes]) => prefixes.some(prefix => map === prefix || map?.startsWith(`${prefix}_`)))
  if (!region) throw new Error(`Mapa sin anotación de ruta: ${map} (${label})`)
  const [earliestBefore, requirements] = region
  const extra = []
  if (map === 'SafariZone_Northwest') extra.push('Bici Acrobática')
  if (map === 'ShoalCave_LowTideIceRoom') extra.push('marea baja', 'FLAG_BADGE04_GET', 'MO04: Strength')
  if (item === 'ITEM_LEAF_STONE' && map === 'Route119') extra.push('tramo acuático accesible con Surf')
  if (map === 'GraniteCave_StevensRoom') extra.push('entregar la carta de Devon')
  if (map === 'FallarborTown_CozmosHouse') extra.push('devolver el meteorito de Mt. Chimney')
  if (map?.startsWith('Route124_Diving')) {
    const resource = { ITEM_FIRE_STONE: 'redshard', ITEM_THUNDER_STONE: 'yellowshard', ITEM_WATER_STONE: 'blueshard', ITEM_LEAF_STONE: 'greenshard' }[item]
    return { earliestBefore: resource === 'yellowshard' ? 'alana' : 'galano',
      requirements: [...requirements, resource, ...(resource === 'yellowshard' ? [] : ['FLAG_BADGE07_GET', 'MO08: Dive'])], resource }
  }
  if (map === 'PacifidlogTown_House2') return {
    earliestBefore, requirements: [...requirements, 'amistad del primer Pokémon; límite semanal'], decision: 'friendship-reward',
  }
  if (item.startsWith('ITEM_DEEP_SEA_')) return {
    earliestBefore: 'galano', requirements: ['FLAG_BADGE07_GET', 'MO08: Dive', 'ITEM_SCANNER'], decision: 'scanner-choice',
  }
  return { earliestBefore, requirements: [...requirements, ...extra] }
}
