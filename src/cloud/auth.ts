/** Sesión de Supabase Auth: con Google o anónima (RF-104b). Implementación en `supabaseCloud.ts`; los tests usan una falsa. */
export type Session = { userId: string; anonymous: boolean }

export interface CloudAuth {
  getSession(): Promise<Session | null>
  signInAnonymously(): Promise<Session>
  /**
   * Va a Google y vuelve a la página (redirección). Con una sesión anónima, enlaza Google a ese mismo usuario (`linkIdentity`), así sus
   * oficiales anónimos pasan a la cuenta y no se duplican en la media del día; si ese Google ya tenía cuenta, entra en ella.
   */
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
}
