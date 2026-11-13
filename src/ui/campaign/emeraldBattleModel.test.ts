import { describe, expect, it, vi } from 'vitest'
import { activeOf, backSpot, barImage, frontSpot, healthbox, levelOf, messagePages, parseCondition, partyFromRequest, ppColor } from './emeraldBattleModel'
import { battleInput, EMERALD_INTRO, sessionBattleClient } from './campaignBattle'
import type { LocalCampaignSession } from '../../battle/campaignSession'
import type { CampaignClientMessage } from '../../battle/client'
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import type { CampaignBattleDefinition } from '../../core/nuzlocke/battle'
import { createCampaign, type CampaignState } from '../../core/nuzlocke/campaign'

// UT-177 · Combate de Esmeralda (D7): modelo de la pantalla y adaptador de la sesión de campaña al presentador del diario.
describe('modelo de la pantalla de combate', () => {
  it('lee PS, KO y nivel del motor', () => {
    expect(parseCondition('45/120 par')).toEqual({ hp: 45, maxHp: 120, fainted: false })
    expect(parseCondition('0 fnt')).toMatchObject({ hp: 0, fainted: true })
    expect(levelOf('Grovyle, L19, M')).toBe(19)
  })

  it('arma el equipo desde la petición, en mayúsculas', () => {
    const request = { side: { name: 'p1', id: 'p1', pokemon: [{ ident: 'p1: Abra', details: 'Abra, L15', condition: '35/35', active: true }, { ident: 'p1: Krabby', details: 'Krabby, L15', condition: '0 fnt', active: false }] } }
    expect(partyFromRequest(request, (i) => ['abra', 'krabby'][i], (id) => id)).toEqual([
      { species: 'abra', name: 'ABRA', level: 15, hp: 35, maxHp: 35, fainted: false, active: true },
      { species: 'krabby', name: 'KRABBY', level: 15, hp: 0, maxHp: 0, fainted: true, active: false },
    ])
  })

  it('coloca sprites y cajas como el juego y elige el color de la barra', () => {
    // Cambio de requisito (Jose, 11/11/2026): el rival, 4 px a la izquierda y arriba del centro del juego.
    expect(frontSpot('geodude')).toEqual({ x: 140, y: 4 + 18 })
    expect(backSpot('abra').x).toBe(40)
    // Cambio de requisito (Jose, 12/11/2026): los PS, 1 px más abajo (a y + 19 pisaban la barra).
    expect(healthbox(true)).toMatchObject({ left: 126, top: 72, bar: { x: 158, y: 88 }, hp: { y: 92 } })
    expect(healthbox(false)).toMatchObject({ left: 12, top: 14, bar: { x: 36, y: 30 } })
    expect([barImage(1), barImage(0.5), barImage(0.2)]).toEqual(['combate-barra', 'combate-barra-amarilla', 'combate-barra-roja'])
    expect(activeOf({ active: null, team: [] })).toBeNull()
  })

  it('colorea los PP como el juego: normal, amarillo hasta la mitad, naranja hasta un cuarto y rojo sin PP', () => {
    expect([ppColor(35, 35), ppColor(20, 35), ppColor(17, 35), ppColor(8, 35), ppColor(0, 35)]).toEqual(['pp-3', 'pp-3', 'pp-0', 'pp-1', 'pp-2'])
    expect([ppColor(5, 5), ppColor(3, 5), ppColor(2, 5), ppColor(1, 5), ppColor(0, 5)]).toEqual(['pp-3', 'pp-3', 'pp-0', 'pp-1', 'pp-2'])
  })

  it('reparte los mensajes largos en pantallas de dos líneas', () => {
    expect(messagePages('¡Hola!')).toEqual([['¡Hola!']])
    const long = messagePages('¡El ataque del Nosepass de Petra ha fallado y además ha hecho muchísimas cosas más que no caben en dos líneas!')
    expect(long.length).toBeGreaterThan(1)
    expect(long.every((page) => page.length <= 2)).toBe(true)
  })
})

