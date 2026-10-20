import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TypeBadge } from './TypeBadge'
import { CategoryIcon } from './CategoryIcon'
import { es } from '../../i18n/es'

// RF-35: iconos de tipo con la base ripeada sin rótulo inglés y el nombre en español pintado encima.
describe('TypeBadge', () => {
  it('pinta el nombre en español dentro del icono y usa la base sin texto', () => {
    const { container } = render(<TypeBadge typeName="Electric" label="Eléctrico" />)
    expect(screen.getByText('Eléctrico')).toBeInTheDocument()
    const chip = container.querySelector<HTMLElement>('.type-chip')
    expect(chip?.style.borderImageSource).toMatch(/types-blank\/electric\.png/)
    expect(chip?.hasAttribute('data-compact')).toBe(false)
  })

  it('en compacto muestra la abreviatura y deja el nombre completo como texto accesible', () => {
    const { container } = render(<TypeBadge typeName="Psychic" label="Psíquico" compact />)
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(es.typeShort.psychic)
    expect(container.querySelector('.sr-only')?.textContent).toBe('Psíquico')
  })

  it('hay abreviatura en español para los 17 tipos de Gen 5 y ninguna pasa de 6 letras', () => {
    expect(Object.keys(es.typeShort)).toHaveLength(17)
    for (const short of Object.values(es.typeShort)) expect(short.length).toBeLessThanOrEqual(6)
  })
})

describe('CategoryIcon', () => {
  it.each([['Physical', 'physical'], ['Special', 'special'], ['Status', 'status']] as const)('%s usa su icono ripeado y es decorativo', (category, file) => {
    const { container } = render(<CategoryIcon category={category} />)
    const image = container.querySelector('img')
    expect(image?.getAttribute('src')).toMatch(new RegExp(`categories/${file}\\.png$`))
    expect(image).toHaveAttribute('alt', '')
  })
})
