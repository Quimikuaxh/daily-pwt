import { crc32, deflateSync, inflateSync } from 'node:zlib'

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const COLOR_TYPE = { grayscale: 0, rgb: 2, indexed: 3, grayscaleAlpha: 4, rgba: 6 }
const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

function readChunks(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('No es un PNG (firma inválida)')
  const chunks = []
  let offset = 8
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('latin1', offset + 4, offset + 8)
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) })
    offset += 12 + length
    if (type === 'IEND') break
  }
  return chunks
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft
  const distanceLeft = Math.abs(estimate - left)
  const distanceAbove = Math.abs(estimate - above)
  const distanceUpperLeft = Math.abs(estimate - upperLeft)
  if (distanceLeft <= distanceAbove && distanceLeft <= distanceUpperLeft) return left
  return distanceAbove <= distanceUpperLeft ? above : upperLeft
}

function unfilterScanlines(raw, height, bytesPerRow, bytesPerPixel) {
  const pixels = Buffer.alloc(height * bytesPerRow)
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (bytesPerRow + 1)]
    const source = row * (bytesPerRow + 1) + 1
    const target = row * bytesPerRow
    for (let index = 0; index < bytesPerRow; index++) {
      const left = index >= bytesPerPixel ? pixels[target + index - bytesPerPixel] : 0
      const above = row > 0 ? pixels[target - bytesPerRow + index] : 0
      const upperLeft = row > 0 && index >= bytesPerPixel ? pixels[target - bytesPerRow + index - bytesPerPixel] : 0
      let predictor
      switch (filter) {
        case 0: predictor = 0; break
        case 1: predictor = left; break
        case 2: predictor = above; break
        case 3: predictor = (left + above) >> 1; break
        case 4: predictor = paeth(left, above, upperLeft); break
        default: throw new Error(`Filtro PNG desconocido: ${filter}`)
      }
      pixels[target + index] = (raw[source + index] + predictor) & 0xff
    }
  }
  return pixels
}

/** Decodifica un PNG de 8 bits sin entrelazar a RGBA. Los sprites ripeados de TSR son RGB o paleta de 8 bits. */
export function decodePng(buffer) {
  const chunks = readChunks(buffer)
  const header = chunks.find((chunk) => chunk.type === 'IHDR')?.data
  if (!header) throw new Error('PNG sin IHDR')
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  const bitDepth = header[8]
  const colorType = header[9]
  const interlaceMethod = header[12]
  if (bitDepth !== 8 || interlaceMethod !== 0 || !(colorType in CHANNELS_BY_COLOR_TYPE)) {
    throw new Error(`PNG no soportado (profundidad ${bitDepth}, tipo ${colorType}, entrelazado ${interlaceMethod})`)
  }
  const channels = CHANNELS_BY_COLOR_TYPE[colorType]
  const palette = chunks.find((chunk) => chunk.type === 'PLTE')?.data
  const paletteAlpha = chunks.find((chunk) => chunk.type === 'tRNS')?.data
  if (colorType === COLOR_TYPE.indexed && !palette) throw new Error('PNG indexado sin paleta')

  const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data))
  const pixels = unfilterScanlines(inflateSync(compressed), height, width * channels, channels)

  const rgba = new Uint8Array(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel++) {
    const source = pixel * channels
    const target = pixel * 4
    if (colorType === COLOR_TYPE.rgba) {
      rgba.set(pixels.subarray(source, source + 4), target)
    } else if (colorType === COLOR_TYPE.rgb) {
      rgba.set(pixels.subarray(source, source + 3), target)
      rgba[target + 3] = 255
    } else if (colorType === COLOR_TYPE.indexed) {
      const entry = pixels[source]
      rgba.set(palette.subarray(entry * 3, entry * 3 + 3), target)
      rgba[target + 3] = paletteAlpha && entry < paletteAlpha.length ? paletteAlpha[entry] : 255
    } else if (colorType === COLOR_TYPE.grayscale) {
      rgba.fill(pixels[source], target, target + 3)
      rgba[target + 3] = 255
    } else {
      rgba.fill(pixels[source], target, target + 3)
      rgba[target + 3] = pixels[source + 1]
    }
  }
  return { width, height, rgba }
}

