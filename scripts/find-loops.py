"""
Puntos de bucle de la música de combate (DEC-57), sobre los .m4a ya codificados (no hace falta el FLAC ni red).

Uso: python3 scripts/find-loops.py public/audio/music/gym-kanto.m4a [...]   (necesita ffmpeg y numpy)
Imprime loopStartSec/loopEndSec para copiarlos a data/audio.json; después, npm run gen:audio.

Cada pista es introducción + bucle dos veces + fundido. Las dos vueltas no son idénticas muestra a muestra (percusión de ruido,
vibratos), así que:
1. Longitud del bucle L: el desfase en el que el espectrograma (bandas logarítmicas, 20 ms) más se parece a sí mismo; se afina a la
   muestra con correlación cruzada de trozos de 3 s en la segunda mitad (mediana).
2. Zona repetida: el tramo más largo (>= 20 s) en el que el espectro en t y en t + L se parece (coseno medio en 2 s > 0,8).
3. Costura: dentro de esa zona y al menos 15 s antes del final (fuera del fundido), el punto t con menos diferencia entre la forma de
   onda en t y en t + L (ventana de 0,12 s, desfase local afinado a ±3 ms). loopStart = t, loopEnd = t + desfase local.
El reproductor funde 40 ms antes de la costura con lo que suena antes de loopStart, así que no hace falta que coincidan exactas.
"""
import subprocess
import sys

import numpy as np

SR = 48000


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def spectrogram(x, hop=160, n=1024, bands=48):
    """Espectrograma normalizado por fotograma de x a 8 kHz."""
    y = x[::6]
    frames = (len(y) - n) // hop
    idx = np.arange(n)[None, :] + hop * np.arange(frames)[:, None]
    spec = np.abs(np.fft.rfft(y[idx] * np.hanning(n), axis=1))
    edges = np.unique(np.geomspace(2, spec.shape[1] - 1, bands + 1).astype(int))
    s = np.log1p(np.stack([spec[:, edges[i]:edges[i + 1]].sum(axis=1) for i in range(len(edges) - 1)], axis=1) * 10)
    s = s - s.mean(axis=0)
    return s / (np.linalg.norm(s, axis=1, keepdims=True) + 1e-9), 8000 / hop


def loop_length(x, s, fps):
    best = max(
        (np.mean(np.sort((s[:-lag] * s[lag:]).sum(axis=1))[-int((len(s) - lag) * 0.3):]), lag)
        for lag in range(int(20 * fps), int(len(s) * 0.6))
    )[1] / fps
    dur = len(x) / SR
    lags = []
    for c in np.linspace(dur * 0.45, dur - 15, 12):
        a, n, w = int(c * SR), int(3 * SR), int(0.08 * SR)
        lo = a - int(best * SR) - w
        if lo < 0:
            continue
        corr = np.correlate(x[lo:a - int(best * SR) + w + n], x[a:a + n], mode='valid')
        lags.append((a - (lo + int(np.argmax(corr)))) / SR)
    return float(np.median(lags))


def repeated_zone(s, fps, length):
    lag = int(round(length * fps))
    k = int(2 * fps)
    smooth = np.convolve((s[:-lag] * s[lag:]).sum(axis=1), np.ones(k) / k, mode='same')
    runs, start = [], None
    for i, good in enumerate(np.append(smooth > 0.8, False)):
        if good and start is None:
            start = i
        if not good and start is not None:
            runs.append((start, i))
            start = None
    a, b = max((r for r in runs if (r[1] - r[0]) / fps >= 20), key=lambda r: r[1] - r[0])
    return a / fps, b / fps


def seam_at(x, t, length, win=0.12, search=0.003):
    """Desfase local fraccional en t y diferencia (dB) entre la ventana en t y la de t + desfase."""
    a, n, s = int(t * SR), int(win * SR), int(search * SR)
    seg = x[a:a + n]
    b = int(round((t + length) * SR))
    c = np.correlate(x[b - s:b + s + n], seg, mode='valid')
    k = int(np.argmax(c))
    d = 0.5 * (c[k - 1] - c[k + 1]) / (c[k - 1] - 2 * c[k] + c[k + 1]) if 0 < k < len(c) - 1 else 0
    lag = (b - s + k + d - a) / SR
    m, b0 = n + 256, int(np.floor(a + lag * SR)) - 128
    f = np.fft.rfftfreq(m)
    shifted = np.fft.irfft(np.fft.rfft(x[b0:b0 + m]) * np.exp(2j * np.pi * f * (a + lag * SR - (b0 + 128))), m)[128:128 + n]
    diff = 10 * np.log10(((seg - shifted) ** 2).sum() / ((seg ** 2).sum() + (shifted ** 2).sum() + 1e-12) + 1e-12)
    return lag, diff, float(np.sqrt((seg ** 2).mean()))


def find(path):
    x = decode(path)
    s, fps = spectrogram(x)
    length = loop_length(x, s, fps)
    a, b = repeated_zone(s, fps, length)
    best = None
    for t in np.arange(a + 1, min(b - 1, len(x) / SR - length - 15), 0.05):
        lag, diff, rms = seam_at(x, t, length)
        if rms >= 0.02 and (best is None or diff < best[2]):
            best = (t, lag, diff)
    t, lag, diff = best
    return {'loopStartSec': round(float(t), 4), 'loopEndSec': round(float(t + lag), 4), 'seamDb': round(float(diff), 1), 'repeatedFromSec': round(a, 2)}


if __name__ == '__main__':
    for track in sys.argv[1:]:
        print(track, find(track), flush=True)
