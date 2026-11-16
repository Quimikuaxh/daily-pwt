import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BattleDetailCard, type BattleDetail } from '../battle/side/BattleDetailCard'
import type { DetailIntent, DetailSurface } from './DetailInspection'
import './detailPopover.css'

type Inspection = { anchor: HTMLButtonElement; detail: BattleDetail; pinned: boolean }

function inspect(current: Inspection | null, intent: DetailIntent): Inspection | null {
  const sameAnchor = current?.anchor === intent.anchor
  if (intent.action === 'leave') return current
  if (intent.action === 'toggle') return sameAnchor && current.pinned ? null : { ...intent, pinned: true }
  if (current?.pinned && (intent.action === 'hover' || sameAnchor)) return current
  return { ...intent, pinned: false }
}

export default function DetailPopover({ intent, surface }: { intent: DetailIntent; surface: DetailSurface }) {
  const id = useId()
  const [observed, setObserved] = useState(intent)
  const [inspection, setInspection] = useState(() => inspect(null, intent))
  const tooltip = useRef(null as HTMLDivElement | null)
  const delay = useRef(undefined as number | undefined)
  const anchor = inspection?.anchor

  if (observed !== intent) {
    setObserved(intent)
    setInspection(inspect(inspection, intent))
  }

  const cancelLeave = () => window.clearTimeout(delay.current)
  const leave = useCallback((target: HTMLButtonElement) => {
    window.clearTimeout(delay.current)
    // Mantiene abierta la ficha cuando el puntero cruza el hueco hasta ella.
    delay.current = window.setTimeout(() => {
      setInspection((current) => {
        if (current?.anchor !== target || current.pinned || target.matches(':hover, :focus-visible') || tooltip.current?.matches(':hover')) return current
        return null
      })
    }, 130)
  }, [])

  useEffect(() => {
    if (intent.action === 'leave') leave(intent.anchor)
    return () => window.clearTimeout(delay.current)
  }, [intent, leave])

  useLayoutEffect(() => {
    const box = tooltip.current
    if (!anchor || !box) return
    anchor.setAttribute('aria-describedby', id)
    anchor.setAttribute('data-inspected', 'true')
    const summary = surface === 'summary' ? anchor.closest('.bt-summary, .console-screen') : null
    const header = surface === 'today' ? document.querySelector('.today-header') : null
    const bar = surface === 'today' ? document.querySelector('.fight-bar') : null
    const position = () => {
      const target = anchor.getBoundingClientRect()
      const width = box.offsetWidth
      const height = box.offsetHeight
      const bounds = summary?.getBoundingClientRect()
      const top = Math.max(12, bounds ? bounds.top + 4 : (header?.getBoundingClientRect().bottom ?? 0) + 8)
      const bottom = Math.min(window.innerHeight, bounds?.bottom ?? bar?.getBoundingClientRect().top ?? window.innerHeight) - 12
      const visible = anchor.isConnected && height !== 0 && height <= bottom - top && top <= target.bottom && target.top <= bottom
      box.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) return
      const below = target.bottom + 8
      const y = below + height <= bottom ? below : target.top - height - 8
      const x = bounds ? target.right - width : target.left
      box.style.left = `${Math.max(12, Math.min(x, document.documentElement.clientWidth - width - 12))}px`
      box.style.top = `${Math.max(top, Math.min(y, bottom - height))}px`
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position)
    observer?.observe(box)
    if (bar) observer?.observe(bar)
    if (summary) observer?.observe(summary)
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      anchor.removeAttribute('aria-describedby')
      anchor.removeAttribute('data-inspected')
      observer?.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [anchor, id, surface])

  if (!inspection) return null
  return createPortal(
    <div ref={tooltip} className={surface === 'today' ? 'detail-popover today-detail' : 'detail-popover'} data-surface={surface} role="tooltip" id={id}
      onPointerEnter={cancelLeave} onPointerLeave={() => leave(inspection.anchor)}>
      <BattleDetailCard detail={inspection.detail} announce={false} />
    </div>,
    document.body,
  )
}
