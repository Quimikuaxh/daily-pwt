import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

/** Utilidades de imagen para las capturas de verificación visual (hojas de contacto, superposiciones). Sin dependencias: solo PNG RGBA. */
export const loadPng = (path) => decodePng(readFileSync(path))
export const savePng = (path, image) => writeFileSync(path, encodePng(image))

const blank = (width, height, [red, green, blue] = [32, 32, 32]) => {
  const rgba = new Uint8Array(width * height * 4)
  for (let offset = 0; offset < rgba.length; offset += 4) rgba.set([red, green, blue, 255], offset)
  return { width, height, rgba }
}

export function scaleNearest(image, factor) {
  const width = Math.round(image.width * factor)
  const height = Math.round(image.height * factor)
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceOffset = (Math.min(image.height - 1, Math.floor(y / factor)) * image.width + Math.min(image.width - 1, Math.floor(x / factor))) * 4
      rgba.set(image.rgba.subarray(sourceOffset, sourceOffset + 4), (y * width + x) * 4)
    }
  }
  return { width, height, rgba }
}

export function crop(image, x, y, width, height) {
  const rgba = new Uint8Array(width * height * 4)
  for (let row = 0; row < height; row++) rgba.set(image.rgba.subarray(((y + row) * image.width + x) * 4, ((y + row) * image.width + x + width) * 4), row * width * 4)
  return { width, height, rgba }
}

/** Mezcla `top` sobre `bottom` (mismo tamaño) con opacidad `alpha` de `top`. */
export function blend(bottom, top, alpha) {
  const rgba = new Uint8Array(bottom.rgba.length)
  for (let offset = 0; offset < rgba.length; offset += 4) {
    for (let channel = 0; channel < 3; channel++) rgba[offset + channel] = Math.round(bottom.rgba[offset + channel] * (1 - alpha) + top.rgba[offset + channel] * alpha)
    rgba[offset + 3] = 255
  }
  return { width: bottom.width, height: bottom.height, rgba }
}

function paste(target, source, left, top) {
  for (let row = 0; row < source.height; row++) {
    if (top + row < 0 || top + row >= target.height) continue
    for (let column = 0; column < source.width; column++) {
      if (left + column < 0 || left + column >= target.width) continue
      const sourceOffset = (row * source.width + column) * 4
      target.rgba.set(source.rgba.subarray(sourceOffset, sourceOffset + 4), ((top + row) * target.width + left + column) * 4)
    }
  }
}

/** Cuadrícula de imágenes (cada una a su tamaño) con huecos de `gap` px. */
export function montage(images, columns, gap = 6) {
  const cellWidth = Math.max(...images.map((image) => image.width))
  const cellHeight = Math.max(...images.map((image) => image.height))
  const rows = Math.ceil(images.length / columns)
  const sheet = blank(columns * cellWidth + (columns + 1) * gap, rows * cellHeight + (rows + 1) * gap)
  images.forEach((image, index) => paste(sheet, image, gap + (index % columns) * (cellWidth + gap), gap + Math.floor(index / columns) * (cellHeight + gap)))
  return sheet
}
