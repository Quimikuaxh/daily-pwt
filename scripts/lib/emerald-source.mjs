import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Generations } from '@pkmn/data'
import { Dex } from '@pkmn/dex'

export const gen3 = new Generations(Dex).get(3)
export const EMERALD_REVISION = '731ad5bfd6e6f265508d0efcca0ba42f9dcf5881'
const SOURCE = `https://raw.githubusercontent.com/pret/pokeemerald/${EMERALD_REVISION}`

export async function readEmeraldSource(path, hash, sourceDir) {
  let bytes
  if (sourceDir) {
    bytes = await readFile(join(sourceDir, path))
  } else {
    const response = await fetch(`${SOURCE}/${path}`, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  }
  if (createHash('sha256').update(bytes).digest('hex') !== hash) {
    throw new Error(`${path}: SHA-256 distinto de la revisión ${EMERALD_REVISION}`)
  }
  return bytes.toString('utf8')
}
