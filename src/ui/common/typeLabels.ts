import { es } from '../../i18n/es'

/** Abreviatura del tipo para chips estrechos; si no hay, el nombre completo. */
export const shortTypeLabel = (typeName: string, fullLabel: string): string => (es.typeShort as Record<string, string>)[typeName.toLowerCase()] ?? fullLabel
