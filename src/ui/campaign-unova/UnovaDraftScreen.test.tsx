import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadGameData } from '../../data/gameData'
import { mockCampaignCanvas } from '../../test-utils/campaignUi'
import { candidateOf } from '../campaign/draftModel'
import { unovaKit } from './unovaKit'
import { UnovaDraftScreen } from './UnovaDraftScreen'
import { unovaSummaryMember } from './unovaSummary'

// UT-224 · Draft de Teselia (maqueta aprobada el 14/11/2026): arriba, la pantalla de datos del diario con el candidato señalado; abajo,
// los candidatos con nombre, tipos y suma base, el rival del tramo, RECLUTAR y TU EQUIPO.
mockCampaignCanvas()
const data = loadGameData()
const { definition } = unovaKit
const candidates = ['zebstrika', 'excadrill', 'carracosta'].map((id) => candidateOf(id, 30, definition, data))
const mount = (onShowTeam?: () => void) => {
  const onRecruit = vi.fn()
  const result = render(<UnovaDraftScreen candidates={candidates} pick={1} picks={4} level={30} rivalName="Camila" onRecruit={onRecruit}
    onShowTeam={onShowTeam} data={data} definition={definition} scale={2} />)
  return { ...result, onRecruit, user: userEvent.setup() }
}
const row = (name: string) => screen.getByRole('button', { name: new RegExp(`Candidato \\d: ${name}`) })

describe('Draft de Teselia', () => {
  it('señala el primero, enseña sus datos y al pulsar otro pasa a él', async () => {
    const { user } = mount()
    expect(row('Zebstrika')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: /Zebstrika/ })).toBeInTheDocument()
    await user.click(row('Excadrill'))
    expect(row('Excadrill')).toHaveAttribute('aria-pressed', 'true')
    expect(row('Zebstrika')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('region', { name: /Excadrill/ })).toBeInTheDocument()
  })

  it('cada fila lleva tipos en español y la suma base; abajo, la elección, el rival y su nivel', () => {
    mount()
    expect(row('Excadrill')).toHaveTextContent('TIERRA')
    expect(row('Excadrill')).toHaveTextContent('ACERO')
    expect(row('Excadrill')).toHaveTextContent(String(candidates[1].total))
    expect(screen.getByRole('group', { name: 'ELECCIÓN 2/4' })).toHaveTextContent('2 DE 4')
    expect(screen.getByText('Rival: CAMILA · Nv. máx. 30')).toBeInTheDocument()
  })

  it('RECLUTAR recluta al señalado y TU EQUIPO abre el equipo', async () => {
    const onShowTeam = vi.fn()
    const { user, onRecruit } = mount(onShowTeam)
    await user.click(row('Carracosta'))
    await user.click(screen.getByRole('button', { name: 'Reclutar a Carracosta' }))
    expect(onRecruit).toHaveBeenCalledWith('carracosta')
    await user.click(screen.getByRole('button', { name: 'Ver tu equipo y la caja' }))
    expect(onShowTeam).toHaveBeenCalled()
  })

  it('la ficha usa los datos de la campaña: 20 IV, sin EV, naturaleza neutra, primera habilidad y PS llenos', () => {
    const member = unovaSummaryMember({ species: 'excadrill', level: 30 }, definition, data)!
    const base = data.dex.species.excadrill.baseStats
    expect(member.stats.hp).toBe(Math.floor(((2 * base.hp + 20) * 30) / 100) + 30 + 10)
    expect(member.hp).toBe(member.maxHp)
    expect(member.abilityId).toBe(data.dex.species.excadrill.abilities[0])
    expect(member.natureUp).toBeNull()
    expect(member.moves.length).toBeGreaterThan(0)
  })
})
