import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE_DIR } from './paths.mjs'

const USER_AGENT = 'daily-pwt-build/0.1 (fan project; dev script)'
const REQUEST_TIMEOUT_MS = 60_000
const MAX_RETRIES = 6
const WAYBACK_ANCHOR = '20260101000000'
export const PWT_CACHE_DIR = join(CACHE_DIR, 'pwt')

/** Pausa entre peticiones al mismo sitio: Internet Archive limita agresivamente (HTTP 429). */
export const PAUSE_MS = { bulbapedia: 9000, serebii: 2500, wikidex: 4000 }

export const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

/** Una página de error o de desafío no debe cachearse como si fuera contenido. */
export function looksLikeRealPage(source, html) {
  if (/Just a moment\.\.\.|cf-challenge|\/lander"|Error - wikidex|Wayback Machine has not archived/i.test(html.slice(0, 6000))) return false
  if (source === 'bulbapedia' || source === 'wikidex') return html.includes('mw-headline')
  return html.includes('Pok') && html.length > 5000
}

async function fetchText(url, source) {
  let lastProblem = 'sin respuesta'
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'follow' })
      if (response.status === 429 || response.status >= 500) {
        lastProblem = `HTTP ${response.status}`
        await sleep((Number(response.headers.get('retry-after')) || 20) * 1000 + 10_000 * (attempt + 1))
        continue
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      // Serebii sirve ISO-8859-1; el resto UTF-8.
      const text = new TextDecoder(source === 'serebii' ? 'latin1' : 'utf-8').decode(bytes)
      if (!looksLikeRealPage(source, text)) {
        lastProblem = 'respuesta que no es la página esperada'
        await sleep(10_000 * (attempt + 1))
        continue
      }
      return { text, finalUrl: response.url }
    } catch (error) {
      if (error.message.startsWith('HTTP')) throw error
      lastProblem = error?.cause?.code ?? error.message
      await sleep(5000 * (attempt + 1))
    }
  }
  throw new Error(`Agotados los reintentos (${lastProblem}): ${url}`)
}

const cacheFile = (page) => join(PWT_CACHE_DIR, `${page.source}__${page.key}.html`)

/**
 * Devuelve { html, snapshot }. Bulbapedia está tras Cloudflare (HTTP 403 a clientes sin navegador), así que se lee de
 * Internet Archive, fijando la captura (`pins[page.key]`) para que repetir la extracción dé el mismo HTML.
 * En el resto de fuentes `snapshot` es null.
 */
export async function getPage(page, { pins, offline, refresh }) {
  const file = cacheFile(page)
  const pinned = page.source === 'bulbapedia' ? pins[page.key] : null
  if (!refresh && existsSync(file) && (page.source !== 'bulbapedia' || pinned)) return { html: readFileSync(file, 'utf8'), snapshot: pinned ?? null, fromCache: true }
  if (offline) throw new Error(`Falta ${file} y se pidió --offline.`)

  const requestUrl = page.source === 'bulbapedia' ? `https://web.archive.org/web/${pinned ?? WAYBACK_ANCHOR}id_/${page.url}` : page.url
  const { text, finalUrl } = await fetchText(requestUrl, page.source)
  let snapshot = null
  if (page.source === 'bulbapedia') {
    snapshot = /\/web\/(\d{14})id_\//.exec(finalUrl)?.[1]
    if (!snapshot) throw new Error(`No se pudo leer la captura de Internet Archive en ${finalUrl}`)
  }
  mkdirSync(PWT_CACHE_DIR, { recursive: true })
  writeFileSync(file, text)
  await sleep(PAUSE_MS[page.source])
  return { html: text, snapshot, fromCache: false }
}

export const pageUrlAtSnapshot = (page, snapshot) => (snapshot ? `https://web.archive.org/web/${snapshot}/${page.url}` : page.url)
