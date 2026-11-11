"""Utilidades comunes para sacar recursos de los decompilados de pret (GBA, 4bpp/8bpp).

No saben nada de un juego concreto: cada juego tiene su receta (p. ej. esmeralda.py) que llama a `iniciar` con la
revisión fijada, las carpetas que gestiona y la carpeta de la interfaz, define sus pasos y termina con `terminar`.
Requiere Python 3.10 y Pillow 10 o posterior.

Salida versionada, relativa a la raíz del repo: las imágenes de la interfaz en `UI` (p. ej. public/ui/emerald/), los
sprites de especies donde diga la receta y los datos en JSON (src/generated/<juego>/). Con `--comprobar` extrae a una
carpeta temporal y compara byte a byte con lo versionado, sin tocarlo (test de reproducibilidad).
"""
import filecmp, json, struct, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = G = OUT = None
UI = None
MANAGED = ()
CHECK = False
WRITTEN = set()


def iniciar(proyecto, revision, ui, gestionadas):
    """Lee la línea de órdenes (RUTA_DECOMPILADO [--comprobar]), comprueba la revisión y prepara la salida.
    proyecto: nombre del repositorio de pret (pokeemerald, pokefirered…), para reconocer el archivo <proyecto>-<SHA>.
    ui: carpeta (relativa a la raíz) de las imágenes de interfaz; gestionadas: carpetas que la receta escribe enteras
    (con --comprobar, un fichero que sobre en ellas es un error)."""
    global SRC, G, OUT, UI, MANAGED, CHECK
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(f'Uso: {sys.argv[0]} RUTA_{proyecto.upper()} [--comprobar]')
    SRC = Path(args[0]).resolve()
    CHECK = '--comprobar' in sys.argv[1:]
    G = SRC / 'graphics'
    UI, MANAGED = ui, tuple(gestionadas)
    OUT = Path(tempfile.mkdtemp(prefix='decomp-')) if CHECK else ROOT
    actual = subprocess.run(['git', '-C', str(SRC), 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() \
        if (SRC / '.git').exists() else SRC.name.removeprefix(proyecto + '-')
    if actual != revision:
        sys.exit(f'{SRC} no es pret/{proyecto} en {revision}')


def _destino(name):
    rel = name if '/' in name else f'{UI}/{name}'
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    WRITTEN.add(rel)
    return path


def save(im, name):
    """Guarda una imagen: un nombre sin carpeta va a la carpeta de interfaz; con carpeta, relativo a la raíz."""
    im.save(_destino(name), optimize=True)


def write_json(rel, data):
    _destino(rel).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n')


def terminar(pasos):
    """Ejecuta los pasos y, con --comprobar, compara la extracción con lo versionado."""
    for paso in pasos:
        paso()
    if not CHECK:
        print('ok', len(WRITTEN), 'ficheros')
        return
    diff = sorted(rel for rel in WRITTEN if not (ROOT / rel).exists() or not filecmp.cmp(OUT / rel, ROOT / rel, shallow=False))
    stale = sorted(str(p.relative_to(ROOT)) for d in MANAGED for p in (ROOT / d).rglob('*') if p.is_file() and str(p.relative_to(ROOT)) not in WRITTEN)
    if diff or stale:
        sys.exit('La extracción no coincide con lo versionado.\n  Distintos o ausentes: ' + ', '.join(diff[:20]) +
                 ('…' if len(diff) > 20 else '') + '\n  Sobrantes: ' + ', '.join(stale[:20]))
    print('Coincide con lo versionado:', len(WRITTEN), 'ficheros')


def u16(path):
    b = Path(path).read_bytes()
    return struct.unpack('<%dH' % (len(b) // 2), b)


def jasc(path):
    return [tuple(map(int, l.split())) for l in Path(path).read_text().splitlines()[3:] if l.strip()]


def pngpal(im):
    r = im.getpalette()
    return [tuple(r[i:i + 3]) for i in range(0, len(r), 3)]


def tilemap(tiles, data, w, h, stride, colors, x0=0, y0=0, bank=None, off=0):
    """Pinta w x h teselas de un tilemap GBA de 4bpp. El índice 0 es transparente."""
    out = Image.new('RGBA', (w * 8, h * 8))
    px, tw, th = tiles.load(), tiles.width // 8, tiles.height // 8
    for y in range(h):
        for x in range(w):
            n = data[(y + y0) * stride + x + x0]
            idx = (n & 1023) - off
            if not 0 <= idx < tw * th:
                continue
            tx, ty, b = idx % tw * 8, idx // tw * 8, (n >> 12 if bank is None else bank) * 16
            for j in range(8):
                for i in range(8):
                    c = px[tx + (7 - i if n & 1024 else i), ty + (7 - j if n & 2048 else j)] % 16
                    if c:
                        out.putpixel((x * 8 + i, y * 8 + j), colors[(b + c) % len(colors)] + (255,))
    return out


def sprite(path, box=None, keep0=False):
    """PNG indexado -> RGBA con el índice 0 transparente."""
    im = Image.open(path)
    pal = pngpal(im)
    if box:
        im = im.crop(box)
    out = Image.new('RGBA', im.size)
    out.putdata([pal[c] + (255 if c or keep0 else 0,) for c in im.getdata()])
    return out


def indexed(path):
    """PNG indexado del decompilado tal cual, con el índice 0 transparente: sin pérdida y mucho más ligero que RGBA
    (para sprites e iconos que se publican sin componer)."""
    im = Image.open(path)
    im.load()
    im.info['transparency'] = 0
    return im


def save_indexed(im, name):
    im.save(_destino(name), optimize=True, transparency=0)


def ruta(*partes):
    """Ruta dentro de graphics/ del decompilado."""
    return G.joinpath(*partes)


def erase(im, box, keep):
    # Borra un rótulo dibujado en la plantilla: dentro de box, todo color que no esté en keep toma el del píxel de su
    # izquierda que sí lo esté (el fondo del botón o de la tira).
    px = im.load()
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        fill = next((px[x, y] for x in range(x0, x1) if px[x, y][:3] in keep), px[x0, y])
        for x in range(x0, x1):
            if px[x, y][:3] in keep:
                fill = px[x, y]
            else:
                px[x, y] = fill
