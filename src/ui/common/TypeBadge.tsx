import type { CSSProperties } from 'react'
import { shortTypeLabel } from './typeLabels'
import { uiAsset } from './uiAssets'

type TypeBadgeProps = {
  typeName: string
  /** Nombre del tipo en español. */
  label: string
  /** Con poco espacio (menú de movimientos del combate) se pinta la abreviatura; el nombre completo va como texto accesible. */
  compact?: boolean
}

/**
 * Tipo con la base de color ripeada del juego (sin su rótulo inglés) y el nombre en español pintado encima con la fuente del juego.
 * El texto va en el propio chip, así el tipo no depende solo del color.
 */
export function TypeBadge({ typeName, label, compact = false }: TypeBadgeProps) {
  // Inline: una url() dentro de una variable CSS se resolvería respecto a la hoja de estilos, no al documento (BASE_URL es relativo).
  const style: CSSProperties = { borderImageSource: `url(${uiAsset(`types-blank/${typeName.toLowerCase()}.png`)})` }
  return (
    <span className="type-chip" data-compact={compact ? 'true' : undefined} style={style}>
      {compact ? (
        <>
          <span aria-hidden="true">{shortTypeLabel(typeName, label)}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        label
      )}
    </span>
  )
}
