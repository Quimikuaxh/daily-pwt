import type { GoogleCredential } from './googleIdentity'

/** Sesión de Supabase Auth: con Google o anónima (RF-104b). Implementación en `supabaseCloud.ts`; los tests usan una falsa. */
export type Session = { userId: string; anonymous: boolean }

export interface CloudAuth {
  getSession(): Promise<Session | null>
  signInAnonymously(): Promise<Session>
  /**
   * Abre la sesión con el ID token del botón de Google (`signInWithIdToken`, DEC-70), sin salir de la página. Lo jugado con la sesión
   * anónima pasa a la cuenta después, con el código de `create_guest_claim` (`Account.signIn`). *Descartado:* enlazar Google a la sesión
   * anónima (`linkIdentity`): si ese Google ya tenía cuenta, había que iniciar sesión dos veces.
   */
  signInWithGoogle(credential: GoogleCredential): Promise<Session>
  signOut(): Promise<void>
}
