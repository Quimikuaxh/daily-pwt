/** Velocidad de las animaciones y los textos del combate. */
export type BattleSpeed = 1 | 2 | 4
export const SPEEDS: readonly BattleSpeed[] = [1, 2, 4]

/**
 * `moveAnimations`: animaciones de movimientos en combate (DEC-53), activadas por defecto. `sound` y `volume` (0-100): música y efectos
 * (DEC-57), activados y a 70 por defecto (decisión de Jose); el volumen vale para los dos.
 */
export type Settings = { speed: BattleSpeed; moveAnimations: boolean; sound: boolean; volume: number }

export const SETTINGS_KEY = 'daily-pwt:settings'
const SCHEMA_VERSION = 1
export const DEFAULT_SETTINGS: Settings = { speed: 1, moveAnimations: true, sound: true, volume: 70 }

const isVolume = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100

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
    const { version, speed, moveAnimations, sound, volume } = parsed as { version?: unknown; speed?: unknown; moveAnimations?: unknown; sound?: unknown; volume?: unknown }
    if (version !== SCHEMA_VERSION) return DEFAULT_SETTINGS
    return {
      speed: SPEEDS.includes(speed as BattleSpeed) ? (speed as BattleSpeed) : DEFAULT_SETTINGS.speed,
      // Ajustes guardados antes de existir la opción: activadas.
      moveAnimations: typeof moveAnimations === 'boolean' ? moveAnimations : DEFAULT_SETTINGS.moveAnimations,
      // Igual con el sonido: los guardados antes de existir se leen con los de por defecto.
      sound: typeof sound === 'boolean' ? sound : DEFAULT_SETTINGS.sound,
      volume: isVolume(volume) ? volume : DEFAULT_SETTINGS.volume,
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
