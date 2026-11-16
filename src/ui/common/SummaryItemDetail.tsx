import type { CSSProperties, ReactNode } from 'react'
import { DetailInspection, DetailTrigger } from './DetailInspection'
import './summaryItemDetail.css'

export function SummaryItemDetail({ id, name, description, children, style, className }: {
  id: string
  name: string
  description?: string
  children: ReactNode
  style: CSSProperties
  className?: string
}) {
  return (
    <DetailInspection key={id} surface="summary">
      <DetailTrigger detail={{ kind: 'item', id, name, description }} className={`summary-item-trigger${className ? ` ${className}` : ''}`}
        style={style} pressOnly>{children}</DetailTrigger>
    </DetailInspection>
  )
}
