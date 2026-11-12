/**
 * Pokémon Esmeralda (pret/pokeemerald 731ad5b), para la campaña de Hoenn. Recursos de `npm run gen:emerald-ui` (scripts/decomp/esmeralda.py):
 * interfaz en public/ui/emerald/, sprites en public/sprites/emerald/ y datos en src/generated/emerald/. Colores con su origen en el
 * decompilado, los mismos que las maquetas aprobadas (entrega-hoenn, 11/11/2026).
 */
import font from '../../../generated/emerald/font.json'
import battleColors from '../../../generated/emerald/battle-colors.json'
import { rgbHex, type ConsoleTheme, type TextColor } from '../theme'

const BASE = import.meta.env.BASE_URL
const ui = (name: string): string => `${BASE}ui/emerald/${name}.png`

const battle = Object.fromEntries(
  Object.entries(battleColors).map(([key, [ink, shadow]]) => [key, [rgbHex(ink), rgbHex(shadow)] as TextColor]),
)

export const emeraldTheme: ConsoleTheme = {
  id: 'emerald',
  name: 'Esmeralda',
  screen: { w: 240, h: 160 },
  // Dos pantallas apiladas, como las de la DS en el reto diario.
  screens: 2,
  font: {
    kind: 'bitmap',
    charmap: font.charmap,
    widths: font.fonts,
    glyph: { w: font.glyph.w, h: font.glyph.h, columns: font.glyph.columnas },
    mask: (face, layer) => ui(`fuente-${face}-${layer === 'ink' ? 'tinta' : 'sombra'}`),
    numberPad: font.rellenoNumerico,
  },
  // Ventana estándar, marco 1 (el de una partida nueva).
  frame: { image: ui('marco-1'), tile: 8, slice: 8 },
  colors: {
    ...battle,
    ventana: ['#626262', '#d5d5cd'], // texto estándar sobre ventana blanca (std_menu.pal)
    'ventana-off': ['#b4b4b4', '#e6e6e6'], // opción que no se puede elegir ahora (CAMBIAR fuera de turno)
    blanco: ['#f8f8f8', '#606060'],
    salon: ['#ffffff', '#626262'], // hall_of_fame.c: sMonInfoTextColors
    domo: ['#ffffff', '#4a4a4a'], // ficha del Domo: índices 14 y 13 de battle_interface/text.pal
    fabrica: ['#ffffff', '#000000'], // Fábrica Batalla: factory_screen/text.pal (2 y 3)
    'fabrica-menu': ['#ffffff', null], // sMenuOptionTextColors: sin sombra
    especie: ['#ff0000', null], // sSpeciesNameTextColors
    datos: ['#000000', '#d5d5cd'], // Datos del Pokémon, paleta 6 de summary_screen/tiles.png, color 0
    'datos-rotulo': ['#ffffff', '#626262'], // ídem, color 1
    'datos-pp': ['#4a4a4a', '#dedede'], // gPPTextPalette, banco 8, estado 12
    tira: ['#ffffff', '#736a62'],
    'pc-rotulo': ['#ffffff', '#52525a'], // panel de datos del PC
    'pc-verde': ['#ffffff', '#73bd62'], // botón de equipo del PC (party_menu.pal)
    'pc-azul': ['#ffffff', '#7bb4d5'], // botón de cerrar caja
    'pc-datos': ['#ffffff', '#000000'], // ventana de datos (paleta 3, scrolling_bg.pal)
    'pc-caja': ['#ffffff', '#393939'], // título de la caja «bosque» (sBoxTitleColors)
    'pc-nivel': ['#ffffff', '#000000'], // scrolling_bg.pal
    'pc-macho': ['#7bbdff', '#007bff'],
    'pc-hembra': ['#ff8383', '#ac1818'],
    equipo: ['#ffffff', '#737373'],
    'etiqueta-ps': ['#ffd552', '#ffb441'],
    // PP del menú de movimientos según los que quedan (gPPTextPalette, text_pp.pal; GetCurrentPPToMaxPPState): 0 amarillo, 1 naranja,
    // 2 rojo y 3 normal. Se rellenan en la paleta 5 al elegir; leer la paleta sin ellos daba una sombra oscura (Jose: «PP en negrita»).
    'mochila-bolsillo': ['#000000', '#d5d5cd'], // nombre del bolsillo de la Mochila: negro, como el juego (Jose, 11/11/2026)
    'pp-0': ['#d5c500', '#fff68b'],
    'pp-1': ['#ff8300', '#ffee73'],
    'pp-2': ['#e61800', '#f6de9c'],
    'pp-3': ['#4a4a4a', '#dedede'], // letras de la etiqueta de la barra (paleta 3, índices 14 y 15)
  },
  asset: ui,
}

/** Sprites de especie de Esmeralda: frente animado (2 fotogramas en vertical), espalda e icono (2 fotogramas). */
export const emeraldSprite = (kind: 'front' | 'back' | 'icon', speciesId: string): string => `${BASE}sprites/emerald/${kind}/${speciesId}.png`
