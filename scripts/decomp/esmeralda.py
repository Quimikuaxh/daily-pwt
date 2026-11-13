#!/usr/bin/env python3
"""Receta de Pokémon Esmeralda (pret/pokeemerald): recursos de la interfaz de la campaña de Hoenn (D5, DEC-95).

Uso (desde la raíz del repo; ver README, «Recursos de Esmeralda»):
  npm run gen:emerald-ui -- RUTA_POKEEMERALD               regenera lo versionado
  npm run gen:emerald-ui -- RUTA_POKEEMERALD --comprobar   compara con lo versionado sin tocarlo
Salida: public/ui/emerald/ (interfaz), public/sprites/emerald/ (frente animado, espalda e icono de las 386 especies)
y src/generated/emerald/ (fuente, colores y datos de sprites). Utilidades comunes en comun.py; para otro juego,
escribe su receta igual que esta. Las piezas son las de las maquetas aprobadas (entrega-hoenn, 11/11/2026).
"""
import json, re
from pathlib import Path
from PIL import Image

import comun
import rotulos_es
from comun import u16, jasc, pngpal, tilemap, sprite, save, erase, write_json, indexed, save_indexed

REVISION = '731ad5bfd6e6f265508d0efcca0ba42f9dcf5881'
SPRITES = 'public/sprites/emerald'
DATA = 'src/generated/emerald'
comun.iniciar('pokeemerald', REVISION, 'public/ui/emerald', ('public/ui/emerald', SPRITES, DATA))
SRC, G = comun.SRC, comun.G
# Láminas de comparación para revisar los rótulos reconstruidos: fuera del repo (no se publican).
REVIEW = Path('/tmp/decomp-revision-esmeralda')


def review(im, name):
    REVIEW.mkdir(exist_ok=True)
    im.save(REVIEW / name)