function buildChunk(type, data) {
  const typeBytes = Buffer.from(type, 'latin1')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBytes.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length)
  return chunk
}

/** Codifica RGBA de 8 bits como PNG. Determinista: mismos píxeles, mismos bytes. */
export function encodePng({ width, height, rgba }) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = COLOR_TYPE.rgba
  const bytesPerRow = width * 4
  const scanlines = Buffer.alloc(height * (bytesPerRow + 1))
  for (let row = 0; row < height; row++) {
    Buffer.from(rgba.buffer, rgba.byteOffset + row * bytesPerRow, bytesPerRow).copy(scanlines, row * (bytesPerRow + 1) + 1)
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    buildChunk('IHDR', header),
    buildChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    buildChunk('IEND', Buffer.alloc(0)),
  ])
}

/** Recorta sin reescalar. `box` = [x, y, ancho, alto]; lanza si se sale de la imagen. */
export function cropImage(image, [x, y, width, height]) {
  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > image.width || y + height > image.height) {
    throw new Error(`Recorte [${x},${y},${width},${height}] fuera de la imagen ${image.width}x${image.height}`)
  }
  const rgba = new Uint8Array(width * height * 4)
  for (let row = 0; row < height; row++) {
    const start = ((y + row) * image.width + x) * 4
    rgba.set(image.rgba.subarray(start, start + width * 4), row * width * 4)
  }
  return { width, height, rgba }
}

/** Caja [x, y, ancho, alto] de los píxeles con alfa > 0; `null` si la imagen es transparente entera. */
export function opaqueBox(image) {
  let [left, top, right, bottom] = [image.width, image.height, -1, -1]
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.rgba[(y * image.width + x) * 4 + 3] === 0) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  return right < 0 ? null : [left, top, right - left + 1, bottom - top + 1]
}

/** Pone alfa 0 a los píxeles cuyo color RGB coincide con alguno de `colors` ([r, g, b]). */
export function makeColorsTransparent(image, colors) {
  const rgba = new Uint8Array(image.rgba)
  for (let offset = 0; offset < rgba.length; offset += 4) {
    if (colors.some(([red, green, blue]) => rgba[offset] === red && rgba[offset + 1] === green && rgba[offset + 2] === blue)) rgba[offset + 3] = 0
  }
  return { ...image, rgba }
}

/** Pone alfa 0 en rectángulos [x, y, ancho, alto] de la imagen (motas sueltas de la hoja original). */
export function eraseBoxes(image, boxes) {
  const rgba = new Uint8Array(image.rgba)
  for (const [x, y, width, height] of boxes) {
    if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) throw new Error(`Borrado [${x},${y},${width},${height}] fuera de la imagen ${image.width}x${image.height}`)
    for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) rgba[(row * image.width + column) * 4 + 3] = 0
  }
  return { ...image, rgba }
}

/**
 * Copia cajas de la propia imagen sobre otras ([{ from: [x,y,ancho,alto], to: [x,y] }]): sirve para tapar un texto
 * horizontal repitiendo el patrón de puntos del fondo (el desplazamiento debe ser múltiplo del periodo del patrón).
 */
