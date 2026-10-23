import type { SfxId } from '../../audio/audio'

/** Botones que vuelven o cierran: suenan a «cancelar». */
const CANCEL_BUTTONS = '.bt-back, .bt-party-cancel, .bt-party-back, .bt-sum-close, .bt-sum-back'
/** Pantallas del menú de batalla (la táctil, el equipo y los datos). */
const MENU_SCREENS = '.bt-touch, .bt-party, .bt-summary'

/**
 * Sonido de un toque en el menú de batalla (DEC-57, decisión de Jose): «elegir» en cualquier botón activo de la pantalla táctil, el
 * equipo o los datos, y «cancelar» en los de volver o cerrar. Fuera de esas pantallas, o en un botón desactivado, nada.
 */
export function menuSoundFor(target: EventTarget | null): SfxId | null {
  const button = target instanceof Element ? target.closest('button') : null
  if (!button || button.disabled || !button.closest(MENU_SCREENS)) return null
  return button.matches(CANCEL_BUTTONS) ? 'menu-cancel' : 'menu-select'
}
