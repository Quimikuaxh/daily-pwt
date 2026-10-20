import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Sprite } from './Sprite'

// CMP-11 · DEC-18 · RNF-06. TODO-CONTRATO: <Sprite src name width height /> en src/ui/common/Sprite.tsx.
describe('Sprite', () => {
  const setup = () => render(<Sprite src="/sprites/pokemon/front/onix.gif" name="Onix" width={96} height={96} />)

  it('renderiza una imagen con alt = nombre', () => {
    setup()
    expect(screen.getByRole('img', { name: 'Onix' })).toHaveAttribute('src', '/sprites/pokemon/front/onix.gif')
  })

  it('declara width y height (sin saltos de maquetación)', () => {
    setup()
    const img = screen.getByRole('img', { name: 'Onix' })
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['96', '96'])
  })

  it('carga en diferido (loading=lazy)', () => {
    setup()
    expect(screen.getByRole('img', { name: 'Onix' })).toHaveAttribute('loading', 'lazy')
  })

  it('si la imagen falla, la sustituye por una caja con el nombre', () => {
    setup()
    fireEvent.error(screen.getByRole('img', { name: 'Onix' }))
    expect(screen.queryByRole('img', { name: 'Onix' })).toBeNull()
    expect(screen.getByText('Onix')).toBeVisible()
  })

  it('la caja de reserva conserva las mismas dimensiones', () => {
    setup()
    fireEvent.error(screen.getByRole('img', { name: 'Onix' }))
    expect(screen.getByText('Onix')).toHaveStyle({ width: '96px', height: '96px' })
  })

  it('no hay imagen rota visible tras el error', () => {
    const { container } = setup()
    fireEvent.error(screen.getByRole('img', { name: 'Onix' }))
    expect(container.querySelector('img')).toBeNull()
  })

  it('un nombre largo no desborda la caja (se mantiene dentro del texto de la caja)', () => {
    render(<Sprite src="/x.gif" name="Muy largo nombre de Pokémon" width={64} height={64} />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('Muy largo nombre de Pokémon')).toHaveStyle({ width: '64px', height: '64px' })
  })

  it('cambiar el src tras un error vuelve a intentar mostrar la imagen', () => {
    const { rerender } = setup()
    fireEvent.error(screen.getByRole('img', { name: 'Onix' }))
    rerender(<Sprite src="/sprites/pokemon/front/golem.gif" name="Golem" width={96} height={96} />)
    expect(screen.getByRole('img', { name: 'Golem' })).toBeInTheDocument()
  })
})
