"""Gráficos reconstruidos a partir de la edición inglesa; no son rips de Esmeralda español.

La letra diminuta procede de graphics/types/*.png (tinta 15, sombra 14). Conserva anchuras, separación de un píxel
entre cajas de tinta y colores por paleta. V, Q, Ñ y acentos se dibujan en esa cuadrícula. Las máscaras se exportan
para poder revisar su procedencia y sustituirlas cuando D6 consiga gráficos españoles verificables.
"""
import json
from pathlib import Path
from PIL import Image

ENGLISH = {'normal': 'NORMAL', 'fight': 'FIGHT', 'flying': 'FLYING', 'poison': 'POISON', 'ground': 'GROUND',
           'rock': 'ROCK', 'bug': 'BUG', 'ghost': 'GHOST', 'steel': 'STEEL', 'fire': 'FIRE', 'water': 'WATER',
           'grass': 'GRASS', 'electric': 'ELECTR', 'psychic': 'PSYCHC', 'ice': 'ICE', 'dragon': 'DRAGON', 'dark': 'DARK'}
LABELS = json.loads((Path(__file__).resolve().parent / 'datos/rotulos-tipos-es.json').read_text())['rotulos']
EXTRA = {
    'V': ['#..#', '#..#', '#..#', '#..#', '#..#', '.##.', '.##.'],
    'Q': ['.##.', '#..#', '#..#', '#..#', '#.##', '#..#', '.###'],
}


def points(rows, dy=0):
    return {(x, y + dy) for y, row in enumerate(rows) for x, p in enumerate(row) if p == '#'}


def shadow(ink):
    return {(x + dx, y + dy) for x, y in ink for dx, dy in [(1, 0), (0, 1), (1, 1)]} - ink


def alphabet(graphics):
    letters = {}
    for name, label in ENGLISH.items():
        im = Image.open(graphics / f'types/{name}.png')
        columns = [x for x in range(32) if any(im.getpixel((x, y)) % 16 == 15 for y in range(4, 11))]
        runs = []
        for x in columns:
            if runs and runs[-1][-1] == x - 1:
                runs[-1].append(x)
            else:
                runs.append([x])
        assert len(runs) == len(label), (name, label, runs)
        for letter, run in zip(label, runs):
            x0, width = run[0], len(run)
            ink = {(x, y) for y in range(7) for x in range(width) if im.getpixel((x0 + x, y + 4)) % 16 == 15}
            shade = {(x, y) for y in range(8) for x in range(width + 1) if im.getpixel((x0 + x, y + 4)) % 16 == 14}
            glyph = {'width': width, 'ink': ink, 'shadow': shade, 'source': f'graphics/types/{name}.png x={x0}, y=4'}
            if letter in letters:
                assert letters[letter]['ink'] == ink and letters[letter]['width'] == width, (name, letter)
            else:
                letters[letter] = glyph
    for letter, rows in EXTRA.items():
        ink = points(rows)
        letters[letter] = {'width': len(rows[0]), 'ink': ink, 'shadow': shadow(ink), 'source': 'reconstruido a partir de la edición inglesa'}
    for accent, base in [('Á', 'A'), ('É', 'E'), ('Í', 'I'), ('Ó', 'O'), ('Ú', 'U'), ('Ñ', 'N')]:
        glyph = letters[base]
        mark = points(['.#.#', '#.#.'], -2) if accent == 'Ñ' else {(min(2, glyph['width'] - 1), -2), (1, -1)}
        ink = glyph['ink'] | mark
        letters[accent] = {**glyph, 'ink': ink, 'shadow': shadow(ink), 'source': 'reconstruido a partir de la edición inglesa: ' + base + ' y acento'}
    return letters


def label_width(label, letters):
    return sum(letters[c]['width'] for c in label) + len(label) - 1 + 1  # último píxel de sombra


