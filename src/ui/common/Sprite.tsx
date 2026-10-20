import { useState } from 'react'

type SpriteProps = {
  /** `null` si no hay imagen para este Pokémon: se enseña directamente la caja con el nombre. */
  src: string | null
  name: string
  width: number
  height: number
  className?: string
}

/** Sprite pixelado con tamaño fijo; si la imagen falla, una caja del mismo tamaño con el nombre (DEC-18). */
export function Sprite({ src, name, width, height, className = '' }: SpriteProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src === null || failedSrc === src) {
    return (
      <span className={`sprite-fallback ${className}`} style={{ width, height }}>
        {name}
      </span>
    )
  }

  return (
    <img
      className={`sprite ${className}`}
      src={src}
      alt={name}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  )
}
