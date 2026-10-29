import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { useScrollLock } from './scrollLock'

// UT-116 · con una ventana abierta, la página de detrás no se desplaza (E2E-74 lo comprueba en el navegador).
function Locked() {
  useScrollLock()
  return null
}

describe('useScrollLock (UT-116)', () => {
  it('bloquea mientras quede alguna ventana abierta, también con una sobre otra', () => {
    const root = document.documentElement
    const outer = render(<Locked />)
    expect(root).toHaveClass('scroll-locked')
    const inner = render(<Locked />)
    inner.unmount()
    expect(root).toHaveClass('scroll-locked')
    outer.unmount()
    expect(root).not.toHaveClass('scroll-locked')
  })
})