def type_icon(im, pal, label, letters):
    """Borra el rótulo inglés y compone el español con las máscaras pequeñas, nunca con FONT_SMALL."""
    out = Image.new('RGBA', im.size)
    bg = im.getpixel((16, 3)) % 16
    out.putdata([pal[bg if 4 <= i // 32 <= 11 else c % 16] + (255 if c % 16 else 0,)
                 for i, c in enumerate(im.getdata())])
    width = label_width(label, letters)
    assert width <= 30, (label, width)  # cuerpo interior, 1 px de margen mínimo por lado
    x = (32 - width) // 2
    all_ink, all_shadow = set(), set()
    for char in label:
        glyph = letters[char]
        all_ink |= {(x + dx, 4 + dy) for dx, dy in glyph['ink']}
        all_shadow |= {(x + dx, 4 + dy) for dx, dy in glyph['shadow']}
        x += glyph['width'] + 1
    for (px, py) in all_shadow - all_ink:
        out.putpixel((px, py), pal[14] + (255,))
    for (px, py) in all_ink:
        out.putpixel((px, py), pal[15] + (255,))
    return out


def ps_label(plate, pal):
    """P del HP original; S reconstruida con el mismo trazo de 5×5 y gradiente de índices 14/15."""
    found = [(x, y) for y in range(plate.height) for x in range(plate.width)
             if plate.getpixel((x, y))[:3] in (pal[14], pal[15])]
    if not found:  # huecos vacíos sin etiqueta
        return
    x0, y0 = min(x for x, y in found), min(y for x, y in found)
    p = {(x - (x0 + 6), y - y0) for x, y in found if x >= x0 + 6}
    assert p == points(['#####', '##..#', '#####', '##...', '##...'])
    s = points(['#####', '##...', '#####', '...##', '#####'])
    for x, y in found:
        plate.putpixel((x, y), pal[13] + (255,))
    for dx, dy in p | {(x + 6, y) for x, y in s}:
        plate.putpixel((x0 + dx, y0 + dy), pal[14 if dy < 2 else 15] + (255,))


def font_symbols(im, widths):
    """Reconstruye Lv→Nv y No→Nº dentro de sus celdas, conservando avance y la v original; PP no cambia."""
    out = im.copy()
    for code in [0x34, 0x105, 0x108]:
        x, y = code % 16 * 16, code // 16 * 16
        ink = {(dx, dy) for dy in range(16) for dx in range(16) if im.getpixel((x + dx, y + dy)) == 1}
        shade = {(dx, dy) for dy in range(16) for dx in range(16) if im.getpixel((x + dx, y + dy)) == 2}
        top = min(dy for dx, dy in ink)
        if code in (0x34, 0x105):
            # La L tiene un trazo vertical y un pie; su ancho determina la N compacta (3 o 4 px).
            bottom = max(dy for dx, dy in ink)
            left_width = next(dx for dx in range(1, 8) if not any((dx, dy) in ink for dy in range(top, bottom + 1)))
            cap = ['#..#', '##.#', '##.#', '#.##', '#.##', '#..#', '#..#'] if left_width == 4 else ['#.#', '###', '###', '#.#', '#.#', '#.#', '#.#']
            new_n = points(cap, top)
            ink = {(dx, dy) for dx, dy in ink if dx > left_width} | new_n
            shade = {(dx, dy) for dx, dy in shade if dx > left_width} | shadow(new_n)
        else:
            # Mantener la N y elevar el anillo: Nº, no el «No» al ras de la edición inglesa.
            ring_x = 5 if widths[code] == 8 else 6
            ink = {(dx, dy) for dx, dy in ink if dx < 5}
            ink |= {(ring_x + dx, top + dy) for dx, dy in points(['###', '#.#', '###'])}
            shade = shadow(ink)
        # El extractor solo utiliza 1 y 2; 0 es seguro como fondo transparente para las máscaras.
        for dy in range(16):
            for dx in range(16):
                out.putpixel((x + dx, y + dy), 1 if (dx, dy) in ink else 2 if (dx, dy) in shade - ink else 0)
    return out
