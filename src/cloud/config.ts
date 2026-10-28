/** URL y clave pública del proyecto (DEC-63). Sin ellas no hay cuentas: el juego funciona solo en local, como antes de F4. */
// Las dos variables por nombre: `import.meta.env` entero metería en el bundle todas las `VITE_*` (también `VITE_TEST_HOOKS`, E2E-17).
const BUILD_ENV = { VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY }

export function cloudConfig(env: Record<string, string | undefined> = BUILD_ENV): { url: string; key: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_ANON_KEY?.trim()
  return url && key ? { url, key } : null
}