# ---------- Fuentes: máscaras de glifos y anchos ----------
def half_cells(sheet, widths):
    """Vacía la mitad derecha de cada celda de 16 x 16 cuyo glifo mide 8 px o menos: el juego solo copia esa mitad (text.c,
    DecompressGlyph_*: con `width <= 8`, dos teselas en vez de cuatro) y en la otra el PNG trae restos de otro glifo. Sin esto, en la
    fuente estrecha la «S» arrastraba media «T» y «PISTOLA AGUA» o «PERSECUCIÓN» salían pisadas (Jose, 13/11/2026)."""
    out = sheet.copy()
    blank = Image.new('RGBA', (8, 16))
    for code, width in enumerate(widths):
        if width <= 8:
            out.paste(blank, (code % 16 * 16 + 8, code // 16 * 16))
    return out


def fonts():
    src = (SRC / 'src/fonts.c').read_text()
    charmap = {}
    for line in (SRC / 'charmap.txt').read_text().splitlines():
        m = re.match(r"^'(\\?.)'\s*=\s*([0-9A-F]{2})\s*$", line)
        if m and m.group(1) not in charmap:
            charmap[m.group(1).replace('\\', '')] = int(m.group(2), 16)
    # F9 xx selecciona el glifo 0x100 | xx (text.c, CHAR_EXTRA_SYMBOL).
    for name in ('LV', 'LV_2', 'PP', 'NO'):
        match = re.search(r'^' + name + r'\s*=\s*([0-9A-F ]+)$', (SRC / 'charmap.txt').read_text(), re.M)
        values = bytes.fromhex(match.group(1).strip())
        charmap['{' + name + '}'] = values[0] if len(values) == 1 else 0x100 | values[1]
    charmap['{SPACER}'] = 0x77  # CHAR_SPACER de ConvertIntToDecimalStringN
    meta = {'rellenoNumerico': '{SPACER}', 'charmap': charmap, 'fonts': {}, 'glyph': {'w': 16, 'h': 16, 'columnas': 16}}
    comparison = Image.new('RGBA', (64, 128), '#ffffff')
    for row, (key, var, png) in enumerate([('normal', 'gFontNormalLatinGlyphWidths', 'latin_normal'), ('short', 'gFontShortLatinGlyphWidths', 'latin_short'),
                          ('small', 'gFontSmallLatinGlyphWidths', 'latin_small'), ('narrow', 'gFontNarrowLatinGlyphWidths', 'latin_narrow')]):
        body = re.search(var + r'\[\]\s*=\s*\{(.*?)\};', src, re.S).group(1)
        meta['fonts'][key] = [int(n) for n in re.findall(r'\d+', body)]
        original = Image.open(G / 'fonts' / (png + '.png'))
        im = original.copy()
        # Glifos Nv y Nº reconstruidos a partir de la edición inglesa; mismo avance, tinta y sombra.
        im = rotulos_es.font_symbols(im, meta['fonts'][key])
        for col, code in enumerate([0x34, 0x105, 0x106, 0x108]):
            for variant, sheet in enumerate([original, im]):
                glyph = sheet.crop((code % 16 * 16, code // 16 * 16, code % 16 * 16 + 16, code // 16 * 16 + 16))
                rgba = Image.new('RGBA', (16, 16))
                rgba.putdata([(0, 0, 0, 255) if c == 1 else (140, 140, 140, 255) if c == 2 else (255, 255, 255, 255) for c in glyph.getdata()])
                comparison.paste(rgba, (col * 16, (row * 2 + variant) * 16))
        # Dos máscaras por fuente (tinta y sombra): la página las colorea por composición, sin leer píxeles (file:// lo impide).
        for layer, index in [('tinta', 1), ('sombra', 2)]:
            out = Image.new('RGBA', im.size)
            out.putdata([(0, 0, 0, 255 if c == index else 0) for c in im.getdata()])
            save(half_cells(out, meta['fonts'][key]), f'fuente-{key}-{layer}.png')
    review(comparison, 'simbolos-comparacion.png')
    write_json(f'{DATA}/font.json', meta)


# ---------- Marco de ventana estándar (marco 1, el de una partida nueva) ----------
def window_frames():
    save(sprite(G / 'text_window/1.png', keep0=False), 'marco-1.png')
    save(sprite(G / 'text_window/message_box.png'), 'caja-mensaje.png')


# ---------- Mapa de Hoenn ----------
def region_map():
    p = G / 'pokenav/region_map'
    t = Image.open(p / 'map.png')
    pal = pngpal(t)
    data = (p / 'map.bin').read_bytes()  # 8bpp: un byte por tesela, 64 de ancho
    out = Image.new('RGB', (240, 160))
    for y in range(20):
        for x in range(30):
            n = data[y * 64 + x]
            tile = t.crop((n % 16 * 8, n // 16 * 8, n % 16 * 8 + 8, n // 16 * 8 + 8)).convert('RGB')
            out.paste(tile, (x * 8, y * 8))
    del pal
    save(out, 'mapa-hoenn.png')
    cur = Image.open(p / 'cursor_small.png')
    cpal = jasc(p / 'cursor.pal')
    for f in range(2):
        fr = cur.crop((0, f * 16, 16, f * 16 + 16))
        o = Image.new('RGBA', (16, 16))
        o.putdata([cpal[c] + (255 if c else 0,) for c in fr.getdata()])
        save(o, f'mapa-cursor-{f}.png')
    save(sprite(p / 'brendan_icon.png'), 'mapa-jugador.png')
    save(sprite(p / 'fly_target_icons.png'), 'mapa-iconos-vuelo.png')


# ---------- Ficha de entrenador del Domo Batalla ----------
def dome_card():
    p = G / 'battle_frontier'
    t = Image.open(p / 'tourney_info_card.png')
    colors = pngpal(Image.open(p / 'tourney_tree.png'))
    data = u16(p / 'tourney_info_card_tilemap.bin')
    blocks = [tilemap(t, data[i * 1024:(i + 1) * 1024], 32, 32, 32, colors) for i in range(4)]
    card = blocks[2].crop((0, 64, 256, 256))  # la ficha completa (nombre, equipo y texto) está en el tercer bloque
    save(card.crop(card.getbbox()), 'domo-ficha.png')
    bg = tilemap(t, u16(p / 'tourney_info_card_bg.bin'), 32, 32, 32, colors)
    flat = Image.new('RGBA', bg.size, colors[5 * 16] + (255,))
    flat.alpha_composite(bg)
    save(flat.crop((0, 0, 64, 64)), 'domo-fondo.png')


    # Flechas laterales (sHorizontalScrollArrowSpriteTemplate): teselas 16 y 17 de tourney_buttons, 8 x 16, con su paleta.
    b = Image.open(p / 'tourney_buttons.png')
    bp = jasc(p / 'tourney_buttons.pal')
    arrow = Image.new('RGBA', (8, 16))
    for half, (sx, sy) in enumerate([(0, 32), (8, 32)]):
        tile = b.crop((sx, sy, sx + 8, sy + 8))
        part = Image.new('RGBA', (8, 8))
        part.putdata([bp[c % 16] + (255 if c % 16 else 0,) for c in tile.getdata()])
        arrow.paste(part, (0, half * 8))
    save(arrow, 'domo-flecha-dcha.png')
    save(arrow.transpose(Image.Transpose.FLIP_LEFT_RIGHT), 'domo-flecha-izda.png')


def badges():
    # Medallas de la ficha de entrenador: 8 de 16 x 16 en fila, en el orden de los gimnasios.
    im = sprite(G / 'trainer_card/badges.png')
    for i in range(8):
        save(im.crop((i * 16, 0, i * 16 + 16, 16)), f'medalla-{i + 1}.png')


RIVALS = {'petra': 'leader_roxanne', 'marcial': 'leader_brawly', 'erico': 'leader_wattson', 'candela': 'leader_flannery',
          'norman': 'leader_norman', 'alana': 'leader_winona', 'vito-y-leti': 'leader_tate_and_liza', 'galano': 'leader_juan',
          'plubio': 'champion_wallace', 'sixto': 'elite_four_sidney', 'fatima': 'elite_four_phoebe',
          'nivea': 'elite_four_glacia', 'dracon': 'elite_four_drake'}


def portraits():
    # Retratos de líderes, Alto Mando y campeón, y del protagonista (Brendan y May) para Ruta, Liga y Resultado.
    for rid, pic in RIVALS.items():
        save(sprite(G / 'trainers/front_pics' / (pic + '.png')), f'lider-{rid}.png')
    for pic in ('brendan', 'may'):
        save(sprite(G / 'trainers/front_pics' / (pic + '.png')), f'entrenador-{pic}.png')


def species_dirs():
    """(número nacional, id, carpeta) de las 386 especies en el orden de include/constants/pokedex.h. El id es el
    nombre de la constante en minúsculas sin guiones bajos (como los ids de @pkmn: nidoranf, mrmime, hooh); las formas
    sin gráfico propio en la raíz usan la de por defecto (Castform normal, Unown A)."""
    names = [n for n in re.findall(r'^\s*NATIONAL_DEX_(\w+),', (SRC / 'include/constants/pokedex.h').read_text(), re.M) if n != 'NONE']
    out = []
    for n, name in enumerate(names[:386], 1):
        folder = G / 'pokemon' / name.lower()
        for sub in ('', 'normal', 'a'):
            if (folder / sub / 'front.png').exists():
                folder = folder / sub
                break
        else:
            raise SystemExit(f'Sin gráficos para {name}')
        out.append((n, name.lower().replace('_', ''), name, folder))
    return out


def species():
    # Por especie: frente animado (anim_front, 2 fotogramas de 64 x 64 en vertical), espalda e icono (2 fotogramas de
    # 32 x 32), y en el JSON el desplazamiento vertical de frente y espalda y la animación del frente (fotograma, duración
    # en fotogramas de 60 Hz) de src/data/pokemon_graphics.
    anims = (SRC / 'src/data/pokemon_graphics/front_pic_anims.h').read_text()
    front_coords = (SRC / 'src/data/pokemon_graphics/front_pic_coordinates.h').read_text()
    back_coords = (SRC / 'src/data/pokemon_graphics/back_pic_coordinates.h').read_text()
    index = {}
    for n, sid, const, folder in species_dirs():
        front = folder / 'anim_front.png' if (folder / 'anim_front.png').exists() else folder / 'front.png'
        save_indexed(indexed(front), f'{SPRITES}/front/{sid}.png')
        save_indexed(indexed(folder / 'back.png'), f'{SPRITES}/back/{sid}.png')
        icon = folder / 'icon.png' if (folder / 'icon.png').exists() else folder.parent / 'icon.png'
        save_indexed(indexed(icon), f'{SPRITES}/icon/{sid}.png')
        y = lambda text: int(re.search(r'\[SPECIES_' + const + r'\].*?y_offset =\s*(\d+)', text, re.S).group(1))
        camel = ''.join(part.title() for part in const.split('_'))
        anim = re.search(r'sAnim_' + camel + r'_1\[\]\s*=\s*\{(.*?)\};', anims, re.S)
        index[sid] = {'dex': n, 'frontY': y(front_coords), 'backY': y(back_coords),
                      'anim': [[int(a), int(b)] for a, b in re.findall(r'ANIMCMD_FRAME\((\d+), (\d+)\)', anim.group(1))] if anim else []}
    write_json(f'{DATA}/sprites.json', index)

def factory():
    # Pantalla de alquiler de la Fábrica Batalla (battle_factory_screen.c): fondo, Poké Balls (pokeball_selection de
    # starter_choose, 3 fotogramas de 32 x 32, paletas gris y seleccionada) y flecha del cursor.
    p = G / 'battle_frontier/factory_screen'
    t = Image.open(p / 'menu.png')
    c = pngpal(t)
    bg = Image.new('RGBA', (240, 160), c[0] + (255,))
    bg.alpha_composite(tilemap(t, u16(p / 'menu.bin'), 30, 20, 32, c))
    save(bg.convert('RGB'), 'fabrica-fondo.png')
    balls = Image.open(G / 'starter_choose/pokeball_selection.png')
    for name in ('gray', 'selected'):
        pal = jasc(p / f'pokeball_{name}.pal')
        out = Image.new('RGBA', (32, 96))
        out.putdata([pal[i % 16] + (255 if i % 16 else 0,) for i in balls.crop((0, 0, 32, 96)).getdata()])
        save(out, 'fabrica-ball-' + ('gris' if name == 'gray' else 'activa') + '.png')
    a = Image.open(p / 'arrow.png')
    pal = jasc(p / 'interface.pal')
    out = Image.new('RGBA', a.size)
    out.putdata([pal[i % 16] + (255 if i % 16 else 0,) for i in a.getdata()])
    save(out, 'fabrica-flecha.png')
    for side in ('left', 'right'):  # resalte del menú (sSpriteTemplate_Select_MenuHighlight*)
        h = Image.open(p / f'menu_highlight_{side}.png')
        out = Image.new('RGBA', h.size)
        out.putdata([pal[i % 16] + (255 if i % 16 else 0,) for i in h.getdata()])
        save(out, f'fabrica-resalte-{"izda" if side == "left" else "dcha"}.png')


def summary_pages():
    # Datos del Pokémon (pokemon_summary_screen.c), páginas INFO (page_info) y HABILIDADES (page_skills sobre page_info).
    # Los puntos de la cabecera siguen DrawPagination con tres páginas disponibles (INFO, HABILIDADES y MOVIMIENTOS en el draft, Jose
    # 12/11/2026; la cuarta, apagada). Se borran los
    # rótulos ingleses dibujados en la página (PROFILE, ABILITY, TRAINER MEMO, ITEM, RIBBON, STATS, EXP.; la maqueta los
    # pinta en español). Conserva la caja y la barra originales de EXP.; no reutilices esa zona para evolución.
    p = G / 'summary_screen'
    t = Image.open(p / 'tiles.png')
    c = pngpal(t)
    base, skills = list(u16(p / 'page_info.bin')), u16(p / 'page_skills.bin')
    yellow, purple, light = (238, 222, 24), (115, 90, 213), (246, 255, 238)

    def dots(m, cur, last=1):
        for i in range(4):
            j = 11 + i * 2
            if i > last:
                pair = (0x4A, 0x4A, 0x5A, 0x5A)
            elif i < cur:
                pair = (0x46, 0x47, 0x56, 0x57)
            elif i == cur:
                pair = (0x4B, 0x4C, 0x5B, 0x5C) if i == last else (0x41, 0x42, 0x51, 0x52)
            else:
                pair = (0x48, 0x49, 0x58, 0x59) if i == last else (0x43, 0x44, 0x53, 0x54)
            for k, (row, col) in enumerate([(0, 0), (0, 1), (1, 0), (1, 1)]):
                m[row * 32 + j + col] = (m[row * 32 + j + col] & 0xF000) | pair[k]
        return m

    def erase_labels(px, rows):
        for y0 in rows:
            for y in range(y0, y0 + 10):
                fill = px[93, y]  # cada píxel de letra toma el color de la tira a su izquierda
                for x in range(94, 237):
                    if px[x, y][:3] in ((255, 255, 255), (115, 106, 98)):
                        px[x, y] = fill
                    else:
                        fill = px[x, y]

    im = Image.new('RGBA', (240, 160), (0, 0, 0, 255))
    im.alpha_composite(tilemap(t, dots(base[:], 0, 2), 30, 20, 32, c))
    erase_labels(im.load(), (23, 63, 103))
    save(im.convert('RGB'), 'datos-info.png')

    im = Image.new('RGBA', (240, 160), (0, 0, 0, 255))
    im.alpha_composite(tilemap(t, dots(base[:], 1, 2), 30, 20, 32, c))
    im.alpha_composite(tilemap(t, skills, 30, 20, 32, c))
    px = im.load()
    erase_labels(px, (23, 47, 103))
    save(im.convert('RGB'), 'datos-habilidades.png')


def ball_display():
    # Indicador de equipo del combate (battle_interface/ball_display.png): 4 bolas de 8 x 8; la 1.ª llena, la 3.ª vacía.
    im = sprite(G / 'battle_interface/ball_display.png')
    for i in range(4):
        save(im.crop((i * 8, 0, i * 8 + 8, 8)), f'bola-{i}.png')


def storage():
    # PC, «Mover POKéMON» (pokemon_storage_system.c): fondo móvil, panel de datos (display_menu), botones de la fila de
    # arriba (fila 20-21 de party_menu en (10,0) y close_box_button en (21,0)), fondo «bosque» de la caja en (80,16) y
    # mano del cursor. Se borran los rótulos ingleses PKMN DATA, PARTY POKéMON y CLOSE BOX.
    p = G / 'pokemon_storage'
    pal = [(0, 0, 0)] * 256
    for bank, f in ((0, 'interface.pal'), (1, 'party_menu.pal'), (2, 'pkmn_data_gray.pal'), (3, 'scrolling_bg.pal'), (15, 'text_windows.pal')):
        for i, c in enumerate(jasc(p / f)[:16]):
            pal[bank * 16 + i] = c
    t = Image.open(p / 'menu.png')
    im = Image.new('RGBA', (240, 160), (0, 0, 0, 255))
    im.alpha_composite(tilemap(Image.open(p / 'scrolling_bg.png'), u16(p / 'scrolling_bg.bin'), 30, 20, 32, pal))
    im.alpha_composite(tilemap(t, u16(p / 'display_menu.bin'), 30, 20, 32, pal, off=256))
    erase(im, (14, 4, 67, 14), {(115, 115, 123)})
    party = tilemap(t, u16(p / 'party_menu.bin'), 12, 22, 12, pal, off=256).crop((0, 160, 96, 176))
    erase(party, (4, 2, 70, 14), {(164, 238, 148), (131, 172, 180), (82, 98, 115)})
    im.alpha_composite(party, (80, 0))
    close = tilemap(t, u16(p / 'close_box_button.bin'), 9, 4, 9, pal, off=256).crop((0, 0, 72, 16))
    erase(close, (6, 2, 66, 14), {(164, 205, 246), (115, 115, 123), (82, 82, 90)})
    im.alpha_composite(close, (168, 0))
    w = p / 'wallpapers/forest'
    f, b, m = Image.open(w / 'frame.png'), Image.open(w / 'bg.png'), u16(w / 'tilemap.bin')
    box = Image.new('RGBA', (160, 144))
    for y in range(18):
        for x in range(20):
            n = m[y * 20 + x]
            idx = n & 1023
            src = f
            if idx >= 55:
                src, idx = b, idx - 55
            a, z = idx % (src.width // 8) * 8, idx // (src.width // 8) * 8
            patch = src.convert('RGBA').crop((a, z, a + 8, z + 8))
            if n & 1024:
                patch = patch.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if n & 2048:
                patch = patch.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            box.paste(patch, (8 * x, 8 * y))
    im.alpha_composite(box, (80, 16))
    save(im.convert('RGB'), 'pc-fondo.png')
    # Flechas de cambio de caja junto al título (CreateBoxScrollArrows: animación 0 a la izquierda, la 1 volteada a la derecha). arrow.png
    # está en escala de grises (modo L): el gris v es el índice 15 - v/17, así que el blanco del fondo es el 0 (transparente). Paleta
    # PALTAG_MISC_2, la de waveform.png, como la mano. Antes se leía el gris como índice (v % 16), el fondo salía cian y opaco, el borde
    # transparente y las flechas cambiadas de lado.
    arrow = Image.open(p / 'arrow.png')
    ap = pngpal(Image.open(p / 'waveform.png'))
    o = Image.new('RGBA', (8, 16))
    o.putdata([ap[15 - v // 17] + (255 if 15 - v // 17 else 0,) for v in arrow.convert('L').crop((0, 0, 8, 16)).getdata()])
    save(o, 'pc-flecha-izda.png')
    save(o.transpose(Image.Transpose.FLIP_LEFT_RIGHT), 'pc-flecha-dcha.png')
    hand = Image.open(p / 'hand_cursor.png')
    hp = pngpal(Image.open(p / 'waveform.png'))  # PALTAG_MISC_2: mano blanca normal y sombra
    for i, name in ((0, 'abierta'), (1, 'rebote'), (2, 'abriendo'), (3, 'cogiendo')):
        fr = hand.crop((0, i * 32, 32, i * 32 + 32))
        o = Image.new('RGBA', (32, 32))
        o.putdata([hp[c] + (255 if c else 0,) for c in fr.getdata()])
        save(o, f'pc-mano-{name}.png')
    shadow = Image.open(p / 'hand_cursor_shadow.png')
    out = Image.new('RGBA', shadow.size)
    out.putdata([hp[c] + (255 if c else 0,) for c in shadow.getdata()])
    save(out, 'pc-mano-sombra.png')


def party_screen():
    # Pantalla de equipo (party_menu.c): fondo bg.bin y placas de los huecos (slot_main 10x7, slot_wide 18x3) en sus
    # paletas de estado normal, seleccionado, debilitado y vacío; botones ACEPTAR (23,16) y CANCELAR (23,18).
    p = G / 'party_menu'
    t = Image.open(p / 'bg.png')
    rgb = pngpal(t)
    bg = tilemap(t, u16(p / 'bg.bin'), 30, 20, 32, rgb)
    flat = Image.new('RGBA', (240, 160), rgb[0] + (255,))
    flat.alpha_composite(bg)
    for name, n in (('confirm', 16), ('cancel', 18)):
        flat.alpha_composite(tilemap(t, u16(p / f'{name}_button.bin'), 7, 2, 7, rgb, bank=None), (184, n * 8))
    save(flat.convert('RGB'), 'equipo-fondo.png')
    single = Image.new('RGBA', (240, 160), rgb[0] + (255,))
    single.alpha_composite(bg)
    single.alpha_composite(tilemap(t, u16(p / 'cancel_button.bin'), 7, 2, 7, rgb, bank=None), (184, 136))
    save(single.convert('RGB'), 'equipo-fondo-combate.png')
    for kind, w, h in (('main', 10, 7), ('wide', 18, 3), ('wide_empty', 18, 3), ('main_no_hp', 10, 7), ('wide_no_hp', 18, 3)):
        for state, ids1, ids2 in (('normal', [52, 53, 54], [49, 55, 56]), ('activa', [116, 117, 118], [97, 103, 104]),
                                  ('ko', [84, 85, 86], [81, 87, 88]), ('ko-activa', [148, 149, 150], [145, 151, 152]), ('vacia', [], [])):
            pal = rgb[48:64]  # la ventana del hueco parte de la paleta 3 (letras PS en amarillo: índices 14 y 15)
            for idx, src in zip([4, 5, 6, 1, 7, 8], ids1 + ids2):
                pal[idx] = rgb[src]
            if state == 'vacia':
                for idx, src in zip([1, 11, 12], [17, 27, 28]):
                    pal[idx] = rgb[src]
            plate = tilemap(t, (p / f'slot_{kind}.bin').read_bytes(), w, h, w, pal, bank=0)
            # PS reconstruido a partir de la edición inglesa: P original y S dibujada como HP, índices 14/15.
            before = plate.copy()
            rotulos_es.ps_label(plate, pal)
            if kind == 'main' and state == 'normal':
                preview = Image.new('RGBA', (32, 10))
                preview.paste(before.crop((8, 31, 24, 41)), (0, 0))
                preview.paste(plate.crop((8, 31, 24, 41)), (16, 0))
                review(preview, 'ps-comparacion.png')
            save(plate, f'equipo-hueco-{kind.replace("_", "-")}-{state}.png')


def moves_page():
    # Datos del Pokémon, página de movimientos de combate (page_battle_moves sobre page_info), con los puntos de tres
    # páginas activas y la actual en la tercera. Se borran MOVES, EFFECT y DESCRIPTION (la maqueta los pinta en español).
    p = G / 'summary_screen'
    t = Image.open(p / 'tiles.png')
    c = pngpal(t)
    base = list(u16(p / 'page_info.bin'))
    for i in range(4):
        j = 11 + i * 2
        pair = (0x4A, 0x4A, 0x5A, 0x5A) if i > 2 else (0x46, 0x47, 0x56, 0x57) if i < 2 else (0x4B, 0x4C, 0x5B, 0x5C)
        for k, (row, col) in enumerate([(0, 0), (0, 1), (1, 0), (1, 1)]):
            base[row * 32 + j + col] = (base[row * 32 + j + col] & 0xF000) | pair[k]
    im = Image.new('RGBA', (240, 160), (0, 0, 0, 255))
    im.alpha_composite(tilemap(t, base, 30, 20, 32, c))
    im.alpha_composite(tilemap(t, u16(p / 'page_battle_moves.bin'), 30, 20, 32, c))
    px = im.load()
    for x0, y0, x1 in ((94, 23, 237), (14, 111, 80), (94, 111, 237)):
        for y in range(y0, y0 + 10):
            fill = px[x0 - 1, y]
            for x in range(x0, x1):
                if px[x, y][:3] in ((255, 255, 255), (115, 106, 98)):
                    px[x, y] = fill
                else:
                    fill = px[x, y]
    save(im.convert('RGB'), 'datos-movimientos.png')


TYPE_PAL = {'normal': 1, 'fight': 1, 'flying': 2, 'poison': 2, 'ground': 1, 'rock': 1, 'bug': 3, 'ghost': 2, 'steel': 1,
            'fire': 1, 'water': 2, 'grass': 3, 'electric': 1, 'psychic': 2, 'ice': 2, 'dragon': 3, 'dark': 1}


def type_icons():
    # Rótulos reconstruidos a partir de la edición inglesa, con sus propias letras de 3–4×7, no FONT_SMALL.
    letters = rotulos_es.alphabet(G)
    metadata = {'estado': 'reconstruido a partir de la edición inglesa', 'rotulos': {}, 'letras': {}, 'paletas': {}}
    atlas = Image.new('RGBA', (64, len(TYPE_PAL) * 16))  # original a la izquierda; reconstruido a la derecha
    for i, (name, n) in enumerate(TYPE_PAL.items()):
        pal = jasc(G / f'types/move_types_{n}.pal')
        im = Image.open(G / f'types/{name}.png')
        label = rotulos_es.LABELS['fighting' if name == 'fight' else name]
        reconstructed = rotulos_es.type_icon(im, pal, label, letters)
        save(reconstructed, f'tipo-{"fighting" if name == "fight" else name}.png')
        original = Image.new('RGBA', im.size)
        original.putdata([pal[c % 16] + (255 if c % 16 else 0,) for c in im.getdata()])
        atlas.alpha_composite(original, (0, i * 16))
        atlas.alpha_composite(reconstructed, (32, i * 16))
        metadata['rotulos'][name] = {'texto': label, 'ancho': rotulos_es.label_width(label, letters), 'paleta': n}
        metadata['paletas'][n] = {'tinta': pal[15], 'sombra': pal[14]}
    # «???» (MALDICIÓN en Gen 3): el rótulo no tiene letras que traducir; va el original con su paleta (sMoveTypeToOamPaletteNum: 15,
    # la tercera de move_types). Jose, 12/11/2026.
    mystery_pal = jasc(G / 'types/move_types_3.pal')
    im = Image.open(G / 'types/mystery.png')
    mystery = Image.new('RGBA', im.size)
    mystery.putdata([mystery_pal[c % 16] + (255 if c % 16 else 0,) for c in im.getdata()])
    save(mystery, 'tipo-mystery.png')
    for c, glyph in letters.items():
        metadata['letras'][c] = {k: sorted(v) if isinstance(v, set) else v for k, v in glyph.items()}
    review(atlas, 'tipos-comparacion.png')
    write_json(f'{DATA}/type-labels.json', metadata)


def list_arrows():
    # Flechas de desplazamiento de las listas (interface/scroll_indicator.png): la de arriba y, volteada, la de abajo.
    up = sprite(G / 'interface/scroll_indicator.png', (0, 16, 16, 32))
    save(up, 'lista-arriba.png')
    save(up.transpose(Image.Transpose.FLIP_TOP_BOTTOM), 'lista-abajo.png')


def battle_screen():
    # battle_bg.c: BUILDING, paleta BuildingLeader cargada en bancos 2–4.
    env = G / 'battle_environment/building'
    colors = [(0, 0, 0)] * 32 + jasc(env / 'leader.pal')
    scene = Image.new('RGBA', (240, 160), colors[32] + (255,))
    scene.alpha_composite(tilemap(Image.open(env / 'tiles.png'), u16(env / 'map.bin'), 30, 20, 32, colors))
    save(scene.convert('RGB'), 'combate-escenario.png')
    p = G / 'battle_interface'
    colors = jasc(p / 'textbox_0.pal') + jasc(p / 'textbox_1.pal')
    tiles, data = Image.open(p / 'textbox.png'), u16(p / 'textbox_map.bin')
    for name, row in [('mensaje', 14), ('acciones', 34), ('movimientos', 54)]:
        box = Image.new('RGBA', (240, 48), colors[0] + (255,))
        box.alpha_composite(tilemap(tiles, data, 30, 6, 32, colors, y0=row))
        save(box.convert('RGB'), 'combate-caja-' + name + '.png')
    for name in ['player', 'opponent']:
        save(sprite(p / f'healthbox_singles_{name}.png'), 'combate-ps-' + name + '.png')
    # El HP de combate usa su propia paleta: H/P en teselas 1/2, verde completo en la 11.
    raw = Image.open(p / 'hpbar.png')
    hp = raw.copy()
    # P de HP, 5×4, trazo izquierdo de tres píxeles; S reconstruida en la misma cuadrícula.
    p_mask = {(x - 17, y - 2) for y in range(2, 6) for x in range(17, 22) if raw.getpixel((x, y)) in (7, 8, 9)}
    s_mask = rotulos_es.points(['#####', '###..', '..###', '#####'])
    for y in range(2, 6):
        for x in range(11, 22):
            if hp.getpixel((x, y)) in (7, 8, 9): hp.putpixel((x, y), 6)
    for x, y in p_mask | {(x + 6, y) for x, y in s_mask}:
        hp.putpixel((x + 11, y + 2), [7, 7, 8, 9][y])
    rgba = Image.new('RGBA', hp.size); pal = pngpal(raw)
    rgba.putdata([pal[c] + (255 if c else 0,) for c in hp.getdata()])
    save(rgba, 'combate-barra-teselas.png')
    # Marco HP + seis teselas llenas, composición real de 64×8 de sHealthBar_Subsprites.
    bar = Image.new('RGBA', (64, 8)); bar.alpha_composite(rgba.crop((8, 0, 24, 8)), (0, 0))
    for i in range(6): bar.alpha_composite(rgba.crop((88, 0, 96, 8)), (16 + i * 8, 0))
    save(bar, 'combate-barra.png')
    for name, dark, light in [('amarilla', 13, 12), ('roja', 15, 14)]:
        variant = bar.copy()
        variant.putdata([pal[dark] + (255,) if c[:3] == pal[11] else pal[light] + (255,) if c[:3] == pal[10] else c for c in bar.getdata()])
        save(variant, 'combate-barra-' + name + '.png')
    # Los sprites de cada especie, su posición y su animación los saca species() para las 386.
    # Colores de texto por ventana, mismos bancos/índices que sTextOnWindowsInfo_Normal.
    battle = jasc(p / 'text.pal')
    write_json(f'{DATA}/battle-colors.json', {
        'combate-menu': [battle[13], battle[15]], 'combate-mensaje': [colors[1], colors[6]],
        'combate-pp': [battle[12], battle[11]], 'combate-nombre': [pngpal(Image.open(p / 'ball_status_bar.png'))[1], pngpal(Image.open(p / 'ball_status_bar.png'))[3]]
    })


def final_screens():
    # hall_of_fame.c: LoadHofBgs, BG1 tesela 1 en filas 0–1/14–19; BG3 tesela 2 debajo.
    t = Image.open(G / 'misc/japanese_hof.png')
    colors = pngpal(t)
    base = tilemap(t, [2] * (32 * 20), 30, 20, 32, colors)
    out = Image.new('RGBA', (240, 160), colors[0] + (255,)); out.alpha_composite(base)
    fg = [1 if y < 2 or y >= 14 else 0 for y in range(20) for x in range(32)]
    out.alpha_composite(tilemap(t, fg, 30, 20, 32, colors))
    save(out.convert('RGB'), 'resultado-salon.png')
    # trainer_card.c: BG2 fondo, BG0 frontal, paleta verde de cero estrellas.
    p = G / 'trainer_card'; t = Image.open(p / 'tiles.png'); colors = jasc(p / 'green.pal')
    card = Image.new('RGBA', (240, 160), colors[0] + (255,))
    for name in ['bg', 'front']:
        card.alpha_composite(tilemap(t, u16(p / f'{name}.bin'), 30, 20, 30, colors))
    # Rótulos reconstruidos a partir de la edición inglesa, no FONT_SMALL sobre el bitmap.
    def alphabet(box, ink, word):
        x0, y0, x1, y1 = box
        used = [x for x in range(x0, x1) if any(card.getpixel((x, y))[:3] == ink for y in range(y0, y1))]
        groups = []
        for x in used:
            if not groups or x > groups[-1][-1] + 1: groups.append([])
            groups[-1].append(x)
        assert len(groups) == len(word)
        return {letter: [[card.getpixel((x, y))[:3] == ink for x in group] for y in range(y0, y1)] for letter, group in zip(word, groups)}
    title_letters = alphabet((24, 21, 115, 27), (0, 0, 0), 'TRAINERCARD')
    badge_letters = alphabet((24, 113, 70, 119), (255, 255, 255), 'BADGES')
    title_letters['F'] = [row[:] for row in title_letters['E']]
    title_letters['F'][-1] = [x < 2 for x in range(len(title_letters['F'][-1]))]
    title_letters['H'] = [[x < 2 or x >= 5 or y == 3 for x in range(7)] for y in range(6)]
    badge_letters['M'] = [[c == '#' for c in row] for row in ['##...##','###.###','#######','##.#.##','##...##','##...##']]
    badge_letters['L'] = [[x < 2 or y == 5 for x in range(6)] for y in range(6)]
    for y in range(21, 28):
        for x in range(25, 115): card.putpixel((x, y), card.getpixel((22, y)))
    for y in range(113, 120):
        for x in range(24, 70): card.putpixel((x, y), card.getpixel((23, y)))
    for label, letters, ink, x, y in [('FICHA', title_letters, (0, 0, 0), 26, 21), ('MEDALLAS', badge_letters, (255, 255, 255), 25, 113)]:
        for letter in label:
            mask = letters[letter]
            for dy, row in enumerate(mask):
                for dx, point in enumerate(row):
                    if point: card.putpixel((x + dx, y + dy), ink + (255,))
            x += len(mask[0]) + 1
    save(card.convert('RGB'), 'resultado-tarjeta.png')


def item_icons():
    # Iconos de 24 x 24 de los objetos equipables y del canje de la campaña (Equipo y PC, canje de Puntos Batalla): los de
    # data/nuzlocke/hoenn-emerald-calendar.json (held y exchange). item_icon_table.h da icono y paleta de cada ITEM_X;
    # src/data/graphics/items.h, sus ficheros. El id es la constante sin ITEM_ en minúsculas y sin guiones bajos (kingsrock).
    calendar = json.loads((comun.ROOT / 'data/nuzlocke/hoenn-emerald-calendar.json').read_text())
    # Y los del calendario (piedras y objetos de evolución, MT y MO), para los bolsillos OBJ. EVOL. y MT/MO de la Mochila (Jose, 12/11/2026).
    wanted = set(calendar['held']) | {entry['item'] for entry in calendar['exchange']} | set(calendar['items'])
    table = {name: pair for name, pair in re.findall(r'\[ITEM_(\w+)\]\s*=\s*\{(gItemIcon_\w+, gItemIconPalette_\w+)\}', (SRC / 'src/data/item_icon_table.h').read_text())}
    files = dict(re.findall(r'const u\d+ (gItemIcon(?:Palette)?_\w+)\[\] = INCGFX_U\d+\("([^"]+?)\.(?:png|pal)"', (SRC / 'src/data/graphics/items.h').read_text()))
    found = set()
    for name, pair in table.items():
        item = name.lower().replace('_', '')
        if item not in wanted:
            continue
        icon, palette = pair.split(', ')
        im = Image.open(SRC / (files[icon] + '.png'))
        colors = jasc(SRC / (files[palette] + '.pal'))
        out = Image.new('RGBA', im.size)
        out.putdata([colors[c % 16] + (255 if c % 16 else 0,) for c in im.getdata()])
        save(out, f'objeto-{item}.png')
        found.add(item)
    missing = wanted - found
    if missing:
        raise SystemExit(f'Sin icono en item_icon_table.h: {sorted(missing)}')


def bag():
    # Mochila (item_menu.c): fondo de menu.png/menu.bin con la paleta del protagonista (menu_male/female.pal) y la mochila
    # (bag_male/female.png, un fotograma de 64 x 64 por bolsillo en vertical: 0 cerrada, 1 objetos, 2 objetos clave,
    # 3 Poké Balls, 4 MT/MO, 5 bayas) con bag.pal. Se pinta en (68,66) de centro; el icono del objeto, en (24,88).
    p = G / 'bag'
    tiles = Image.open(p / 'menu.png')
    for who, sex in (('brendan', 'male'), ('may', 'female')):
        colors = jasc(p / f'menu_{sex}.pal')
        back = Image.new('RGBA', (240, 160), colors[0] + (255,))
        back.alpha_composite(tilemap(tiles, u16(p / 'menu.bin'), 30, 20, 32, colors))
        save(back.convert('RGB'), f'mochila-fondo-{who}.png')
        sheet = Image.open(p / f'bag_{sex}.png')
        pal = jasc(p / 'bag.pal')
        out = Image.new('RGBA', sheet.size)
        out.putdata([pal[c % 16] + (255 if c % 16 else 0,) for c in sheet.getdata()])
        save(out, f'mochila-{who}.png')


def evolution_bg():
    # Fondo animado de la escena de evolución (evolution_scene.c): bg.png con las capas bg_inner/bg_outer.bin y los 50 pasos de
    # paleta de sBgAnim_PalIndexes sobre bg_anim.pal (InitMovingBgPalette), en una tira vertical de 50 fotogramas de 240 x 160 que la
    # escena recorre con sBgAnim_PaletteControl. bg.png está en gris (modo L): el gris v es el índice 15 - v/17, como arrow.png.
    p = G / 'evolution_scene'
    source = (SRC / 'src/evolution_scene.c').read_text()
    table = re.search(r'sBgAnim_PalIndexes\[\]\[16\] = \{(.*?)\};', source, re.S).group(1)
    rows = [[int(n) for n in row.split(',') if n.strip()] for row in re.findall(r'\{([^}]*)\}', table)]
    base = jasc(p / 'bg_anim.pal')[:16]
    gray = Image.open(p / 'bg.png').convert('L')
    tiles = Image.new('P', gray.size)
    tiles.putdata([15 - v // 17 for v in gray.getdata()])
    strip = Image.new('RGB', (240, 160 * len(rows)))
    for k, row in enumerate(rows):
        colors = [(0, 0, 0)] * 256
        for bank in range(16):
            colors[bank * 16:(bank + 1) * 16] = [base[i] for i in row]
        # El mapa entero (32 x 32 teselas) tiene el centro del remolino en (128,80); se recorta para dejarlo en (120,64), el centro
        # del Pokémon en la escena (CreateSprite(…, 120, 64, …)), y que los dos coincidan (Jose, 12/11/2026).
        frame = Image.new('RGBA', (256, 256), (0, 0, 0, 255))
        for layer in ('bg_outer.bin', 'bg_inner.bin'):
            frame.alpha_composite(tilemap(tiles, u16(p / layer), 32, 32, 32, colors))
        strip.paste(frame.crop((8, 16, 248, 176)).convert('RGB'), (0, 160 * k))
    save(strip, 'evolucion-fondo.png')
    # Destello de la animación (misc/evo_sparkle.png, 8 x 8, índice 0 transparente), que evolution_graphics.c mueve en espiral, arco,
    # círculo y lluvia.
    save(sprite(G / 'misc/evo_sparkle.png', (0, 0, 8, 8)), 'evolucion-destello.png')
    # Poké Ball del envío y la retirada (balls/poke.png): tres fotogramas de 16 x 16, cerrada, abriéndose y abierta (pokeball.c).
    save(sprite(G / 'balls/poke.png'), 'combate-poke-ball.png')
    # Flecha ▼ de «pulsa para seguir» al final de un mensaje (fonts/down_arrow.png, TextPrinterDrawDownArrow): 8 x 16 que se dibuja
    # bajando 0, 1, 2 y 1 px cada 8 fotogramas.
    # Con los colores del texto de la caja de mensajes del combate (tinta blanca y sombra), donde se usa.
    ink, shade = json.loads((Path(DATA) / 'battle-colors.json').read_text())['combate-mensaje']
    arrow = Image.open(G / 'fonts/down_arrow.png').crop((0, 0, 8, 16))
    out = Image.new('RGBA', arrow.size)
    out.putdata([tuple(ink) + (255,) if c == 4 else tuple(shade) + (255,) if c == 2 else (0, 0, 0, 0) for c in arrow.getdata()])
    save(out, 'flecha-mensaje.png')
    # Botón píldora del equipo (el de CANCELAR, en (184,144) de equipo-fondo), suelto para los botones de otras pantallas (SALIR de
    # Movimientos), donde el fondo no lo trae.
    save(Image.open('public/ui/emerald/equipo-fondo.png').convert('RGBA').crop((184, 144, 240, 160)), 'boton-pildora.png')
    # Chispas al abrirse (battle_anims/sprites/particles.png con la paleta de circle_impact.png, sBallParticlePalettes): los fotogramas
    # de sAnim_RegularBall, 0, 1, 2 y el 0 volteado, en una tira de 8 x 32.
    parts = Image.open(G / 'battle_anims/sprites/particles.png')
    pal = pngpal(Image.open(G / 'battle_anims/sprites/circle_impact.png'))
    rgba = Image.new('RGBA', parts.size)
    rgba.putdata([pal[c] + (255 if c else 0,) for c in parts.getdata()])
    strip = Image.new('RGBA', (8, 32), (0, 0, 0, 0))
    for k, (frame, flip) in enumerate([(0, False), (1, False), (2, False), (0, True)]):
        cell = rgba.crop((0, 8 * frame, 8, 8 * frame + 8))
        strip.paste(cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else cell, (0, 8 * k))
    save(strip, 'combate-chispas-bola.png')


def move_selector():
    # Marco que señala el movimiento elegido en la página de movimientos (pokemon_summary_screen.c, CreateMoveSelectorSprites):
    # 10 sprites de 16x16 desde x 81 (centro en i*16 + 89), izquierda = fotograma 4, centro = 5 y derecha = el 4 volteado. Una tira
    # de 160x16; la pantalla la pone en (81, 32 + 16 * fila) y la hace parpadear (visible 25 de cada 32 fotogramas).
    sheet = sprite(G / 'summary_screen/move_select.png')
    left = sheet.crop((0, 64, 16, 80))
    middle = sheet.crop((0, 80, 16, 96))
    strip = Image.new('RGBA', (160, 16))
    strip.paste(left, (0, 0))
    for i in range(1, 9):
        strip.paste(middle, (16 * i, 0))
    strip.paste(left.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (144, 0))
    save(strip, 'datos-selector.png')


# Letras de 4 x 6 de los iconos de estado. P, A, R y N son las del juego (status.png); el resto, en el mismo estilo, para la edición
# española (DOR, ENV, PAR, QUE, CON): el decompilado solo trae los iconos ingleses.
STATUS_GLYPHS = {
    'P': ('ooo.', 'o..o', 'o..o', 'ooo.', 'o...', 'o...'),
    'A': ('.oo.', 'o..o', 'o..o', 'oooo', 'o..o', 'o..o'),
    'R': ('ooo.', 'o..o', 'o..o', 'ooo.', 'o.o.', 'o..o'),
    'N': ('o..o', 'oo.o', 'o.oo', 'o..o', 'o..o', 'o..o'),
    'D': ('ooo.', 'o..o', 'o..o', 'o..o', 'o..o', 'ooo.'),
    'O': ('.oo.', 'o..o', 'o..o', 'o..o', 'o..o', '.oo.'),
    'E': ('oooo', 'o...', 'ooo.', 'o...', 'o...', 'oooo'),
    'V': ('o..o', 'o..o', 'o..o', 'o..o', '.oo.', '.oo.'),
    'Q': ('.oo.', 'o..o', 'o..o', 'o..o', 'o.o.', '.o.o'),
    'U': ('o..o', 'o..o', 'o..o', 'o..o', 'o..o', '.oo.'),
    'C': ('.oo.', 'o..o', 'o...', 'o...', 'o..o', '.oo.'),
}


def status_icons():
    # Iconos de estado de la caja de PS (UpdateStatusIconInHealthbox): píldoras de 24 x 8 de status.png (PSN, PAR, SLP, FRZ, BRN, de
    # arriba abajo) con las letras en x 3, 8 y 13, filas 1 a 6. Se vacían las inglesas con el color de la píldora y se escriben las españolas.
    sheet = sprite(G / 'battle_interface/status.png')
    ink = sheet.getpixel((3, 9))  # la P de PAR
    for row, (name, text) in enumerate([('env', 'ENV'), ('par', 'PAR'), ('dor', 'DOR'), ('con', 'CON'), ('que', 'QUE')]):
        pill = sheet.crop((0, 8 * row, 24, 8 * row + 8))
        fill = pill.getpixel((2, 3))
        px = pill.load()
        for y in range(1, 7):
            for x in range(3, 17):
                px[x, y] = fill
        for k, letter in enumerate(text):
            for y, line in enumerate(STATUS_GLYPHS[letter]):
                for x, c in enumerate(line):
                    if c == 'o':
                        px[3 + 5 * k + x, 1 + y] = ink
        save(pill, f'estado-{name}.png')


def asset_list():
    # Lista de la interfaz para precargarla al entrar en la campaña (Jose, 12/11/2026: no conforme se necesita). Va la última:
    # recoge todo lo que han escrito los pasos anteriores.
    names = sorted(p.stem for p in Path('public/ui/emerald').glob('*.png'))
    write_json(f'{DATA}/ui-assets.json', names)


comun.terminar((fonts, window_frames, region_map, dome_card, badges, portraits, species, factory, summary_pages, ball_display,
                storage, party_screen, moves_page, type_icons, list_arrows, battle_screen, final_screens, item_icons, bag, evolution_bg, move_selector, status_icons, asset_list))
