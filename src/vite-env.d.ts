/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Proyecto de Supabase (F4, DEC-63). Sin las dos, no hay cuentas y todo funciona en local. */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
