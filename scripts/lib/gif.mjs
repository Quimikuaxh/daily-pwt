/** Decodificador mínimo de GIF: solo calcula la caja no transparente (unión de todos los fotogramas). */

function lzwDecode(data, minCodeSize, pixelCount) {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  const output = new Uint8Array(pixelCount)
  let prefix = new Int32Array(4096)
  let suffix = new Uint8Array(4096)
  let stack = new Uint8Array(4097)
  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  let previous = -1
  let bitBuffer = 0
  let bitCount = 0
  let position = 0
  let written = 0
  for (let code = 0; code < clearCode; code++) suffix[code] = code
  while (written < pixelCount) {
    while (bitCount < codeSize) {
      if (position >= data.length) return output
      bitBuffer |= data[position++] << bitCount
      bitCount += 8
    }
    let code = bitBuffer & ((1 << codeSize) - 1)
    bitBuffer >>= codeSize
    bitCount -= codeSize
    if (code === clearCode) {
      codeSize = minCodeSize + 1
      nextCode = endCode + 1
      previous = -1
      continue
    }
    if (code === endCode) break
    let stackTop = 0
    let current = code
    if (previous === -1) {
      output[written++] = suffix[code]
      previous = code
      continue
    }
    if (code >= nextCode) {
      stack[stackTop++] = suffix[firstOf(previous)]
      current = previous
    }
    while (current >= clearCode) {
      stack[stackTop++] = suffix[current]
      current = prefix[current]
    }
    stack[stackTop++] = suffix[current]
    const firstValue = suffix[current]
    while (stackTop > 0 && written < pixelCount) output[written++] = stack[--stackTop]
    if (nextCode < 4096) {
      prefix[nextCode] = previous
      suffix[nextCode] = firstValue
      nextCode++
      if (nextCode === 1 << codeSize && codeSize < 12) codeSize++
    }
    previous = code
  }
  return output

  function firstOf(codeValue) {
    let current = codeValue
    while (current >= clearCode) current = prefix[current]
    return current
  }
}

/** Devuelve `{ width, height, box: [x, y, w, h] | null }`; `box` es la unión del contenido no transparente de todos los fotogramas. */
export function gifOpaqueBox(buffer) {
  if (buffer.toString('latin1', 0, 3) !== 'GIF') throw new Error('No es un GIF')
  const width = buffer.readUInt16LE(6)
  const height = buffer.readUInt16LE(8)
  const flags = buffer[10]
  let position = 13
  if (flags & 0x80) position += 3 * (1 << ((flags & 7) + 1))
  let transparentIndex = -1
  let minX = width, minY = height, maxX = -1, maxY = -1
  while (position < buffer.length) {
    const block = buffer[position++]
    if (block === 0x3b) break
    if (block === 0x21) {
      const label = buffer[position++]
      if (label === 0xf9) transparentIndex = buffer[position + 1] & 1 ? buffer[position + 4] : -1
      while (buffer[position] !== 0) position += buffer[position] + 1
      position++
    } else if (block === 0x2c) {
      const left = buffer.readUInt16LE(position)
      const top = buffer.readUInt16LE(position + 2)
      const frameWidth = buffer.readUInt16LE(position + 4)
      const frameHeight = buffer.readUInt16LE(position + 6)
      const frameFlags = buffer[position + 8]
      position += 9
      if (frameFlags & 0x80) position += 3 * (1 << ((frameFlags & 7) + 1))
      const minCodeSize = buffer[position++]
      const chunks = []
      while (buffer[position] !== 0) {
        chunks.push(buffer.subarray(position + 1, position + 1 + buffer[position]))
        position += buffer[position] + 1
      }
      position++
      const indices = lzwDecode(Buffer.concat(chunks), minCodeSize, frameWidth * frameHeight)
      const interlaced = (frameFlags & 0x40) !== 0
      const rowOrder = interlaced ? interlacedRows(frameHeight) : null
      for (let row = 0; row < frameHeight; row++) {
        const targetRow = top + (rowOrder ? rowOrder[row] : row)
        for (let column = 0; column < frameWidth; column++) {
          if (indices[row * frameWidth + column] === transparentIndex) continue
          const x = left + column
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (targetRow < minY) minY = targetRow
          if (targetRow > maxY) maxY = targetRow
        }
      }
    } else break
  }
  return { width, height, box: maxX < 0 ? null : [minX, minY, maxX - minX + 1, maxY - minY + 1] }
}

function interlacedRows(height) {
  const order = []
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let row = start; row < height; row += step) order.push(row)
  return order
}