export function cloneBoxes(image, copies) {
  const rgba = new Uint8Array(image.rgba)
  for (const { from: [x, y, width, height], to: [targetX, targetY] } of copies) {
    const inside = (left, top) => left >= 0 && top >= 0 && left + width <= image.width && top + height <= image.height
    if (!inside(x, y) || !inside(targetX, targetY)) throw new Error(`Copia [${x},${y},${width},${height}] -> [${targetX},${targetY}] fuera de la imagen ${image.width}x${image.height}`)
    const copy = new Uint8Array(width * height * 4)
    for (let row = 0; row < height; row++) copy.set(image.rgba.subarray(((y + row) * image.width + x) * 4, ((y + row) * image.width + x + width) * 4), row * width * 4)
    for (let row = 0; row < height; row++) rgba.set(copy.subarray(row * width * 4, (row + 1) * width * 4), ((targetY + row) * image.width + targetX) * 4)
  }
  return { ...image, rgba }
}

/**
 * Rellena rectángulos con un color plano: `{ box: [x,y,ancho,alto], color: [r,g,b] }` o `{ box, from: [x,y] }` (toma el color de ese píxel).
 * Sirve para limpiar rótulos y texto de una captura cuando el fondo es plano; el relleno es opaco.
 */
export function fillBoxes(image, fills) {
  const rgba = new Uint8Array(image.rgba)
  for (const { box: [x, y, width, height], color, from } of fills) {
    if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) throw new Error(`Relleno [${x},${y},${width},${height}] fuera de la imagen ${image.width}x${image.height}`)
    let red, green, blue
    if (color) [red, green, blue] = color
    else {
      const offset = (from[1] * image.width + from[0]) * 4
      ;[red, green, blue] = [image.rgba[offset], image.rgba[offset + 1], image.rgba[offset + 2]]
    }
    for (let row = y; row < y + height; row++) {
      for (let column = x; column < x + width; column++) rgba.set([red, green, blue, 255], (row * image.width + column) * 4)
    }
  }
  return { ...image, rgba }
}

const insideClip = (clip, x, y) => !clip || (x - y >= clip[0] && x - y <= clip[1])

/**
 * Limpieza de una captura entera (antes de recortar). Todo se lee de la imagen original, no de lo ya escrito:
 * - `tile`: `{ from: [x,y,w,h], box: [x,y,w,h] }` rellena `box` repitiendo el mosaico `from` anclado en su esquina; w y h deben ser múltiplos del
 *   periodo del dibujo (16 px en las rejillas del juego) para que las líneas caigan donde estaban.
 * - `clone`: `{ from: [x,y,w,h], to: [x,y] }` copia una caja tal cual.
 * - `fill`: `{ box, color: [r,g,b] | from: [x,y] }` color plano (del píxel indicado si se usa `from`).
 * `clip: [min, max]` limita cualquiera de ellos a los píxeles con min <= x - y <= max: así se respeta una diagonal de 45° (la línea turquesa
 * del fondo de datos) al limpiar a ambos lados de ella.
 */
export function cleanImage(image, { tile = [], clone = [], fill = [] }) {
  const source = image.rgba
  const rgba = new Uint8Array(source)
  const at = (x, y) => (y * image.width + x) * 4
  const check = (name, [x, y, width, height]) => {
    if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) throw new Error(`${name} [${x},${y},${width},${height}] fuera de la imagen ${image.width}x${image.height}`)
  }
  const mod = (value, size) => ((value % size) + size) % size
  for (const { from, box, clip } of tile) {
    check('Mosaico origen', from)
    check('Mosaico destino', box)
    const [fromX, fromY, fromWidth, fromHeight] = from
    const [x, y, width, height] = box
    for (let row = y; row < y + height; row++) {
      for (let column = x; column < x + width; column++) {
        if (!insideClip(clip, column, row)) continue
        const sourceOffset = at(fromX + mod(column - fromX, fromWidth), fromY + mod(row - fromY, fromHeight))
        rgba.set(source.subarray(sourceOffset, sourceOffset + 4), at(column, row))
      }
    }
  }
  for (const { from, to, clip } of clone) {
    check('Copia origen', from)
    check('Copia destino', [to[0], to[1], from[2], from[3]])
    for (let row = 0; row < from[3]; row++) {
      for (let column = 0; column < from[2]; column++) {
        if (!insideClip(clip, to[0] + column, to[1] + row)) continue
        const sourceOffset = at(from[0] + column, from[1] + row)
        rgba.set(source.subarray(sourceOffset, sourceOffset + 4), at(to[0] + column, to[1] + row))
      }
    }
  }
  for (const { box, color, from, clip } of fill) {
    check('Relleno', box)
    const [x, y, width, height] = box
    const [red, green, blue] = color ?? [source[at(from[0], from[1])], source[at(from[0], from[1]) + 1], source[at(from[0], from[1]) + 2]]
    for (let row = y; row < y + height; row++) {
      for (let column = x; column < x + width; column++) {
        if (insideClip(clip, column, row)) rgba.set([red, green, blue, 255], at(column, row))
      }
    }
  }
  return { ...image, rgba }
}

