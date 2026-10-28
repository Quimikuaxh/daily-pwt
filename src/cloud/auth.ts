/** Sesión de Supabase Auth: con Google o anónima (RF-104b). Implementación en `supabaseCloud.ts`; los tests usan una falsa. */
export type Session = { userId: string; anonymous: boolean }

export interface CloudAuth {
  getSession(): Promise<Session | null>
  signInAnonymously(): Promise<Session>
  /**
   * Va a Google y vuelve a la página (redirección), en un solo paso. Lo jugado con la sesión anónima pasa a la cuenta después, con el
   * código de `create_guest_claim` (`Account.signIn`). *Descartado:* enlazar Google a la sesión anónima (`linkIdentity`): si ese Google ya
   * tenía cuenta, había que iniciar sesión dos veces.
   */
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
}
