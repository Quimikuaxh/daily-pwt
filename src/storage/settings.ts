/** Velocidad de las animaciones y los textos del combate. */
export type BattleSpeed = 1 | 2 | 4
export const SPEEDS: readonly BattleSpeed[] = [1, 2, 4]

/** `moveAnimations`: animaciones de movimientos en combate (DEC-53), activadas por defecto. */
export type Settings = { speed: BattleSpeed; moveAnimations: boolean }

export const SETTINGS_KEY = 'daily-pwt:settings'
const SCHEMA_VERSION = 1
export const DEFAULT_SETTINGS: Settings = { speed: 1, moveAnimations: true }

/**
 * Ajustes del jugador en `localStorage` (clave `daily-pwt:settings`), aparte del progreso: son una comodidad de este navegador.
 * Todo en try/catch: sin almacenamiento, o con un valor ilegible, valen los de por defecto.
 */
export function loadSettings(storage: Storage | null): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS
    const { version, speed, moveAnimations } = parsed as { version?: unknown; speed?: unknown; moveAnimations?: unknown }
    if (version !== SCHEMA_VERSION) return DEFAULT_SETTINGS
    return {
      speed: SPEEDS.includes(speed as BattleSpeed) ? (speed as BattleSpeed) : DEFAULT_SETTINGS.speed,
      // Ajustes guardados antes de existir la opción: activadas.
      moveAnimations: typeof moveAnimations === 'boolean' ? moveAnimations : DEFAULT_SETTINGS.moveAnimations,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(storage: Storage | null, settings: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify({ version: SCHEMA_VERSION, ...settings }))
  } catch {
    // Sin sitio o bloqueado: el ajuste vale mientras la pestaña siga abierta.
  }
}

export function clearSettings(storage: Storage | null): void {
  try {
    storage?.removeItem(SETTINGS_KEY)
  } catch {
    // Nada que hacer: ya no se podía leer.
  }
}