/** Pega varios recortes del mismo tamaño en una tira horizontal (fotogramas de una animación): `boxes` = [[x,y,ancho,alto], ...]. */
export function stripImage(image, boxes) {
  const [, , width, height] = boxes[0]
  if (!boxes.every((box) => box[2] === width && box[3] === height)) throw new Error('Los fotogramas de una tira deben medir lo mismo')
  const rgba = new Uint8Array(width * boxes.length * height * 4)
  boxes.forEach((box, index) => {
    const frame = cropImage(image, box)
    for (let row = 0; row < height; row++) rgba.set(frame.rgba.subarray(row * width * 4, (row + 1) * width * 4), (row * width * boxes.length + index * width) * 4)
  })
  return { width: width * boxes.length, height, rgba }
}

/**
 * Reduce una imagen por un factor entero eligiendo un píxel de cada bloque (vecino más cercano, sin mezclar colores: el pixel art no se difumina).
 * Se usa con las bolas, que en la hoja de origen son mayores que en el campo.
 */
export function shrinkImage(image, factor) {
  if (!Number.isInteger(factor) || factor < 1 || image.width % factor !== 0 || image.height % factor !== 0) throw new Error(`Reducción x${factor} no válida para ${image.width}x${image.height}`)
  const width = image.width / factor
  const height = image.height / factor
  const rgba = new Uint8Array(width * height * 4)
  const half = Math.floor(factor / 2)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * factor + half) * image.width + x * factor + half) * 4
      rgba.set(image.rgba.subarray(offset, offset + 4), (y * width + x) * 4)
    }
  }
  return { width, height, rgba }
}

/**
 * Pone alfa 0 a todo lo que se alcanza desde los puntos `seeds` ([[x, y], ...]) sin cruzar píxeles del color `stop` ([r, g, b]) y con vecinos de 4 direcciones.
 * Sirve para quitar el fondo de un botón recortado de una captura: se parte de las esquinas exteriores y el borde del botón detiene el relleno.
 */
export function floodTransparent(image, seeds, stop) {
  const rgba = new Uint8Array(image.rgba)
  const visited = new Uint8Array(image.width * image.height)
  const isStop = (index) => rgba[index * 4] === stop[0] && rgba[index * 4 + 1] === stop[1] && rgba[index * 4 + 2] === stop[2]
  const pending = []
  for (const [x, y] of seeds) {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) throw new Error(`Semilla [${x},${y}] fuera de la imagen ${image.width}x${image.height}`)
    pending.push(y * image.width + x)
  }
  while (pending.length > 0) {
    const index = pending.pop()
    if (visited[index] || isStop(index)) continue
    visited[index] = 1
    rgba[index * 4 + 3] = 0
    const x = index % image.width
    const y = Math.floor(index / image.width)
    if (x > 0) pending.push(index - 1)
    if (x < image.width - 1) pending.push(index + 1)
    if (y > 0) pending.push(index - image.width)
    if (y < image.height - 1) pending.push(index + image.width)
  }
  return { ...image, rgba }
}
