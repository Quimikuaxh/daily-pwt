import type { DexMove } from '../../core/types'
import { uiAsset } from './uiAssets'

const ICON_BY_CATEGORY: Record<DexMove['category'], string> = { Physical: 'physical', Special: 'special', Status: 'status' }

/** Icono de categoría del juego (física, especial, estado). Decorativo: el nombre de la categoría va siempre como texto al lado. */
export function CategoryIcon({ category }: { category: DexMove['category'] }) {
  return <img className="category-icon" src={uiAsset(`categories/${ICON_BY_CATEGORY[category]}.png`)} alt="" width={28} height={14} />
}
