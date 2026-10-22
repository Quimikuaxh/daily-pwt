import { writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gen5, toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'

const OUTPUT_PATH = fromRoot('src', 'generated', 'icon-index.json')

/**
 * Iconos propios de las formas de Gen 5 en la hoja: `BattlePokemonIconIndexes` del cliente de Showdown
 * (https://github.com/smogon/pokemon-showdown-client, `play.pokemonshowdown.com/src/battle-dex-data.ts`), comprobados a ojo sobre la hoja.
 */
const FORM_ICONS = {
  'castform-rainy': 1067, 'castform-snowy': 1068, 'castform-sunny': 1069,
  'deoxys-attack': 1070, 'deoxys-defense': 1071, 'deoxys-speed': 1072,
  'wormadam-sandy': 1075, 'wormadam-trash': 1076, 'cherrim-sunshine': 1077,
  'rotom-fan': 1080, 'rotom-frost': 1081, 'rotom-heat': 1082, 'rotom-mow': 1083, 'rotom-wash': 1084,
  'giratina-origin': 1085, 'shaymin-sky': 1086, 'basculin-bluestriped': 1088, 'darmanitan-zen': 1089,
  'tornadus-therian': 1098, 'thundurus-therian': 1099, 'landorus-therian': 1100,
  'kyurem-black': 1101, 'kyurem-white': 1102, 'keldeo-resolute': 1103, 'meloetta-pirouette': 1104,
  'arceus-bug': 1278, 'arceus-dark': 1279, 'arceus-dragon': 1280, 'arceus-electric': 1281, 'arceus-fighting': 1283,
  'arceus-fire': 1284, 'arceus-flying': 1285, 'arceus-ghost': 1286, 'arceus-grass': 1287, 'arceus-ground': 1288,
  'arceus-ice': 1289, 'arceus-poison': 1290, 'arceus-psychic': 1291, 'arceus-rock': 1292, 'arceus-steel': 1293,
  'arceus-water': 1294, 'genesect-douse': 1295, 'genesect-shock': 1296, 'genesect-burn': 1297, 'genesect-chill': 1298,
}

/**
 * Posición de cada especie en la hoja de iconos de Showdown (`public/ui/battle/party/icons-sheet.png`: 12 columnas de 40x30).
 * El índice es el número de Pokédex; las formas (Rotom-Frost, Landorus-Therian…) tienen su propio icono (`FORM_ICONS`).
 * Clave = `spriteId` del dex (el mismo nombre que el sprite).
 */
export function buildIconIndex() {
  const index = {}
  for (const entry of [...gen5.species].sort((a, b) => a.num - b.num)) {
    const spriteId = toId(entry.baseSpecies) + (entry.forme ? `-${toId(entry.forme)}` : '')
    if (entry.num <= 0) continue
    if (entry.forme && !(spriteId in FORM_ICONS)) throw new Error(`Forma sin icono en FORM_ICONS: ${spriteId}`)
    index[spriteId] = FORM_ICONS[spriteId] ?? entry.num
  }
  return index
}

if (isMain(import.meta.url)) {
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(buildIconIndex())}\n`)
  console.log(`Escrito ${OUTPUT_PATH}`)
}