describe('adaptador de la sesión de campaña', () => {
  // Cambio de requisito (Jose, 12/11/2026): sin pancarta VS, pero con transición (vs) y el entrenador que entra (iris).
  it('la intro de Esmeralda lleva transición y entrada del entrenador', () => {
    expect(EMERALD_INTRO).toMatchObject({ vs: 1000, iris: 900, enter: 0 })
  })

  it('arranca con start, manda las decisiones a la sesión y traduce sus respuestas a updates del diario', () => {
    let listener: (message: CampaignClientMessage) => void = () => undefined
    const session = { choose: vi.fn(), forfeit: vi.fn(), subscribe: vi.fn((l) => { listener = l; return () => undefined }) } as unknown as LocalCampaignSession
    const start = vi.fn()
    const client = sessionBattleClient(session, start)
    const got: unknown[] = []
    client.subscribe((message) => got.push(message))
    client.init(null as never)
    client.choose({ type: 'move', slot: 2 })
    client.forfeit()
    expect(start).toHaveBeenCalled()
    expect(session.choose).toHaveBeenCalledWith({ type: 'move', slot: 2 })
    expect(session.forfeit).toHaveBeenCalled()
    const update = { lines: ['|turn|1'], view: {} as never, request: null }
    listener({ type: 'campaign-update', requestId: 'x', battleSeed: 's', update })
    listener({ type: 'campaign-error', requestId: null, message: 'mal' })
    listener({ type: 'campaign-finished', requestId: 'x', battleSeed: 's', state: {} as never, ended: {} as never })
    expect(got).toEqual([{ type: 'update', ...update }, { type: 'error', message: 'mal' }])
  })

  it('la entrada lleva la alineación, el primero como inicial y sus movimientos guardados o por defecto', () => {
    const definition = { encounters: catalog.encounters, species: progression.species } as unknown as CampaignBattleDefinition
    const member = (id: string, species: string, moves?: string[]) => ({ id, species, level: 12, history: [], fainted: false, victories: 0, ...(moves ? { moves } : {}) })
    const state = { ...createCampaign('ut177'), phase: 'prepare', members: [member('a', 'treecko', ['pound']), member('b', 'mudkip')] } as unknown as CampaignState
    const input = battleInput(definition, state, ['b', 'a'])
    expect(input.selected).toEqual(['b', 'a'])
    expect(input.preparation.leadId).toBe('b')
    expect(input.preparation.movesByMember.a).toEqual(['pound'])
    expect(input.preparation.movesByMember.b.length).toBeGreaterThan(0)
  })
})

// UT-200 (Jose, 12/11/2026): entrada al combate con transición y el entrenador rival antes de sus Pokémon.
import { openingFrame, TRAINER_SPOT, trainerX, transitionFrame, TRANSITION_FRAMES } from './emeraldBattleModel'
describe('entrada al combate', () => {
  it('dos destellos blancos y franjas negras que cierran hasta tapar la pantalla; al entrar el entrenador se abren', () => {
    expect([0, 6, 12, 18].map((f) => transitionFrame(f).white)).toEqual([true, false, true, false])
    expect(transitionFrame(24).bars).toBe(0)
    expect(transitionFrame(TRANSITION_FRAMES).bars).toBe(1)
    expect(openingFrame(0)?.bars).toBe(1)
    expect(openingFrame(20)).toBeNull()
  })

  it('el entrenador entra por la izquierda, se queda mientras reta y sale por la derecha al enviar', () => {
    expect(trainerX('vs', 10)).toBeNull()
    expect(trainerX('iris', 0)).toBe(-64)
    expect(trainerX('iris', 54)).toBe(TRAINER_SPOT.x)
    expect(trainerX('challenge', 999)).toBe(TRAINER_SPOT.x)
    expect(trainerX('rivalSend', 8)).toBeGreaterThan(TRAINER_SPOT.x)
    expect(trainerX('rivalSend', 16)).toBeNull()
    expect(trainerX('done', 0)).toBeNull()
  })
})

