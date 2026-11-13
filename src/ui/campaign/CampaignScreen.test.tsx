import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createCampaign, openDraft } from '../../core/nuzlocke/campaign'
import { loadGameData } from '../../data/gameData'
import { LocalCampaignStore } from '../../storage/campaignStore'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { campaignDefinition, mockCampaignCanvas } from '../../test-utils/campaignUi'
import CampaignScreen from './CampaignScreen'

mockCampaignCanvas()
const data = loadGameData()
const mount = (store = new LocalCampaignStore(new MemoryStorage())) => {
  const onExit = vi.fn()
  render(<CampaignScreen data={data} store={store} newSeed={() => 't3-petra'} onExit={onExit} />)
  return { store, onExit, user: userEvent.setup() }
}
const candidates = () => screen.getAllByRole('button', { name: /^Candidato/ })

describe('Campaña de Hoenn', () => {
  it('sin campaña ofrece empezarla, guarda y permite volver a Hoy', async () => {
    const { store, user, onExit } = mount()
    expect(screen.queryByRole('button', { name: /^Continuar/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Empezar campaña' }))
    // Cambio de requisito (Jose, 13/11/2026): antes de empezar se elige la dificultad (Normal de entrada).
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    expect(store.read()?.state).toEqual({ ...createCampaign('t3-petra'), startedAt: expect.any(Number) })
    // Cambio de requisito (Jose, 12/11/2026): el botón dice lo que viene y una línea marca el paso del tramo.
    expect(screen.getByRole('button', { name: 'Continuar: reclutar (1 de 4) · preparar el gimnasio 1' })).toHaveTextContent('Reclutar (1 de 4)')
    expect(screen.getByRole('list', { name: 'Pasos de este tramo; ahora: Reclutar' })).toHaveTextContent('Reclutar 1/4')
    await user.click(screen.getByRole('button', { name: 'Volver a Hoy' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('empezar otra pide confirmación; cancelar conserva y aceptar reemplaza el estado', async () => {
    const store = new LocalCampaignStore(new MemoryStorage())
    store.write(createCampaign('anterior'), null, 0)
    const { user } = mount(store)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    // Cambio de requisito (Jose, 12/11/2026): con una campaña en curso el botón se llama «Nueva partida».
    await user.click(screen.getByRole('button', { name: 'Nueva partida' }))
    expect(screen.queryByRole('dialog', { name: 'Dificultad de la campaña' })).not.toBeInTheDocument()
    expect(confirm).toHaveBeenCalledWith('Ya tienes una campaña en curso. ¿Empezar otra? Se perderá la actual.')
    expect(store.read()?.state.seed).toBe('anterior')
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Nueva partida' }))
    // Cambio de requisito (Jose, 13/11/2026): antes de empezar se elige la dificultad (Normal de entrada).
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    expect(store.read()?.state).toEqual({ ...createCampaign('t3-petra'), startedAt: expect.any(Number) })
  })

  it('las ocho medallas tienen nombre accesible y estado de obtención', () => {
    const store = new LocalCampaignStore(new MemoryStorage())
    store.write({ ...createCampaign('medallas'), encounterIndex: 1 }, null, 0)
    mount(store)
    expect(screen.getByRole('list', { name: 'Medallas: 1 de 8' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Medalla PIEDRA' })).toBeInTheDocument()
    for (const name of ['PUÑO', 'DINAMO', 'CALOR', 'EQUILIBRIO', 'PLUMA', 'MENTE', 'LLUVIA']) {
      expect(screen.getByRole('img', { name: `Medalla ${name} (sin conseguir)` })).toBeInTheDocument()
    }
  })

  it('avisa si no hay almacenamiento y sigue permitiendo jugar en memoria', async () => {
    const { user, store } = mount(new LocalCampaignStore(null))
    expect(screen.getByRole('status')).toHaveTextContent('Sin almacenamiento disponible: la campaña no se guardará al cerrar la página.')
    await user.click(screen.getByRole('button', { name: 'Empezar campaña' }))
    // Cambio de requisito (Jose, 13/11/2026): antes de empezar se elige la dificultad (Normal de entrada).
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    expect(store.read()?.state.seed).toBe('t3-petra')
  })

  it('Continuar abre la oferta guardada; volver a Ruta y remontar conserva esa oferta', async () => {
    const store = new LocalCampaignStore(new MemoryStorage())
    const saved = openDraft(campaignDefinition, createCampaign('oferta-guardada'))
    store.write(saved, null, 0)
    const { user } = mount(store)
    await user.click(screen.getByRole('button', { name: /^Continuar/ }))
    for (const [index, id] of saved.offer.entries()) {
      expect(candidates()[index]).toHaveAccessibleName(new RegExp((data.names.species[id] ?? id).toUpperCase()))
    }
    expect(store.read()?.state).toEqual(saved)
    await user.click(screen.getByRole('button', { name: 'Volver a la ruta' }))
    expect(screen.queryByRole('button', { name: /^Candidato/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ficha de Petra' })).toBeInTheDocument()
    cleanup()
    mount(store)
    await user.click(screen.getByRole('button', { name: /^Continuar/ }))
    expect(store.read()?.state.offer).toEqual(saved.offer)
    expect(candidates()).toHaveLength(saved.offer.length)
  })

  // Jose, 12/11/2026: desde OTROS se ve lo que ya se tiene, sin cambiar nada, y se vuelve a la misma oferta.
  it('OTROS en el draft enseña el equipo y la caja solo para mirar y CANCELAR vuelve a la oferta', async () => {
    const { user, store } = mount()
    await user.click(screen.getByRole('button', { name: 'Empezar campaña' }))
    // Cambio de requisito (Jose, 13/11/2026): antes de empezar se elige la dificultad (Normal de entrada).
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    await user.click(screen.getByRole('button', { name: /^Continuar/ }))
    await user.click(candidates()[0])
    await user.click(screen.getByRole('button', { name: /^Reclutar a/ }))
    const offer = store.read()!.state.offer
    await user.click(candidates()[0])
    await user.click(screen.getByRole('button', { name: 'Otros: ver tu equipo y la caja' }))
    // Cambio de requisito (Jose, 12/11/2026): texto más corto, el anterior no cabía.
    expect(screen.getByRole('status')).toHaveTextContent('Tu equipo y la caja.')
    expect(screen.queryByRole('button', { name: /^Aceptar/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver al draft' }))
    expect(candidates()).toHaveLength(4)
    expect(store.read()!.state.offer).toEqual(offer)
  })

  // Jose, 12/11/2026: evolucionar antes de la Liga desde el PC (aquí, Kadabra, de intercambio: en la campaña, en el Nv37).
  it('EVOLUCIONAR en el PC pasa por la escena de evolución y guarda la forma nueva', async () => {
    const store = new LocalCampaignStore(new MemoryStorage())
    const base = createCampaign('evolucionar')
    store.write({ ...base, phase: 'prepare', pick: 4, offer: [], members: [{ id: 'k', species: 'kadabra', level: 37, history: [{ species: 'abra', evolvedAt: 16 }], fainted: false, victories: 0 }] }, null, 0)
    const { user } = mount(store)
    await user.click(screen.getByRole('button', { name: /^Continuar: preparar equipo/ }))
    await user.click(screen.getByRole('button', { name: /^Equipo, puesto 1: KADABRA/ }))
    // UT-210 (Jose, 12/11/2026): DATOS en el menú del PC abre la ficha y SALIR vuelve al equipo.
    await user.click(screen.getByRole('menuitem', { name: 'Datos de KADABRA' }))
    expect(screen.getByRole('region', { name: /KADABRA/ })).toHaveTextContent('Datos de KADABRA')
    await user.click(screen.getByRole('button', { name: 'Salir de los datos' }))
    await user.click(screen.getByRole('button', { name: /^Equipo, puesto 1: KADABRA/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Evolucionar a KADABRA' }))
    // Jose, 12/11/2026 (opción A): la evolución, el combate y el resultado no llevan «Volver a la ruta» en la barra.
    expect(screen.queryByRole('button', { name: 'Volver a la ruta' })).not.toBeInTheDocument()
    for (let tap = 0; tap < 3; tap++) await user.click(screen.getByRole('button', { name: /^Continuar: / }))
    expect(store.read()!.state.members[0]).toMatchObject({ species: 'alakazam', history: [{ species: 'abra' }, { species: 'kadabra', evolvedAt: 37 }] })
    expect(screen.getByRole('button', { name: /^Equipo, puesto 1: ALAKAZAM/ })).toBeInTheDocument()
  })

  it('recluta las cuatro elecciones de Petra, guarda cada una y vuelve a Ruta en preparación', async () => {
    const { user, store } = mount()
    await user.click(screen.getByRole('button', { name: 'Empezar campaña' }))
    // Cambio de requisito (Jose, 13/11/2026): antes de empezar se elige la dificultad (Normal de entrada).
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    await user.click(screen.getByRole('button', { name: /^Continuar/ }))
    for (let pick = 0; pick < 4; pick++) {
      const before = store.read()!
      const chosen = before.state.offer[1]
      expect(before.state.pick).toBe(pick)
      expect(before.state.offer).toHaveLength(4)
      await user.click(candidates()[1])
      await user.click(screen.getByRole('button', { name: /^Reclutar a/ }))
      const after = store.read()!
      expect(after.revision).toBeGreaterThan(before.revision)
      expect(after.state.members).toHaveLength(pick + 1)
      expect(after.state.members.at(-1)).toMatchObject({ species: chosen, level: 15 })
      expect(after.state.pick).toBe(pick + 1)
      if (pick < 3) {
        expect(after.state.phase).toBe('draft')
        expect(after.state.offer).toHaveLength(4)
        expect(candidates()).toHaveLength(4)
      }
    }
    expect(store.read()?.state).toMatchObject({ phase: 'prepare', offer: [], pick: 4 })
    expect(screen.queryByRole('button', { name: /^Candidato/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ficha de Petra' })).toHaveTextContent('LÍDER PETRA')
    // Cambio de requisito (D7, Equipo y PC, 11/11/2026): en preparación, Continuar abre Equipo y PC (antes, desactivado).
    expect(screen.getByRole('button', { name: /^Continuar/ })).toBeEnabled()
  })

  // UT-208 (Jose, 12/11/2026): entre rondas de la Liga se abre Equipo y PC con la plantilla fijada (sin la caja) antes del rival.
  it('en la Liga con plantilla, Continuar abre Equipo y PC solo con la plantilla y ACEPTAR lleva a la ficha del rival', async () => {
    const store = new LocalCampaignStore(new MemoryStorage())
    const member = (id: string, species: string) => ({ id, species, level: 50, history: [], fainted: false, victories: 0 })
    store.write({ ...createCampaign('liga'), phase: 'prepare', encounterIndex: 9, pick: 0, offer: [], leagueEvolved: true, leagueRoster: ['a', 'b'],
      members: [member('a', 'grovyle'), member('b', 'machop'), member('c', 'wingull')] }, null, 0)
    const { user } = mount(store)
    await user.click(screen.getByRole('button', { name: /^Continuar/ }))
    expect(screen.getByRole('button', { name: /^Equipo, puesto 1: GROVYLE/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /WINGULL/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Aceptar/ }))
    expect(store.read()!.state.leagueRoster).toEqual(['a', 'b'])
  })

  // UT-212 (Jose, 13/11/2026): la campaña tiene su botón Sonido con el volumen, guardado en los mismos ajustes.
  it('Sonido abre el volumen y lo cambia', async () => {
    const onSoundChange = vi.fn()
    render(<CampaignScreen data={data} store={new LocalCampaignStore(new MemoryStorage())} onExit={() => undefined}
      sound={{ sound: true, volume: 70, pinchMusic: true, lastPokemonMusic: true }} onSoundChange={onSoundChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sonido' }))
    fireEvent.change(screen.getByRole('slider', { name: /Volumen/ }), { target: { value: '40' } })
    expect(onSoundChange).toHaveBeenCalledWith(expect.objectContaining({ volume: 40 }))
  })

  // UT-211 (Jose, 13/11/2026): la dificultad elegida se guarda en la campaña.
  it('Empezar pide la dificultad y la guarda', async () => {
    const { user, store } = mount()
    await user.click(screen.getByRole('button', { name: 'Empezar campaña' }))
    await user.click(screen.getAllByRole('button', { name: 'DIFÍCIL' })[0])
    await user.click(screen.getAllByRole('button', { name: 'FÁCIL' })[1])
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    expect(store.read()?.state.difficulty).toEqual({ ai: 'hard', draft: 'easy' })
  })
})

