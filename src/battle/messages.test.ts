import { describe, it, expect } from 'vitest'
import { createWorkerHandler } from './messages'
import { es } from '../i18n/es'
import { harmlessTeam } from '../test-utils/teams'

// Adaptador del worker: un comando entra, un mensaje sale. Los fallos del motor llegan como mensaje en español.
const init = { battleSeed: 'seed-W', player: harmlessTeam(), rival: harmlessTeam(), ai: 'trivial' as const, maxTurns: 300 }

describe('createWorkerHandler', () => {
  it('init devuelve el primer update con la petición del jugador', () => {
    const handle = createWorkerHandler()
    const message = handle({ type: 'init', init })
    expect(message).toMatchObject({ type: 'update', request: { active: expect.any(Array) } })
  })

  it('choose avanza el combate', () => {
    const handle = createWorkerHandler()
    handle({ type: 'init', init })
    const message = handle({ type: 'choose', choice: { type: 'move', slot: 1 } })
    expect(message).toMatchObject({ type: 'update', view: { turn: 2 } })
  })

  it('forfeit termina el combate como derrota por rendición', () => {
    const handle = createWorkerHandler()
    handle({ type: 'init', init })
    expect(handle({ type: 'forfeit' })).toMatchObject({ type: 'update', request: null, ended: { result: 'loss', reason: 'forfeit' } })
  })

  it('choose antes de init devuelve un error en español, sin lanzar', () => {
    expect(createWorkerHandler()({ type: 'choose', choice: { type: 'move', slot: 1 } })).toEqual({ type: 'error', message: es.errors.engine })
  })

  it('una elección inválida devuelve un error en español, sin exponer la causa interna', () => {
    const handle = createWorkerHandler()
    handle({ type: 'init', init })
    const message = handle({ type: 'choose', choice: { type: 'move', slot: 9 } })
    expect(message).toEqual({ type: 'error', message: es.errors.engine })
  })

  it('tras un error el motor sigue usable', () => {
    const handle = createWorkerHandler()
    handle({ type: 'init', init })
    handle({ type: 'choose', choice: { type: 'move', slot: 9 } })
    expect(handle({ type: 'choose', choice: { type: 'move', slot: 1 } })).toMatchObject({ type: 'update', view: { turn: 2 } })
  })

  it('un init con un equipo imposible devuelve un error en español', () => {
    const handle = createWorkerHandler()
    expect(handle({ type: 'init', init: { ...init, playerLead: 99 } })).toEqual({ type: 'error', message: es.errors.engine })
  })

  it('un nuevo init sustituye a la partida anterior', () => {
    const handle = createWorkerHandler()
    handle({ type: 'init', init })
    handle({ type: 'choose', choice: { type: 'move', slot: 1 } })
    expect(handle({ type: 'init', init })).toMatchObject({ type: 'update', view: { turn: 1 } })
  })
})
