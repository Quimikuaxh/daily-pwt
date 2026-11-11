import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { plateFontSize, STAGE_MS, VsBanner } from './VsBanner'
import { AVATARS, PWT_STAGE, VS_EMBLEM, VS_LOGO } from './introAssets'
import { INTRO_DURATIONS_MS } from '../../hooks/useBattle'

const props = {
  playerName: 'Jose_11', playerSprite: AVATARS.rosa.front, playerSide: AVATARS.rosa.side,
  rivalName: 'Misty', rivalSprite: '/sprites/trainers/misty-vs.png', rivalSide: '/sprites/trainers/misty-side.png',
}
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('VsBanner (RF-137)', () => {
  it.each([
    [1, '12px'], [9, '12px'], [10, '10px'], [11, '10px'], [12, '8px'], [20, '8px'],
  ])('plateFontSize: %i letras usan %s', (length, size) => {
    expect(plateFontSize('A'.repeat(length))).toBe(size)
  })

  it.each([
    ['ABCDEFGHI', 'ABCDEFGHIJ', '12px', '10px'],
    ['ABCDEFGHIJK', 'ABCDEFGHIJKL', '10px', '8px'],
    ['ABCDEFGHIJKL', 'ABCDEFGHI', '8px', '12px'],
  ])('aplica --size por separado al jugador %s arriba y al rival %s abajo', (playerName, rivalName, playerSize, rivalSize) => {
    const { container } = render(<VsBanner {...props} playerName={playerName} rivalName={rivalName} />)
    const top = container.querySelector<HTMLElement>('.bt-vs-stage-plate-top')!
    const bottom = container.querySelector<HTMLElement>('.bt-vs-stage-plate-bottom')!
    expect(top).toHaveTextContent(playerName)
    expect(top.style.getPropertyValue('--size')).toBe(playerSize)
    expect(bottom).toHaveTextContent(rivalName)
    expect(bottom.style.getPropertyValue('--size')).toBe(rivalSize)
  })

  it('empieza por el escenario: jugador a la izquierda y rival a la derecha en la pantalla y de pie de lado', () => {
    render(<VsBanner {...props} />)
    const banner = screen.getByRole('img', { name: 'Jose_11 contra Misty' })
    expect(banner.querySelector('.bt-vs-stage-bg')).toHaveAttribute('src', PWT_STAGE)
    expect(banner.querySelector('.bt-vs-stage-portrait-left img')).toHaveAttribute('src', props.playerSprite)
    expect(banner.querySelector('.bt-vs-stage-portrait-right img')).toHaveAttribute('src', props.rivalSprite)
    expect(banner.querySelector('.bt-vs-stage-plate-top')).toHaveTextContent('Jose_11')
    expect(banner.querySelector('.bt-vs-stage-plate-bottom')).toHaveTextContent('Misty')
    expect(banner.querySelector('.bt-vs-stage-trainer-left')).toHaveAttribute('src', props.playerSide)
    expect(banner.querySelector('.bt-vs-stage-trainer-right')).toHaveAttribute('src', props.rivalSide)
    expect(banner.querySelectorAll('.bt-vs-stage-shadow')).toHaveLength(2)
    expect(banner.querySelector('.bt-vs-stage')).toHaveAttribute('aria-hidden', 'true')
    expect(banner.querySelector('.bt-vs-band')).toBeNull()
    expect(banner.querySelector('.bt-vs-emblem')).toBeNull()
    expect(banner.querySelector('.bt-vs-logo')).toBeNull()
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it.each([1, 2, 4])('monta las franjas, el escudo y el logo justo tras STAGE_MS / x%s sin cambiar el nombre accesible', (speed) => {
    render(<VsBanner {...props} speed={speed} />)
    const banner = screen.getByRole('img', { name: 'Jose_11 contra Misty' })
    advance(STAGE_MS / speed - 1)
    expect(banner.querySelector('.bt-vs-band')).toBeNull()
    advance(1)
    expect(screen.getByRole('img', { name: 'Jose_11 contra Misty' })).toBe(banner)
    expect(banner.querySelector('.bt-vs-band-player .bt-vs-trainer')).toHaveAttribute('src', props.playerSprite)
    expect(banner.querySelector('.bt-vs-band-rival .bt-vs-trainer')).toHaveAttribute('src', props.rivalSprite)
    expect(banner.querySelector('.bt-vs-fence .bt-vs-emblem')).toHaveAttribute('src', VS_EMBLEM)
    expect(banner.querySelector('.bt-vs-logo')).toHaveAttribute('src', VS_LOGO)
    expect(banner.querySelector('.bt-vs-name-player')).toHaveTextContent('Jose_11')
    expect(banner.querySelector('.bt-vs-name-rival')).toHaveTextContent('Misty')
    expect(banner.querySelector('.bt-vs-backdrop .bt-vs-stage')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('con reducedMotion va directamente a la pancarta compuesta', () => {
    render(<VsBanner {...props} reducedMotion />)
    const banner = screen.getByRole('img', { name: 'Jose_11 contra Misty' })
    expect(banner.querySelector(':scope > .bt-vs-stage')).toBeNull()
    expect(banner.querySelectorAll('.bt-vs-band')).toHaveLength(2)
    expect(banner.querySelector('.bt-vs-emblem')).toHaveAttribute('src', VS_EMBLEM)
    expect(banner.querySelector('.bt-vs-logo')).toHaveAttribute('src', VS_LOGO)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancela el temporizador al desmontarse (también al saltar la intro)', () => {
    const { unmount } = render(<VsBanner {...props} />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('usa los retratos y sprites de lado de ambos protagonistas; escenario de 1,5 s y fase VS de 3,5 s', () => {
    for (const id of ['nate', 'rosa'] as const) {
      expect(AVATARS[id].front).toMatch(new RegExp(`${id}-vs\\.png$`))
      expect(AVATARS[id].side).toMatch(new RegExp(`${id}-side\\.png$`))
    }
    expect(STAGE_MS).toBe(1500)
    expect(INTRO_DURATIONS_MS.vs).toBe(3500)
  })
})
