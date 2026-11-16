"""Piezas de interfaz de la locke de N2/B2 (DEC-105, maquetas aprobadas el 13/11/2026) en `public/ui/n2b2/`.

Lee las hojas guardadas en `scripts/.cache/n2b2-ui/` (no versionadas; su origen está en ARQUITECTURA, DEC-105) y escribe solo lo que la
interfaz usa, con los recortes de las maquetas:

- `mapa-teselia.png`: mapa de la región de N2/B2 (256 x 168, el del juego sin rótulos).
- `panel.png`, `barra.png`, `barra-off.png`: ventana y barras (seleccionada y normal) de los menús, para `border-image`.
- `franja.png` y `franja-pestana.png`: la barra seleccionada partida en dos para los títulos: la franja entera, oscura, y la pestaña clara
  con su muesca (x 0 a 120), que se estira hasta el ancho del título.
- `medalla-<n>.png` y `medalla-<n>-off.png`: las ocho medallas de Teselia, ganada y sin ganar (fondo transparente, 14 x 26 como mucho).
- `medalla-estuche-<n>.png`: las ocho medallas ganadas a tamaño original, recortadas para encajar en las siluetas del estuche.
- `caja-<n>.png` y `caja-<n>-titulo.png`: fondos de caja del PC (156 x 114) y su pestaña de título (112 x 19), de la hoja de fondos de
  caja: `caja-1`, el del bosque (CAJA 1), y `caja-2`, el de Kyurem gris (BAJAS).

- `ficha-estuche.png` (256 x 192): el estuche de medallas de la Ficha de Entrenador (retratos de los ocho líderes y sus huecos), y
  `ficha.png` (245 x 165): la cara de la Ficha, de la hoja de la ficha de entrenador, sin el rótulo inglés (lo pinta la interfaz).
- `mochila-<chico|chica>-<bolsillo>-<0|2>.png`: la mochila y los bolsillos de la Mochila de N2/B2 (hoja de bolsas), cerrado (0) y abierto
  (2): `objetos` (la mochila), `bayas` (la bolsita), `evol` (la caja) y `mt` (el bolsillo curvo).

Con la ROM de Negro 2 (`npm run gen:n2b2-ui -- RUTA_ROM`; no se copia ni se versiona), además:
- `pc-marco.png`: la pantalla de cajas del PC (`a/1/4/1`, mapa 8 con las teselas 4 y la paleta 0), 256 x 192.
- `pc-mano.png`: la mano del cursor del PC (`a/2/0/2`, celda 24 con las teselas 17 y la paleta 11), recortada.
- `pc-flecha-izda.png` y `pc-flecha-dcha.png`: las flechas de cambio de caja (`a/1/4/1`, celdas 0 y 1 con las teselas 6 y la paleta 2).
- `mochila-fondo-chico.png` y `mochila-fondo-chica.png`: el fondo de la Mochila (`a/0/8/7`: mapa 5 con las teselas 3 y la paleta 4,
  azul; mapa 2 con las teselas 0 y la paleta 1, rojo), 256 x 192.
- `tienda-fondo.png`: la pantalla de tienda de 5.ª generación (`a/0/5/3`: mapa 4 con las teselas 0 y la paleta 1), 256 x 192.
Sin ROM, esas piezas no se tocan.

Uso: `npm run gen:n2b2-ui [-- RUTA_ROM]`. Requiere Python 3.10 y Pillow 10 o posterior.
"""
import os
import sys
from PIL import Image
from ds import Rom, cells, lz, narc, render_cell, render_screen

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, 'scripts', '.cache', 'n2b2-ui')
OUT = os.path.join(ROOT, 'public', 'ui', 'n2b2')

# Columnas de cada medalla en la hoja de la ficha de entrenador y filas de las dos versiones (ganada y sin ganar).
BADGE_X = [(785, 796), (806, 835), (845, 868), (881, 904), (915, 931), (947, 966), (977, 1006), (1017, 1039)]
BADGE_ROWS = {'': (618, 678), '-off': (767, 827)}

# Hoja de fondos de caja: celdas de 170 x 162 desde (2, 2); en cada una, la pestaña en (28, 11) y el fondo en (6, 39).
WALLPAPER_CELL = (170, 162)
WALLPAPERS = {'caja-1': 0, 'caja-2': 20}

# Hoja de bolsas: caja de cada pieza (cerrada y abierta) del chico y de la chica, sacadas segmentando la hoja por su color de fondo.
BAG_PIECES = {
    'chico': {'objetos': [(397, 33, 456, 93), (537, 31, 597, 94)], 'bayas': [(417, 111, 453, 147), (516, 113, 554, 148)],
              'evol': [(562, 113, 605, 148), (677, 101, 722, 149)], 'mt': [(419, 169, 455, 213), (503, 165, 541, 214)]},
    'chica': {'objetos': [(6, 16, 60, 95), (138, 11, 192, 88)], 'bayas': [(10, 109, 46, 147), (109, 112, 147, 148)],
              'evol': [(155, 112, 198, 148), (270, 100, 315, 149)], 'mt': [(12, 169, 48, 213), (96, 165, 134, 214)]},
}


