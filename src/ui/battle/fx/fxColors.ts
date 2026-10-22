/** Colores de las animaciones por tipo: base, claro (brillos) y oscuro (estelas). Tonos de los tipos de Negro/Blanco. */
export type FxColors = { color: string; light: string; dark: string }

const TYPE_FX_COLORS: Record<string, FxColors> = {
  Normal: { color: '#a8a878', light: '#e8e8c8', dark: '#787850' },
  Fire: { color: '#f08030', light: '#f8d050', dark: '#a84010' },
  Water: { color: '#4890f8', light: '#a8d0f8', dark: '#2850a8' },
  Electric: { color: '#f8d030', light: '#f8f8a8', dark: '#a88810' },
  Grass: { color: '#58c040', light: '#b0f090', dark: '#307828' },
  Ice: { color: '#78d8d8', light: '#e0f8f8', dark: '#3898a8' },
  Fighting: { color: '#c03028', light: '#f08868', dark: '#781810' },
  Poison: { color: '#a040a0', light: '#d888d8', dark: '#682868' },
  Ground: { color: '#d8b858', light: '#f0e0a0', dark: '#907030' },
  Flying: { color: '#a890f0', light: '#d8d0f8', dark: '#6858b0' },
  Psychic: { color: '#f85888', light: '#f8b8d0', dark: '#a83058' },
  Bug: { color: '#a8b820', light: '#d8e878', dark: '#687810' },
  Rock: { color: '#b8a038', light: '#e0d090', dark: '#786820' },
  Ghost: { color: '#705898', light: '#a890d0', dark: '#483860' },
  Dragon: { color: '#7038f8', light: '#b898f8', dark: '#4818b0' },
  Dark: { color: '#705848', light: '#a89888', dark: '#403028' },
  Steel: { color: '#b8b8d0', light: '#f0f0f8', dark: '#787890' },
}

export const fxColorsFor = (type: string): FxColors => TYPE_FX_COLORS[type] ?? TYPE_FX_COLORS.Normal
