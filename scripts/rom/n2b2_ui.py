"""Piezas de interfaz de la locke de N2/B2 (DEC-102, maquetas aprobadas el 13/11/2026) en `public/ui/n2b2/`.

Lee las hojas guardadas en `scripts/.cache/n2b2-ui/` (no versionadas; su origen está en ARQUITECTURA, DEC-102) y escribe solo lo que la
interfaz usa, con los recortes de las maquetas:

- `mapa-teselia.png`: mapa de la región de N2/B2 (256 x 168, el del juego sin rótulos).
- `panel.png`, `barra.png`, `barra-off.png`: ventana y barras (seleccionada y normal) de los menús, para `border-image`.
- `franja.png` y `franja-pestana.png`: la barra seleccionada partida en dos para los títulos: la franja entera, oscura, y la pestaña clara
  con su muesca (x 0 a 120), que se estira hasta el ancho del título.
- `medalla-<n>.png` y `medalla-<n>-off.png`: las ocho medallas de Teselia, ganada y sin ganar (fondo transparente, 14 x 26 como mucho).

Uso: `npm run gen:n2b2-ui`. Requiere Python 3.10 y Pillow 10 o posterior.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, 'scripts', '.cache', 'n2b2-ui')
OUT = os.path.join(ROOT, 'public', 'ui', 'n2b2')

# Columnas de cada medalla en la hoja de la ficha de entrenador y filas de las dos versiones (ganada y sin ganar).
BADGE_X = [(785, 796), (806, 835), (845, 868), (881, 904), (915, 931), (947, 966), (977, 1006), (1017, 1039)]
BADGE_ROWS = {'': (618, 678), '-off': (767, 827)}


def sheet(name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        raise SystemExit(f'Falta {path}: ver ARQUITECTURA, DEC-102 (hojas de interfaz de N2/B2).')
    return Image.open(path).convert('RGBA')


def badge(card, index, row):
    """Medalla recortada de la ficha, con su fondo gris (128, 128) vuelto transparente y reducida a 14 x 26."""
    (x0, x1), (y0, y1) = BADGE_X[index], BADGE_ROWS[row]
    out = card.crop((x0, y0, x1 + 1, y1 + 1))
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, _ = px[x, y]
            if r + abs(g - 128) + abs(b - 128) < 30:
                px[x, y] = (0, 0, 0, 0)
    out.thumbnail((14, 26))
    return out


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
            pieces[f'medalla-{index + 1}{row}'] = badge(card, index, row)
    for name, image in pieces.items():
        image.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print(f'{len(pieces)} piezas en {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