def without_background(image, background, tolerance=30):
    """La imagen con su color de fondo (más o menos `tolerance`) vuelto transparente."""
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, _ = px[x, y]
            if abs(r - background[0]) + abs(g - background[1]) + abs(b - background[2]) <= tolerance:
                px[x, y] = (0, 0, 0, 0)
    return out


def sheet(name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        raise SystemExit(f'Falta {path}: ver ARQUITECTURA, DEC-105 (hojas de interfaz de N2/B2).')
    return Image.open(path).convert('RGBA')


def badge(card, index, row):
    """Medalla de la ficha a tamaño original, con el fondo de la hoja vuelto transparente."""
    (x0, x1), (y0, y1) = BADGE_X[index], BADGE_ROWS[row]
    out = card.crop((x0, y0, x1 + 1, y1 + 1))
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, _ = px[x, y]
            if r + abs(g - 128) + abs(b - 128) < 30:
                px[x, y] = (0, 0, 0, 0)
    return out


def cropped(image):
    """La imagen recortada a lo que tiene pintado."""
    return image.crop(image.getbbox())


def rom_pieces(rom):
    pc = [lz(f) for f in narc(rom.file('a/1/4/1'))]
    hand = [lz(f) for f in narc(rom.file('a/2/0/2'))]
    arrows = cells(pc[10])
    bag = [lz(f) for f in narc(rom.file('a/0/8/7'))]
    mart = [lz(f) for f in narc(rom.file('a/0/5/3'))]
    return {
        'pc-marco': render_screen(pc[8], pc[4], pc[0]).crop((0, 0, 256, 192)),
        'pc-mano': cropped(render_cell(cells(hand[24])[0], hand[17], hand[11])),
        'pc-flecha-izda': cropped(render_cell(arrows[0], pc[6], pc[2])),
        'pc-flecha-dcha': cropped(render_cell(arrows[1], pc[6], pc[2])),
        'mochila-fondo-chico': render_screen(bag[5], bag[3], bag[4]).crop((0, 0, 256, 192)),
        'mochila-fondo-chica': render_screen(bag[2], bag[0], bag[1]).crop((0, 0, 256, 192)),
        'tienda-fondo': render_screen(mart[4], mart[0], mart[1]).crop((0, 0, 256, 192)),
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    options = sheet('b2w2-opciones-132978.png')
    card = sheet('b2w2-ficha-48409.png')
    pieces = {
        'mapa-teselia': sheet('pm-map-1340200736007.png'),
        'panel': options.crop((6, 273, 250, 319)),
        'barra': options.crop((0, 208, 256, 230)),
        'barra-off': options.crop((0, 231, 256, 254)),
    }
    bar = pieces['barra']
    # Franja oscura: el interior de la barra (filas 4 a 19) con el color de su parte oscura de x 200, de punta a punta.
    band = bar.copy()
    for y in range(4, 20):
        for x in range(8, 248):
            band.putpixel((x, y), bar.getpixel((200, y)))
    pieces['franja'] = band
    pieces['franja-pestana'] = bar.crop((0, 0, 120, bar.height))
    for index in range(8):
        for row in BADGE_ROWS:
            icon = badge(card, index, row)
            if row == '':
                pieces[f'medalla-estuche-{index + 1}'] = cropped(icon)
            icon.thumbnail((14, 26))
            pieces[f'medalla-{index + 1}{row}'] = icon
    pieces['ficha-estuche'] = card.crop((2, 2, 258, 194))
    # Cara de la Ficha sin el rótulo inglés «TRAINER'S CARD» (x 20 a 143, entre los corchetes): cada fila, con el color de la franja en x 21,
    # donde no hay letra. La interfaz pinta «FICHA DE ENTRENADOR» encima.
    face = card.crop((523, 262, 768, 427))
    for y in range(6, 22):
        for x in range(20, 144):
            face.putpixel((x, y), face.getpixel((21, y)))
    pieces['ficha'] = face
    walls = sheet('b2w2-fondos-caja-48041.png')
    for name, index in WALLPAPERS.items():
        x, y = 2 + (index % 6) * WALLPAPER_CELL[0], 2 + (index // 6) * WALLPAPER_CELL[1]
        pieces[name] = walls.crop((x + 6, y + 39, x + 162, y + 153))
        pieces[f'{name}-titulo'] = walls.crop((x + 28, y + 11, x + 140, y + 30))
    bags = sheet('b2w2-bolsas-48047.png')
    bag_background = bags.getpixel((2, 2))
    for who, pockets in BAG_PIECES.items():
        for pocket, boxes in pockets.items():
            for state, box in zip((0, 2), boxes):
                pieces[f'mochila-{who}-{pocket}-{state}'] = without_background(bags.crop(box), bag_background)
    if len(sys.argv) > 1:
        pieces.update(rom_pieces(Rom(sys.argv[1])))
    else:
        print('Sin ROM: no se tocan las piezas del PC (pc-marco, pc-mano, pc-flecha-*).')
    for name, image in pieces.items():
        image.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print(f'{len(pieces)} piezas en {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
