/**
 * Aviso de Hoy para elegir nombre e iniciar sesión (RF-94b; Jose, 31/10/2026): se recuerda en este navegador el último día del reto en que
 * se enseñó (como mucho una vez al día) y si se marcó «No volver a mostrar». Clave `daily-pwt:welcome`. Todo en try/catch: sin
 * almacenamiento se enseña como mucho una vez por pestaña (lo controla quien lo usa).
 */
const WELCOME_KEY = 'daily-pwt:welcome'

type WelcomeMemory = { lastShown: string | null; never: boolean }

function read(storage: Storage | null): WelcomeMemory {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(WELCOME_KEY) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return { lastShown: null, never: false }
    const { lastShown, never } = parsed as { lastShown?: unknown; never?: unknown }
    return { lastShown: typeof lastShown === 'string' ? lastShown : null, never: never === true }
  } catch {
    return { lastShown: null, never: false }
  }
}

function write(storage: Storage | null, memory: WelcomeMemory): void {
  try {
    storage?.setItem(WELCOME_KEY, JSON.stringify(memory))
  } catch {
    // Sin sitio o bloqueado: no se recuerda.
  }
}

/** Si toca enseñar el aviso el día del reto `today`: no se ha marcado «No volver a mostrar» ni se ha enseñado ya ese día. */
export function welcomeDue(storage: Storage | null, today: string): boolean {
  const memory = read(storage)
  return !memory.never && memory.lastShown !== today
}

export function markWelcomeShown(storage: Storage | null, today: string): void {
  write(storage, { ...read(storage), lastShown: today })
}

export function dismissWelcomeForever(storage: Storage | null): void {
  write(storage, { ...read(storage), never: true })
}

export function clearWelcome(storage: Storage | null): void {
  try {
    storage?.removeItem(WELCOME_KEY)
  } catch {
    // Nada que hacer.
  }
}
