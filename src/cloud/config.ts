/** URL y clave pública del proyecto (DEC-63). Sin ellas no hay cuentas: el juego funciona solo en local, como antes de F4. */
// Las dos variables por nombre: `import.meta.env` entero metería en el bundle todas las `VITE_*` (también `VITE_TEST_HOOKS`, E2E-17).
const BUILD_ENV = { VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY }

/**
 * Cliente OAuth de Google del botón de inicio de sesión (DEC-70). Es público (va en la página igual que en cualquier botón de Google) y
 * es el mismo en producción y en el Supabase local, así que no va en variables de entorno.
 */
export const GOOGLE_CLIENT_ID = '364676691731-8mds5kovd2kc5ltfna20ul4i1v35jec2.apps.googleusercontent.com'

export function cloudConfig(env: Record<string, string | undefined> = BUILD_ENV): { url: string; key: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_ANON_KEY?.trim()
  return url && key ? { url, key } : null
}
