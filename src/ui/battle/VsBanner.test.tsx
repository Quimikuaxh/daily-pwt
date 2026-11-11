import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { VsBanner } from './VsBanner'
import { AVATARS, VS_LOGO } from './introAssets'
import { INTRO_DURATIONS_MS } from '../../hooks/useBattle'

// RF-137: pancarta VS del PWT, recreada (no hay gráficos del juego), antes del iris.
describe('VsBanner', () => {
  it('enfrenta al protagonista y al rival con sus sprites de frente y sus nombres, con un nombre accesible', () => {
    render(<VsBanner playerName="Nate" playerSprite={AVATARS.nate.front} rivalName="Misty" rivalSprite="/sprites/trainers/misty-vs.png" />)
    const banner = screen.getByRole('img', { name: 'Nate contra Misty' })
    const sprites = [...banner.querySelectorAll('img.bt-vs-trainer')].map((img) => img.getAttribute('src'))
    expect(sprites).toEqual([AVATARS.nate.front, '/sprites/trainers/misty-vs.png'])
    expect(banner).toHaveTextContent('Nate')
    expect(banner).toHaveTextContent('Misty')
    expect(banner.querySelector('img.bt-vs-logo')).toHaveAttribute('src', VS_LOGO)
  })

  it('muestra el nickname literal también en el nombre accesible (UT-180)', () => {
    render(<VsBanner playerName="Jose_11" playerSprite={AVATARS.rosa.front} rivalName="Misty" rivalSprite="/sprites/trainers/misty-vs.png" />)
    const banner = screen.getByRole('img', { name: 'Jose_11 contra Misty' })
    expect(within(banner).getByText('Jose_11')).toBeInTheDocument()
    expect(banner.querySelector('img.bt-vs-trainer')).toHaveAttribute('src', AVATARS.rosa.front)
  })

  it('cada protagonista tiene su sprite de frente y la fase dura 2 s a x1', () => {
    expect(AVATARS.nate.front).toMatch(/nate-vs\.png$/)
    expect(AVATARS.rosa.front).toMatch(/rosa-vs\.png$/)
    expect(INTRO_DURATIONS_MS.vs).toBe(2000)
  })

})
