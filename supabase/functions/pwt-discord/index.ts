// Punto de entrada de la Edge Function `pwt-discord` en Supabase (Deno). Toda la lógica está en `handler.ts`; despliegue y secretos en el
// README, «Aviso por Discord».
import { createHandler, REQUIRED_ENV, type DiscordEnv } from './handler.ts'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void }

const env = Object.fromEntries(REQUIRED_ENV.map((name) => [name, Deno.env.get(name) ?? ''])) as DiscordEnv
const missing = REQUIRED_ENV.filter((name) => !env[name])
if (missing.length > 0) console.error(`pwt-discord: faltan los secretos ${missing.join(', ')}`)

Deno.serve(createHandler(env))
