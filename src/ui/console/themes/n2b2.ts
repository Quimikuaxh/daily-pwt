/**
 * Negro 2 / Blanco 2, el reto diario, descrito como un tema más (DEC-95). Solo describe su pantalla y su fuente: el combate y los menús
 * del reto siguen con sus componentes (src/ui/battle, useStageScale y pokemon-dp.ttf) y su aspecto no cambia.
 */
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../battle/useStageScale'
import type { ConsoleTheme } from '../theme'

const BASE = import.meta.env.BASE_URL

export const n2b2Theme: ConsoleTheme = {
  id: 'n2b2',
  name: 'Negro 2 / Blanco 2',
  screen: { w: SCREEN_WIDTH, h: SCREEN_HEIGHT },
  screens: 2,
  font: { kind: 'ttf', family: 'Game' },
  frame: null,
  colors: {},
  asset: (name) => `${BASE}ui/battle/${name}.png`,
}
