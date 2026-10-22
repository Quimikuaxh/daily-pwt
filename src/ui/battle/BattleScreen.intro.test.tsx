import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BattleScreen } from './BattleScreen'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { settle } from '../../test-utils/ui'

// PRD §0 "Redirección visual" · §10.2.1: intro del combate, mensajes uno a uno en la caja de texto y historial aparte.
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-17', data)
const TURN_LINES = ['|move|p1a: Garchomp|Earthquake|p2a: Snorlax', '|-supereffective|p2a: Snorlax', '|move|p2a: Snorlax|Tackle|p1a: Garchomp']

function mount() {
  const client = mockClient()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<BattleScreen client={client as any} data={data} challenge={challenge} playerLead={0} battleSeed="seed-1" onFinish={vi.fn()} onExit={vi.fn()} />)
  return { client, user }
}
const phase = () => screen.getByTestId('field').getAttribute('data-intro')
const message = () => screen.getByRole('status').textContent
const fight = () => screen.getByRole('button', { name: /luchar/i })
async function step(ms: number) { await settle(ms) }
/** Milisegundos (en pasos de 50) hasta que se cumple la condición. */
async function msUntil(condition: () => boolean, limit = 20_000): Promise<number> {
  let elapsed = 0
  while (!condition() && elapsed < limit) { await step(50); elapsed += 50 }
  return elapsed
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('intro del combate (PRD §10.2.1)', () => {
  it('antes de llegar el combate la pantalla está en negro (cargando) y no hay controles activos', () => {
    mount()
    expect(phase()).toBe('loading')
    expect(screen.queryByRole('button', { name: /luchar|cambiar|rendirse|mochila/i })).toBeNull()
  })

  it('recorre las fases en orden: iris, entrada, desafío, lanzamiento rival, lanzamiento propio y fin', async () => {
    const { client } = mount()
    client.emit(mkUpdate())
    const seen: (string | null)[] = []
    for (let elapsed = 0; elapsed < 8000; elapsed += 50) {
      if (seen[seen.length - 1] !== phase()) seen.push(phase())
      await step(50)
    }
    expect(seen).toEqual(['iris', 'enter', 'challenge', 'rivalSend', 'playerSend', 'done'])
  })

  it('dura entre 3 y 5 segundos a velocidad x1', async () => {
    const { client } = mount()
    client.emit(mkUpdate())
    const duration = await msUntil(() => phase() === 'done')
    expect(duration).toBeGreaterThanOrEqual(3000)
    expect(duration).toBeLessThanOrEqual(5000)
  })

  it('a x4 dura la cuarta parte', async () => {
    const { client, user } = mount()
    await user.click(screen.getByRole('button', { name: /velocidad/i }))
    await user.click(screen.getByRole('button', { name: /velocidad/i }))
    client.emit(mkUpdate())
    expect(await msUntil(() => phase() === 'done')).toBeLessThanOrEqual(1500)
  })

  it('cada frase de la intro sale en su fase: desafío, rival saca su Pokémon, yo saco el mío', async () => {
    const { client } = mount()
    client.emit(mkUpdate())
    await msUntil(() => phase() === 'challenge')
    expect(message()).toMatch(new RegExp(`${challenge.trainer.nameEs}.*te desafía`))
    await msUntil(() => phase() === 'rivalSend')
    expect(message()).toMatch(/saca a/)
    await msUntil(() => phase() === 'playerSend')
    expect(message()).toMatch(/Adelante/)
  })

  it('los Pokémon y sus cajas de datos están en el campo desde el principio (se revelan por CSS según la fase)', async () => {
    const { client } = mount()
    client.emit(mkUpdate())
    await step(100)
    expect([screen.queryByTestId('rival-hp'), screen.queryByTestId('player-hp')].every(Boolean)).toBe(true)
  })

  it('un toque en la caja de mensajes salta la intro', async () => {
    const { client, user } = mount()
    client.emit(mkUpdate())
    await step(800)
    await user.click(screen.getByRole('status'))
    await step(100)
    expect(phase()).toBe('done')
  })

  it('una tecla (Enter) salta la intro', async () => {
    const { client, user } = mount()
    client.emit(mkUpdate())
    await step(800)
    await user.keyboard('{Enter}')
    await step(100)
    expect(phase()).toBe('done')
  })

  it('al saltar, las tres frases quedan en el historial una sola vez', async () => {
    const { client, user } = mount()
    client.emit(mkUpdate())
    await step(500)
    await user.keyboard('{Enter}')
    await step(200)
    await user.click(screen.getByRole('button', { name: /registro/i }))
    const text = screen.getByRole('log').textContent ?? ''
    expect([/te desafía/g, /saca a/g, /Adelante/g].map((re) => (text.match(re) ?? []).length)).toEqual([1, 1, 1])
  })

  it('sin saltar, las frases de la intro tampoco se duplican en el historial', async () => {
    const { client, user } = mount()
    client.emit(mkUpdate())
    await step(8000)
    await user.click(screen.getByRole('button', { name: /registro/i }))
    const lines = within(screen.getByRole('log')).getAllByText(/./).map((node) => node.textContent)
    expect(new Set(lines).size).toBe(lines.length)
  })

  it('con prefers-reduced-motion la intro sigue el mismo guion (solo cambia cómo se dibuja)', async () => {
    const { mockMatchMedia } = await import('../../test-utils/ui')
    mockMatchMedia(true)
    const { client } = mount()
    client.emit(mkUpdate())
    expect(await msUntil(() => phase() === 'done')).toBeLessThanOrEqual(5000)
    expect(screen.getByTestId('battle-screen')).toHaveAttribute('data-reduced-motion', 'true')
  })
})

describe('mensajes uno a uno (caja de texto)', () => {
  async function afterIntro(lines: string[]) {
    const m = mount()
    m.client.emit(mkUpdate())
    await step(8000)
    await m.user.click(fight())
    m.client.emit(mkUpdate({ lines }))
    return m
  }

  it('la caja enseña un solo mensaje cada vez, no la lista', async () => {
    await afterIntro(TURN_LINES)
    await step(100)
    const shown = message() ?? ''
    expect(shown).toMatch(/usó/)
    expect(shown).not.toMatch(/muy eficaz/)
  })

  it('avanza sola al siguiente mensaje pasado el tiempo de lectura', async () => {
    await afterIntro(TURN_LINES)
    await step(100)
    const first = message()
    await step(1300)
    expect(message()).not.toBe(first)
    expect(message()).toMatch(/muy eficaz/)
  })

  it('un toque adelanta el mensaje sin esperar', async () => {
    const { user } = await afterIntro(TURN_LINES)
    await step(100)
    await user.click(screen.getByRole('status'))
    await step(10)
    expect(message()).toMatch(/muy eficaz/)
  })

  it('una tecla (Espacio) también lo adelanta', async () => {
    const { user } = await afterIntro(TURN_LINES)
    await step(100)
    await user.keyboard(' ')
    await step(10)
    expect(message()).toMatch(/muy eficaz/)
  })

  it('Enter sobre un botón activa el botón, no avanza el mensaje', async () => {
    const { user } = await afterIntro(TURN_LINES)
    await step(100)
    const first = message()
    screen.getByRole('button', { name: /velocidad/i }).focus()
    await user.keyboard('{Enter}')
    expect(message()).toBe(first)
  })

  it('la caja es una región aria-live educada con el mensaje actual', async () => {
    await afterIntro(TURN_LINES)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('cuando es mi turno la caja pregunta qué hará mi Pokémon', async () => {
    const { client } = mount()
    client.emit(mkUpdate())
    await step(8000)
    expect(message()).toMatch(/¿Qué hará/)
  })

  it('el historial recoge todos los mensajes aunque la caja solo enseñe el último', async () => {
    const { user } = await afterIntro(TURN_LINES)
    await step(6000)
    await user.click(screen.getByRole('button', { name: /registro/i }))
    const log = screen.getByRole('log')
    expect([/usó/, /muy eficaz/].every((re) => re.test(log.textContent ?? ''))).toBe(true)
  })
})

describe('historial (Registro)', () => {
  async function ready() {
    const m = mount()
    m.client.emit(mkUpdate({ lines: TURN_LINES }))
    await step(10_000)
    return m
  }

  it('no hay lista con scroll siempre visible: sin pulsar Registro no existe ningún role=log', async () => {
    await ready()
    expect(screen.queryByRole('log')).toBeNull()
  })

  it('Registro abre un diálogo con el historial (role=log)', async () => {
    const { user } = await ready()
    await user.click(screen.getByRole('button', { name: /registro/i }))
    expect(within(screen.getByRole('dialog')).getByRole('log')).toBeInTheDocument()
  })

  it('Escape lo cierra y devuelve el foco al botón Registro', async () => {
    const { user } = await ready()
    await user.click(screen.getByRole('button', { name: /registro/i }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /registro/i })).toHaveFocus()
  })

  it('el botón Cerrar lo cierra', async () => {
    const { user } = await ready()
    await user.click(screen.getByRole('button', { name: /registro/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cerrar/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('mientras está abierto, la pantalla de combate queda inerte (no se avanza ni se elige por detrás)', async () => {
    const { user } = await ready()
    await user.click(screen.getByRole('button', { name: /registro/i }))
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('pantalla táctil (menú principal, movimientos y Volver)', () => {
  async function turn() {
    const m = mount()
    m.client.emit(mkUpdate())
    await step(8000)
    return m
  }

  it('el menú principal ofrece Luchar, Cambiar y Rendirse', async () => {
    await turn()
    expect(['luchar', 'cambiar', 'rendirse'].map((name) => screen.queryByRole('button', { name: new RegExp(name, 'i') }) !== null)).toEqual([true, true, true])
  })

  // Cambio de requisito (decisión de Jose, 22/10/2026): el hueco de la Mochila abre el equipo rival, solo para consultarlo.
  it('RIVAL abre el equipo del rival: sus 6 Pokémon, PS en porcentaje, solo Datos y Cancelar (sin Cambiar) y se cierra', async () => {
    const { user } = await turn()
    await user.click(screen.getByRole('button', { name: 'Ver el equipo rival' }))
    const team = await screen.findByRole('region', { name: 'Equipo rival' })
    const panels = within(team).getAllByRole('button').filter((button) => button.classList.contains('bt-party-panel'))
    expect(panels).toHaveLength(6)
    expect(panels[0]).toHaveAccessibleName(/%/)
    await user.click(panels[1])
    const options = screen.getByRole('group', { name: /Qué hacer con/ })
    expect(within(options).queryByRole('button', { name: 'Cambiar' })).toBeNull()
    expect(within(options).getByRole('button', { name: 'Datos' })).toBeInTheDocument()
    await user.click(within(options).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Equipo rival' })).toBeNull()
    expect(fight()).toBeEnabled()
  })

  it('Luchar abre los movimientos y Volver regresa al menú principal', async () => {
    const { user } = await turn()
    await user.click(fight())
    expect(screen.getByRole('group', { name: /movimientos/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /volver/i }))
    expect(screen.queryByRole('group', { name: /movimientos/i })).toBeNull()
    expect(fight()).toBeEnabled()
  })

  it('con un turno ya elegido la táctil vuelve al fondo de espera: sin movimientos ni Volver, y al llegar el turno siguiente reaparece el menú principal con el foco en Luchar', async () => {
    const { client, user } = await turn()
    await user.click(fight())
    await user.click(screen.getByRole('button', { name: /terremoto/i }))
    expect(screen.queryByRole('button', { name: /volver/i })).toBeNull()
    expect(screen.queryByRole('group', { name: /movimientos/i })).toBeNull()
    client.emit(mkUpdate({ lines: ['|turn|2'] }))
    await step(3000)
    expect(fight()).toBeEnabled()
    expect(document.activeElement).toBe(fight())
  })

  it('«Turno N» no sale en la caja de mensajes pero sí en el historial', async () => {
    const { client, user } = await turn()
    client.emit(mkUpdate({ lines: ['|turn|2'] }))
    await step(3000)
    expect(message()).not.toMatch(/^Turno/)
    await user.click(screen.getByRole('button', { name: /registro/i }))
    expect(screen.getByRole('log').textContent).toMatch(/Turno 2/)
  })

  it('al llegar un turno nuevo se vuelve al menú principal', async () => {
    const { client, user } = await turn()
    await user.click(fight())
    await user.click(screen.getByRole('button', { name: /terremoto/i }))
    client.emit(mkUpdate({ lines: ['|turn|2'] }))
    await step(3000)
    expect(screen.queryByRole('group', { name: /movimientos/i })).toBeNull()
    expect(fight()).toBeEnabled()
  })

  it('los botones de la pantalla táctil no rebasan nunca el lienzo: cada uno lleva texto accesible', async () => {
    await turn()
    const unnamed = screen.getAllByRole('button').filter((button) => (button.textContent ?? '').trim() === '' && !button.getAttribute('aria-label'))
    expect(unnamed).toEqual([])
  })
})
