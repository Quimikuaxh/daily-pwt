import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadGameData } from '../../data/gameData'
import { campaignDefinition, mockCampaignCanvas } from '../../test-utils/campaignUi'
import { candidateOf } from './draftModel'
import { DraftScreen } from './DraftScreen'
import { emeraldTheme } from '../console/themes/emerald'

mockCampaignCanvas()
const data = loadGameData()
const candidates = ['bulbasaur', 'charmander', 'squirtle'].map(id => candidateOf(id, 15, campaignDefinition, data))
const mount = () => {
  const onRecruit = vi.fn()
  const result = render(<DraftScreen candidates={candidates} pick={0} picks={4} level={15} rivalName="Petra" onRecruit={onRecruit} scale={2} />)
  return { ...result, onRecruit, user: userEvent.setup() }
}
const ball = (name: string) => screen.getByRole('button', { name: new RegExp(`Candidato \\d: ${name}`) })

describe('Draft', () => {
  it('marca la bola elegida y abre DATOS/RECLUTAR/OTROS al pulsar otra', async () => {
    const { user } = mount()
    expect(ball('BULBASAUR')).toHaveAttribute('aria-pressed', 'true')
    expect(ball('CHARMANDER')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: /Reclutar/ })).not.toBeInTheDocument()
    await user.click(ball('CHARMANDER'))
    expect(ball('CHARMANDER')).toHaveAttribute('aria-pressed', 'true')
    expect(ball('BULBASAUR')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('region', { name: 'Datos de CHARMANDER' })).toHaveTextContent('Elección 1 de 4')
    expect(screen.getByRole('button', { name: 'Datos: ver estadísticas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reclutar a CHARMANDER' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Otros candidatos' })).toBeInTheDocument()
  })

  it('DATOS alterna INFO y ESTADÍSTICAS', async () => {
    const { user, container } = mount()
    const background = () => container.querySelector('.draft-summary > img')
    expect(background()).toHaveAttribute('src', emeraldTheme.asset('datos-info'))
    await user.click(ball('BULBASAUR'))
    await user.click(screen.getByRole('button', { name: 'Datos: ver estadísticas' }))
    expect(background()).toHaveAttribute('src', emeraldTheme.asset('datos-habilidades'))
    await user.click(screen.getByRole('button', { name: 'Datos: ver información' }))
    expect(background()).toHaveAttribute('src', emeraldTheme.asset('datos-info'))
  })

  it.each(['Otros candidatos', 'Escape'])('%s cierra el menú sin reclutar', async (action) => {
    const { user, onRecruit } = mount()
    await user.click(ball('SQUIRTLE'))
    if (action === 'Escape') await user.keyboard('{Escape}')
    else await user.click(screen.getByRole('button', { name: action }))
    expect(screen.queryByRole('button', { name: /Reclutar/ })).not.toBeInTheDocument()
    expect(ball('SQUIRTLE')).toHaveAttribute('aria-pressed', 'true')
    expect(onRecruit).not.toHaveBeenCalled()
  })

  it('las flechas recorren los candidatos circularmente; con el menú abierto no cambian la elección', async () => {
    const { user } = mount()
    ball('BULBASAUR').focus()
    await user.keyboard('{ArrowLeft}')
    expect(ball('SQUIRTLE')).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(ball('CHARMANDER')).toHaveAttribute('aria-pressed', 'true')
    await user.click(ball('CHARMANDER'))
    await user.keyboard('{ArrowRight}')
    expect(ball('CHARMANDER')).toHaveAttribute('aria-pressed', 'true')
  })

  it('RECLUTAR llama una vez con el id del candidato y cierra el menú', async () => {
    const { user, onRecruit } = mount()
    await user.click(ball('SQUIRTLE'))
    await user.click(screen.getByRole('button', { name: 'Reclutar a SQUIRTLE' }))
    expect(onRecruit).toHaveBeenCalledExactlyOnceWith('squirtle')
    expect(screen.queryByRole('button', { name: /Reclutar/ })).not.toBeInTheDocument()
  })
})
