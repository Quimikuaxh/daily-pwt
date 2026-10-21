import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'

/**
 * Sets de Smogon de Gen 5 en individuales (data.pkmn.cc, el volcado estructurado de https://www.smogon.com/dex/bw/ que usa @pkmn/smogon).
 * Se guardan en data/smogon/ junto con un manifest (URL, fecha, SHA-256): el pool se genera sin red y sale siempre igual.
 * No hay tiers de dobles ni LC (el PRD §0 los excluye); gen5zu es el último tier de individuales publicado.
 */
export const SMOGON_TIERS = ['ubers', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu']
const BASE_URL = 'https://data.pkmn.cc/sets'
const USER_AGENT = 'daily-pwt (proyecto fan; datos de desarrollo)'

async function download(tier) {
  const url = `${BASE_URL}/gen5${tier}.json`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' })
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`)
  const text = await response.text()
  JSON.parse(text)
  return { url, text }
}

if (isMain(import.meta.url)) {
  mkdirSync(fromRoot('data', 'smogon'), { recursive: true })
  const manifest = { source: 'Smogon University (https://www.smogon.com/dex/bw/), vía https://data.pkmn.cc/sets', downloadedOn: new Date().toISOString().slice(0, 10), tiers: {} }
  for (const tier of SMOGON_TIERS) {
    const { url, text } = await download(tier)
    writeFileSync(fromRoot('data', 'smogon', `gen5${tier}.json`), text)
    manifest.tiers[tier] = { url, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') }
    console.log(`gen5${tier}.json: ${Buffer.byteLength(text)} bytes`)
  }
  writeFileSync(fromRoot('data', 'smogon', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}
