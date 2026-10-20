import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** True si el módulo se ejecuta directamente (node script.mjs) y no se importa. */
export const isMain = (importMetaUrl) => process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(importMetaUrl)
