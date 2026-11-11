import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleScreen } from './BattleScreen'
import { FieldLights, FIELD_SPOTS, SPOTLIGHT_BEAMS, LIGHTS_FPS, floorAngle, beamAngle } from './FieldLights'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { settle } from '../../test-utils/ui'

// RF-136: luces del estadio, sombras de los Pokémon y cámara de la intro, como en el PWT de N2/B2 (decorativo).
describe('FieldLights', () => {
  it('pinta los focos del suelo y los haces del techo, ocultos a los lectores y sin recibir clics', () => {
    render(<FieldLights />)
    const floor = screen.getByTestId('floor-lights')
    const beams = screen.getByTestId('spotlights')
    expect(floor).toHaveAttribute('aria-hidden', 'true')
    expect(beams).toHaveAttribute('aria-hidden', 'true')
    expect(floor.querySelectorAll('i')).toHaveLength(FIELD_SPOTS.length)
    expect(beams.querySelectorAll('i')).toHaveLength(SPOTLIGHT_BEAMS.length)
  })

  it('el reparto de los focos es fijo: el mismo campo en cada combate y en las capturas', () => {
    expect(FIELD_SPOTS).toHaveLength(40)
    expect(FIELD_SPOTS[0]).toEqual({ angle: 0, radius: 30, color: '#ff9ec8', size: 30 })
    expect(new Set(FIELD_SPOTS.map((s) => s.color)).size).toBe(4)
  })
})

describe('giro de las luces (por JS a LIGHTS_FPS, no con animaciones CSS, que frenaban WebKit)', () => {
  it('el suelo da una vuelta cada 48 s y los haces oscilan entre 28° y 48°', () => {
    expect(floorAngle(0)).toBe(0)
    expect(floorAngle(12_000)).toBeCloseTo(90)
    expect(beamAngle(0, 0)).toBeCloseTo(28)
    expect(beamAngle(8_000, 0)).toBeCloseTo(48)
  })

  it('gira con el tiempo y, con las animaciones desactivadas, se queda quieto', () => {
    vi.useFakeTimers()
    try {
      const { unmount } = render(<FieldLights />)
      const plane = screen.getByTestId('floor-lights').firstElementChild as HTMLElement
      const before = plane.style.transform
      vi.advanceTimersByTime(3000)
      expect(plane.style.transform).not.toBe(before)
      unmount()
      render(<div data-reduced-motion="true"><FieldLights /></div>)
      const still = screen.getByTestId('floor-lights').firstElementChild as HTMLElement
      vi.advanceTimersByTime(3000)
      expect(still.style.transform).toBe('scaleY(0.3) rotate(0.00deg)')
      expect(LIGHTS_FPS).toBeLessThanOrEqual(15)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('campo del combate', () => {
  const data = makeGameData()
  const challenge = getDailyChallenge('2026-10-17', data)

  it('cada Pokémon lleva su sombra (la silueta del mismo sprite), decorativa y dentro de su caja para seguir sus animaciones', async () => {
    vi.useFakeTimers()
    const client = mockClient()
    render(<BattleScreen client={client as any} data={data} challenge={challenge} playerLead={0} battleSeed="seed-1" animations="always" onFinish={vi.fn()} onExit={vi.fn()} />)
    client.emit(mkUpdate())
    await settle(6000)
    for (const side of ['rival', 'player'] as const) {
      const mon = screen.getByTestId('field').querySelector(`.bt-mon-${side}`)!
      const shadow = mon.querySelector('.bt-shadow')!
      expect(shadow).toHaveAttribute('aria-hidden', 'true')
      const sprite = mon.querySelector('img.bt-sprite') as HTMLImageElement
      expect(shadow.querySelector('.bt-sprite')).toBeNull()
      expect(shadow.querySelector('img')!.getAttribute('src')).toBe(sprite.getAttribute('src'))
      expect(shadow.querySelector('img')).toHaveAttribute('alt', '')
    }
    expect(screen.getByTestId('field').querySelector('.bt-camera .bt-bg')).not.toBeNull()
    vi.useRealTimers()
  })
})
