"""Lectura de ROM de Nintendo DS para sacar gráficos (locke de N2/B2, DEC-105): sistema de ficheros (FNT/FAT), archivos NARC,
compresión LZ10/LZ11 y los formatos gráficos de Nintendo: paletas NCLR, teselas NCGR y mapas de teselas NSCR.

Solo lee: la ROM no se copia ni se versiona. Requiere Python 3.10 y Pillow 10 o posterior (como `scripts/decomp/comun.py`).
"""
import struct
from PIL import Image


class Rom:
    """Sistema de ficheros de una ROM de DS: `file(ruta)` devuelve los bytes de un fichero (p. ej. `a/0/8/2`)."""

    def __init__(self, path):
        self.data = open(path, 'rb').read()
        fnt_off, fnt_size, fat_off, fat_size = struct.unpack_from('<4I', self.data, 0x40)
        self.fat = [struct.unpack_from('<2I', self.data, fat_off + 8 * i) for i in range(fat_size // 8)]
        self.paths = {}
        self._walk(fnt_off, 0xF000, '')

    def _walk(self, fnt, dir_id, prefix):
        sub, first, _ = struct.unpack_from('<IHH', self.data, fnt + 8 * (dir_id & 0xFFF))
        pos, file_id = fnt + sub, first
        while True:
            length = self.data[pos]
            pos += 1
            if length == 0:
                return
            name = self.data[pos:pos + (length & 0x7F)].decode('latin-1')
            pos += length & 0x7F
            if length & 0x80:
                child = struct.unpack_from('<H', self.data, pos)[0]
                pos += 2
                self._walk(fnt, child, f'{prefix}{name}/')
            else:
                self.paths[f'{prefix}{name}'] = file_id
                file_id += 1

    def file(self, path):
        start, end = self.fat[self.paths[path]]
        return self.data[start:end]


def narc(data):
    """Ficheros de un archivo NARC, en orden."""
    if data[:4] != b'NARC':
        raise ValueError('no es un NARC')
    pos = struct.unpack_from('<H', data, 0x0C)[0]
    assert data[pos:pos + 4] == b'BTAF'
    size, count = struct.unpack_from('<IH', data, pos + 4)
    entries = [struct.unpack_from('<2I', data, pos + 12 + 8 * i) for i in range(count)]
    pos += size
    pos += struct.unpack_from('<I', data, pos + 4)[0]  # BTNF
    assert data[pos:pos + 4] == b'GMIF'
    base = pos + 8
    return [data[base + start:base + end] for start, end in entries]


def lz(data):
    """Descomprime LZ10 (0x10) o LZ11 (0x11); devuelve el original si no está comprimido."""
    if not data or data[0] not in (0x10, 0x11):
        return data
    kind = data[0]
    size = int.from_bytes(data[1:4], 'little')
    pos = 4
    if size == 0:
        size = int.from_bytes(data[4:8], 'little')
        pos = 8
    out = bytearray()
    try:
        while len(out) < size:
            flags = data[pos]
            pos += 1
            for bit in range(8):
                if len(out) >= size:
                    break
                if not flags & (0x80 >> bit):
                    out.append(data[pos])
                    pos += 1
                    continue
                if kind == 0x10:
                    a, b = data[pos], data[pos + 1]
                    pos += 2
                    count, disp = (a >> 4) + 3, ((a & 0xF) << 8 | b) + 1
                else:
                    a = data[pos]
                    indicator = a >> 4
                    if indicator == 0:
                        b, c = data[pos + 1], data[pos + 2]
                        count, disp = ((a & 0xF) << 4 | b >> 4) + 0x11, ((b & 0xF) << 8 | c) + 1
                        pos += 3
                    elif indicator == 1:
                        b, c, d = data[pos + 1], data[pos + 2], data[pos + 3]
                        count, disp = ((a & 0xF) << 12 | b << 4 | c >> 4) + 0x111, ((c & 0xF) << 8 | d) + 1
                        pos += 4
                    else:
                        b = data[pos + 1]
                        count, disp = indicator + 1, ((a & 0xF) << 8 | b) + 1
                        pos += 2
                for _ in range(count):
                    out.append(out[-disp])
    except IndexError:
        return data
    return bytes(out)


def kind_of(data):
    """Tipo de un fichero gráfico por su firma (los de Nintendo la llevan al revés): `NCLR`, `NCGR`, `NSCR`, `NCER`, `NANR`…"""
    magic = data[:4]
    return {b'RLCN': 'NCLR', b'RGCN': 'NCGR', b'RCSN': 'NSCR', b'RECN': 'NCER', b'RNAN': 'NANR', b'NARC': 'NARC'}.get(magic)


def _section(data, magic):
    pos = struct.unpack_from('<H', data, 0x0C)[0]
    while pos < len(data):
        if data[pos:pos + 4] == magic:
            return pos
        pos += struct.unpack_from('<I', data, pos + 4)[0]
    raise ValueError(f'sin sección {magic}')


def palette(data):
    """Colores de un NCLR como (r, g, b) de 8 bits, en orden (16 por subpaleta en 4bpp)."""
    pos = _section(data, b'TTLP')
    size, offset = struct.unpack_from('<2I', data, pos + 0x10)
    start = pos + 8 + offset
    raw = data[start:start + size]
    colors = []
    for i in range(0, len(raw) - 1, 2):
        value = raw[i] | raw[i + 1] << 8
        colors.append(tuple(((value >> shift) & 0x1F) * 255 // 31 for shift in (0, 5, 10)))
    return colors


def tiles(data):
    """Teselas de 8x8 de un NCGR: (lista de teselas de 64 índices, bits por píxel, ancho y alto en teselas o `None`)."""
    pos = _section(data, b'RAHC')
    height, width, depth = struct.unpack_from('<HHI', data, pos + 8)
    size, offset = struct.unpack_from('<2I', data, pos + 0x18)
    raw = data[pos + 8 + offset:pos + 8 + offset + size]
    bpp = 4 if depth == 3 else 8
    per = 32 if bpp == 4 else 64
    out = []
    for t in range(len(raw) // per):
        chunk = raw[t * per:(t + 1) * per]
        if bpp == 4:
            out.append([v for byte in chunk for v in (byte & 0xF, byte >> 4)])
        else:
            out.append(list(chunk))
    dims = (width, height) if width != 0xFFFF and height != 0xFFFF else None
    return out, bpp, dims


def screen(data):
    """Mapa de teselas de un NSCR: (ancho y alto en píxeles, entradas `(tesela, volteo horizontal, vertical, subpaleta)`)."""
    pos = _section(data, b'NRCS')
    width, height = struct.unpack_from('<HH', data, pos + 8)
    size = struct.unpack_from('<I', data, pos + 0x10)[0]
    raw = data[pos + 0x14:pos + 0x14 + size]
    entries = []
    for i in range(0, len(raw) - 1, 2):
        value = raw[i] | raw[i + 1] << 8
        entries.append((value & 0x3FF, bool(value & 0x400), bool(value & 0x800), value >> 12))
    return width, height, entries


def render_screen(scr, ncgr, nclr, transparent=False):
    """Pinta un NSCR con sus teselas y su paleta; el índice 0 de cada subpaleta, transparente si se pide."""
    width, height, entries = screen(scr)
    tile_list, bpp, _ = tiles(ncgr)
    colors = palette(nclr)
    out = Image.new('RGBA', (width, height))
    px = out.load()
    cols = width // 8
    for i, (tile, hflip, vflip, pal) in enumerate(entries[:cols * (height // 8)]):
        if tile >= len(tile_list):
            continue
        pixels = tile_list[tile]
        ox, oy = (i % cols) * 8, (i // cols) * 8
        for y in range(8):
            for x in range(8):
                v = pixels[(7 - y if vflip else y) * 8 + (7 - x if hflip else x)]
                index = (pal * 16 + v) if bpp == 4 else v
                if transparent and v == 0:
                    continue
                r, g, b = colors[index] if index < len(colors) else (255, 0, 255)
                px[ox + x, oy + y] = (r, g, b, 255)
    return out


def render_tiles(ncgr, nclr, width_tiles=None, sub=0, transparent=True):
    """Pinta las teselas de un NCGR en una rejilla (su ancho propio, si lo trae, o `width_tiles`)."""
    tile_list, bpp, dims = tiles(ncgr)
    colors = palette(nclr)
    cols = (dims[0] if dims else None) or width_tiles or 16
    rows = (len(tile_list) + cols - 1) // cols
    out = Image.new('RGBA', (cols * 8, rows * 8))
    px = out.load()
    for t, pixels in enumerate(tile_list):
        ox, oy = (t % cols) * 8, (t // cols) * 8
        for i, v in enumerate(pixels):
            if transparent and v == 0:
                continue
            index = (sub * 16 + v) if bpp == 4 else v
            r, g, b = colors[index] if index < len(colors) else (255, 0, 255)
            px[ox + i % 8, oy + i // 8] = (r, g, b, 255)
    return out


# Tamaños de un OAM (ancho, alto) por forma (cuadrado, ancho, alto) y tamaño.
_OAM_SIZES = {
    0: [(8, 8), (16, 16), (32, 32), (64, 64)],
    1: [(16, 8), (32, 8), (32, 16), (64, 32)],
    2: [(8, 16), (8, 32), (16, 32), (32, 64)],
}


def cells(data):
    """Celdas de un NCER: por celda, sus OAM como dict (x, y, ancho, alto, tesela, paleta, volteos)."""
    pos = _section(data, b'KBEC')
    count, bank_type = struct.unpack_from('<HH', data, pos + 8)
    data_off, mapping = struct.unpack_from('<II', data, pos + 12)
    base = pos + 8 + data_off
    entry = 16 if bank_type == 1 else 8
    oam_base = base + count * entry
    shift = mapping & 0x7  # 1D: el índice de tesela va en bloques de 32 << shift bytes
    out = []
    for c in range(count):
        n, _, off = struct.unpack_from('<HHI', data, base + c * entry)
        oams = []
        for k in range(n):
            a0, a1, a2 = struct.unpack_from('<3H', data, oam_base + off + 6 * k)
            y = a0 & 0xFF
            y = y - 256 if y >= 128 else y
            x = a1 & 0x1FF
            x = x - 512 if x >= 256 else x
            w, h = _OAM_SIZES[a0 >> 14][a1 >> 14]
            oams.append({'x': x, 'y': y, 'w': w, 'h': h, 'tile': (a2 & 0x3FF) << shift, 'pal': a2 >> 12,
                         'hflip': bool(a1 & 0x1000), 'vflip': bool(a1 & 0x2000), 'bpp8': bool(a0 & 0x2000)})
        out.append(oams)
    return out


def render_cell(oams, ncgr, nclr, pal_offset=0):
    """Pinta una celda (lista de OAM de `cells`) con las teselas en 1D; el origen (0, 0) de la celda queda en el centro de 256 x 256."""
    tile_list, bpp, _ = tiles(ncgr)
    colors = palette(nclr)
    out = Image.new('RGBA', (256, 256))
    px = out.load()
    for oam in oams:
        tw, th = oam['w'] // 8, oam['h'] // 8
        for ty in range(th):
            for tx in range(tw):
                index = oam['tile'] + ty * tw + tx
                if index >= len(tile_list):
                    continue
                pixels = tile_list[index]
                dx = (tw - 1 - tx) if oam['hflip'] else tx
                dy = (th - 1 - ty) if oam['vflip'] else ty
                for y in range(8):
                    for x in range(8):
                        v = pixels[(7 - y if oam['vflip'] else y) * 8 + (7 - x if oam['hflip'] else x)]
                        if v == 0:
                            continue
                        ci = ((oam['pal'] + pal_offset) * 16 + v) if bpp == 4 else v
                        r, g, b = colors[ci] if ci < len(colors) else (255, 0, 255)
                        X, Y = 128 + oam['x'] + dx * 8 + x, 128 + oam['y'] + dy * 8 + y
                        if 0 <= X < 256 and 0 <= Y < 256:
                            px[X, Y] = (r, g, b, 255)
    return out
