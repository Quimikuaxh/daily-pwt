import { createContext, lazy, Suspense, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { BattleDetail } from '../battle/side/BattleDetailCard'

// Tanto las descripciones como el controlador se cargan al consultar el primer dato.
const DetailPopover = lazy(() => import('./DetailPopover'))

export type DetailSurface = 'today' | 'summary'

type Action = 'hover' | 'focus' | 'toggle' | 'leave'
export type DetailIntent = { anchor: HTMLButtonElement; detail: BattleDetail; action: Action }
const InspectionContext = createContext<((intent: DetailIntent) => void) | null>(null)

export function DetailInspection({ children, surface = 'today' }: { children: ReactNode; surface?: DetailSurface }) {
  const [intent, setIntent] = useState(null as DetailIntent | null)
  const anchor = intent?.anchor

  useEffect(() => {
    if (!anchor) return
    const outside = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element) || anchor.contains(target) || target.closest('.detail-popover')) return
      setIntent(null)
    }
    const escape = (event: Event) => {
      if (!(event instanceof KeyboardEvent) || event.key !== 'Escape') return
      // Datos captura Escape para salir. Cuando la ficha está abierta, Escape cierra primero la ficha.
      if (surface === 'summary') {
        event.preventDefault()
        event.stopPropagation()
      }
      setIntent(null)
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('click', outside, true)
    const keyboardTarget = surface === 'summary' ? window : document
    keyboardTarget.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('click', outside, true)
      keyboardTarget.removeEventListener('keydown', escape, true)
    }
  }, [anchor, surface])

  const inspect = (next: DetailIntent) => {
    setIntent((current) => surface === 'summary' && current?.anchor === next.anchor ? null : next)
  }

  return (
    <InspectionContext.Provider value={surface === 'today' ? setIntent : inspect}>
      {children}
      {intent && (
        <Suspense fallback={null}>
          <DetailPopover intent={intent} surface={surface} />
        </Suspense>
      )}
    </InspectionContext.Provider>
  )
}

type TriggerProps = { detail: BattleDetail; children: ReactNode; className?: string; style?: CSSProperties; pressOnly?: boolean }

export function DetailTrigger({ detail, children, className, style, pressOnly = false }: TriggerProps) {
  const inspect = useContext(InspectionContext)
  const inspectAt = (anchor: HTMLButtonElement, action: Action) => inspect?.({ anchor, action, detail })

  return (
    <button type="button" className={pressOnly ? className : `today-detail-trigger${className ? ` ${className}` : ''}`} style={style}
      onPointerEnter={(event) => { if (!pressOnly && event.pointerType === 'mouse') inspectAt(event.currentTarget, 'hover') }}
      onPointerLeave={(event) => { if (!pressOnly && event.pointerType === 'mouse') inspectAt(event.currentTarget, 'leave') }}
      onFocus={(event) => {
        if (!pressOnly && event.currentTarget.matches(':focus-visible')) inspectAt(event.currentTarget, 'focus')
      }}
      onBlur={(event) => { if (!pressOnly) inspectAt(event.currentTarget, 'leave') }}
      onClick={(event) => inspectAt(event.currentTarget, 'toggle')}
    >{children}</button>
  )
}
