import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { loadGameData } from '../../data/gameData'
import { UnovaResultScreen } from './UnovaResultScreen'
import { UnovaShareScreen } from './UnovaShareScreen'
import { badgeSlots } from './UnovaTrainerCard'

const audio = vi.hoisted(() => ({
  register: vi.fn(), preload: vi.fn(), playMusic: vi.fn(), stopMusic: vi.fn(), playCry: vi.fn(), playSfx: vi.fn(),
}))
vi.mock('../../audio/audio', async (original) => ({
  ...await original<typeof import('../../audio/audio')>(), getAudio: () => audio,
}))
beforeEach(() => vi.clearAllMocks())

// UT-234 · Resultado, Salón de la Fama y compartir de Teselia (PRD §0, maquetas del 14/11/2026).
const data = loadGameData()
const team = [
  { species: 'eevee', name: 'EEVEE', level: 30, hp: 80, fainted: false },
  { species: 'pikachu', name: 'PIKACHU', level: 29, hp: 0, fainted: true },
  { species: 'snivy', name: 'SNIVY', level: 31, hp: 90, fainted: false },
]
const base = {
  data, player: 'RIZZO', protagonist: 'brendan' as const, badges: 2, badgeNames: ['BÁSICA', 'TOXIN'],
  card: { id: '12345', points: 40, pokedex: 9, minutes: 75 }, team, trainer: 'lider-hiedra', scale: 2,
}

describe('Resultado de Teselia', () => {
  it('medalla: mensaje en la franja del combate, luego la Ficha y vuelve a la Ruta; con la música de Teselia', () => {
    const onDone = vi.fn()
    const { container } = render(<UnovaResultScreen {...base} mode="medal" message="¡RIZZO recibió la MEDALLA TOXIN de HIEDRA!" onDone={onDone} />)
    expect(screen.getByRole('status')).toHaveTextContent('MEDALLA TOXIN')
    // Abajo, las placas del equipo: el caído, en rojo.
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('listitem', { name: /PIKACHU, nivel 29, baja permanente/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Ficha de Entrenador. RIZZO. Nº de ID 12345. Puntos Batalla: 40')
    // En el estuche, solo las medallas conseguidas.
    expect(container.querySelectorAll('img.unova-result-badge')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la ruta desde la Ficha de Entrenador' }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(audio.playMusic).toHaveBeenCalledWith('unova-gym-victory')
    expect(JSON.stringify(audio.playMusic.mock.calls)).not.toContain('emerald-')
  })

  it('derrota: sin rival en el campo y avisa del fin de la campaña', () => {
    const { container } = render(<UnovaResultScreen {...base} mode="whiteout" message="¡RIZZO se ha quedado sin POKéMON que puedan combatir!" onDone={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Fin de la campaña')
    expect(container.querySelector('.unova-result-trainer')).toBeNull()
    expect(audio.playMusic).not.toHaveBeenCalled()
  })

  it('Salón de la Fama: el protagonista con los supervivientes y el equipo campeón abajo', () => {
    const onDone = vi.fn()
    const { container } = render(<UnovaResultScreen {...base} mode="hallOfFame" message="¡Bienvenido al SALÓN DE LA FAMA!" onDone={onDone} />)
    expect(container.querySelectorAll('img.unova-hall-mon')).toHaveLength(2)
    expect(container.querySelector('img.unova-hall-protagonist')?.getAttribute('src')).toContain('trainers/nate-front.png')
    expect(screen.getByRole('status')).toHaveTextContent('Campeones: EEVEE, SNIVY.')
    fireEvent.click(screen.getByRole('button', { name: /^Salón de la Fama/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a la pantalla final' }))
    expect(onDone).toHaveBeenCalledTimes(2)
    expect(audio.playMusic).toHaveBeenCalledWith('unova-hall-of-fame')
  })
})

describe('Compartir de Teselia', () => {
  const card = { id: '12345', pokedex: 9, fainted: 1, minutes: 75, badges: 8 }
  it('al ganar: los campeones en color, las ocho medallas y suenan los créditos', () => {
    const { container } = render(<UnovaShareScreen data={data} won player="NANCI" protagonist="may" rival="IRIS" date="2026-11-14" scale={2}
      team={[{ species: 'eevee', name: 'EEVEE' }, { species: 'snivy', name: 'SNIVY' }]} card={card} />)
    expect(container.querySelectorAll('img.unova-hall-mon')).toHaveLength(2)
    expect(container.querySelectorAll('img.unova-hall-fallen')).toHaveLength(0)
    expect(container.querySelector('img.unova-hall-protagonist')?.getAttribute('src')).toContain('trainers/rosa-front.png')
    expect(container.querySelectorAll('img.unova-result-badge')).toHaveLength(8)
    expect(screen.getByRole('img', { name: /^¡Campeón de la Liga!/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compartir la imagen del resultado' })).toBeInTheDocument()
    expect(audio.playMusic).toHaveBeenCalledWith('unova-credits')
  })

  it('al perder: los del último combate en gris y «Derrota ante …»', () => {
    const { container } = render(<UnovaShareScreen data={data} won={false} player="RIZZO" protagonist="brendan" rival="Lirio" date="2026-11-14" scale={2}
      team={[{ species: 'eevee', name: 'EEVEE' }]} card={{ ...card, badges: 6 }} />)
    expect(container.querySelectorAll('img.unova-hall-fallen')).toHaveLength(1)
    expect(container.querySelectorAll('img.unova-result-badge')).toHaveLength(6)
    expect(screen.getByRole('img', { name: /^Derrota ante LIRIO/ })).toBeInTheDocument()
  })

  it('medallas en ocho huecos iguales de la franja', () => {
    const slots = badgeSlots()
    expect(slots).toHaveLength(8)
    const gaps = slots.slice(1).map((x, i) => x - slots[i])
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1)
  })
})
