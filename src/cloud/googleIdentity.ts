import { GOOGLE_CLIENT_ID } from './config'

/** Lo que devuelve el botón de Google: el ID token y el nonce sin hash con el que se pidió (Supabase comprueba que su hash coincide). */
export type GoogleCredential = { token: string; nonce: string }

type GoogleId = {
  initialize(options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void; use_fedcm_for_button?: boolean }): void
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleId> | null = null
/** Nonce de la próxima credencial; se renueva tras cada una (un nonce, un inicio de sesión). */
let nonce: string | null = null
let listener: ((credential: GoogleCredential) => void) | null = null

/** Carga el script de Google Identity Services una sola vez, al abrir la ventana Cuenta (no entra en la ruta crítica). */
function loadGoogleId(): Promise<GoogleId> {
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('google_unavailable')))
    script.onerror = () => reject(new Error('google_unavailable'))
    document.head.append(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Pinta el botón oficial de Google en `parent` (DEC-70): al pulsarlo, Google abre su ventana y devuelve el ID token sin salir de la página,
 * que va a Supabase con `signInWithIdToken`. Solo un botón a la vez: el último que se pinta es el que recibe la credencial.
 */
export async function renderGoogleButton(parent: HTMLElement, onCredential: (credential: GoogleCredential) => void): Promise<void> {
  const id = await loadGoogleId()
  if (nonce === null) {
    const raw = crypto.randomUUID()
    nonce = raw
    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: await sha256Hex(raw),
      use_fedcm_for_button: true,
      callback: ({ credential }) => {
        nonce = null
        listener?.({ token: credential, nonce: raw })
      },
    })
  }
  listener = onCredential
  id.renderButton(parent, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', locale: 'es' })
}

/** Al cerrar la ventana: ese botón ya no recibe la credencial. */
export function releaseGoogleButton(onCredential: (credential: GoogleCredential) => void): void {
  if (listener === onCredential) listener = null
}
