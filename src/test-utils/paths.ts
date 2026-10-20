import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** Raíz del repositorio (src/test-utils/../..). */
export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

export const fromRoot = (...parts: string[]): string => resolve(ROOT, ...parts)
export const existsInRoot = (...parts: string[]): boolean => existsSync(fromRoot(...parts))
export const readJson = <T = any>(...parts: string[]): T =>
  JSON.parse(readFileSync(fromRoot(...parts), 'utf8')) as T

/** Importa un script .mjs por ruta (sin que el bundler lo resuelva en estático). */
export async function importScript(rel: string): Promise<any> {
  const { pathToFileURL } = await import('node:url')
  return import(/* @vite-ignore */ pathToFileURL(fromRoot(rel)).href)
}
