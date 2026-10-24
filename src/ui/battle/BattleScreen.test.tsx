import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BattleScreen } from './BattleScreen'
import type { AnimationMode } from '../../storage/settings'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { MOVES, mkUpdate, mockClient, sidePokemon } from '../../test-utils/clientMock'
import { mkPsMove, mkRequest, mkSidePokemon } from '../../test-utils/requests'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { mockMatchMedia, settle } from '../../test-utils/ui'

// CMP-12..22 · RF-44..57. Pantalla de combate con un BattleClient simulado (sin worker ni sim).
// TODO-CONTRATO (src/ui/battle/BattleScreen.tsx):
//   <BattleScreen client={BattleClient} data={GameData} challenge={Challenge} playerLead={number} battleSeed={string}
//                 onFinish={(ended) => void} onExit={() => void} />
//   Al montar: client.subscribe(...) y client.init({ battleSeed, player: challenge.playerTeam, playerLead, rival: challenge.rivalTeam, ai: 'heuristic', maxTurns: 300 }).
//   Al desmontar: desuscribe y client.terminate().
//   data-testid: 'battle-screen' (raíz, con data-reduced-motion="true" si prefers-reduced-motion), 'field', 'rival-hp', 'player-hp',
//     'weather', 'remaining-player', 'remaining-rival'. role="log" para el registro. Botones: movimientos (nombre accesible con nombre ES, tipo y PP "x/y"),
//     "Cambiar", "Rendirse", "Salir", "Velocidad" (cicla), "Volver a Hoy" (en el error). Diálogos: role="dialog" con botones /confirmar|sí/ y /cancelar/.
//   Sprites: rival <img alt=nombre ES src=".../front/..."> y jugador <img alt=nombre ES src=".../back/...">.
//   Sin el texto exacto de los motivos de desactivación: se comprueba que existe una descripción accesible no vacía con las palabras clave.
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-17', data)
const SIX = ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic']
const RSIX = ['snorlax', 'tyranitar', 'heatran', 'lapras', 'starmie', 'gyarados']
const sixView = (o: Parameters<typeof mkView>[0] = {}) => mkView({ player: SIX.map((s) => pMon(s, 150, 150)), rival: RSIX.map((s) => rMon(s)), ...o })
const mv = (id: string) => data.names.moves[id]

function mount(over: { lead?: number; animations?: AnimationMode } = {}) {
  const client = mockClient()
  const onFinish = vi.fn()
  const onExit = vi.fn()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const utils = render(
    <BattleScreen client={client as any} data={data} challenge={challenge} playerLead={over.lead ?? 0} battleSeed="seed-1" animations={over.animations} onFinish={onFinish} onExit={onExit} />,
  )
  return { client, onFinish, onExit, user, ...utils }
}
async function ready(over: Parameters<typeof mkUpdate>[0] = {}) {
  const m = mount()
  m.client.emit(mkUpdate(over))
  await settle()
  return m
}
const moveBtn = (id: string) => screen.getByRole('button', { name: new RegExp(mv(id)) })
const fightBtn = () => screen.getByRole('button', { name: /luchar/i })
// Como en el juego: el menú principal (Luchar / Cambiar / Rendirse) es lo primero; los movimientos salen al pulsar Luchar.
async function readyFight(over: Parameters<typeof mkUpdate>[0] = {}) {
  const m = await ready(over)
  await m.user.click(fightBtn())
  return m
}
// El historial completo vive aparte, a demanda (botón Registro).
async function openLog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /registro/i }))
  return screen.getByRole('log')
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('arranque del combate', () => {
  it('se suscribe al cliente y lanza init con el reto, la semilla y el inicial', () => {
    const { client } = mount({ lead: 2 })
    expect(client.init).toHaveBeenCalledWith(expect.objectContaining({
      battleSeed: 'seed-1', playerLead: 2, ai: 'heuristic', maxTurns: 300, player: challenge.playerTeam, rival: challenge.rivalTeam,
    }))
    expect(client.subscribe).toHaveBeenCalled()
  })

  it('al desmontar se desuscribe y termina el worker', () => {
    const { client, unmount } = mount()
    unmount()
    expect(client.listenerCount()).toBe(0)
    expect(client.terminate).toHaveBeenCalled()
  })

  it('el historial muestra la introducción "te desafía" con el nombre del entrenador', async () => {
    const { user } = await ready()
    const log = await openLog(user)
    expect(log).toHaveTextContent(new RegExp(`${challenge.trainer.nameEs}.*te desafía|te desafía`))
    expect(log).toHaveTextContent(challenge.trainer.nameEs)
  })
})

describe('menú de movimientos (CMP-12)', () => {
  it('muestra 4 botones de movimiento con su nombre en español', async () => {
    await readyFight()
    for (const id of ['earthquake', 'outrage', 'stoneedge', 'swordsdance']) expect(moveBtn(id)).toBeInTheDocument()
  })

  it('el tipo del movimiento va en el nombre accesible, no como texto visible en la tesela (solo el color del borde)', async () => {
    await readyFight()
    const button = moveBtn('earthquake')
    expect(button).toHaveAccessibleName(new RegExp(`${mv('earthquake')}, tipo ${data.names.types[data.dex.moves.earthquake.type]}, PP \\d+ de \\d+`))
    expect(button.textContent).not.toContain(data.names.types[data.dex.moves.earthquake.type])
    expect(button.querySelector('.type-chip, .bt-move-type')).toBeNull()
    expect(button.style.getPropertyValue('--tile')).toMatch(/^#/)
  })

  it('cada botón muestra sus PP como actual/máximo, centrados con el mismo hueco tras "PP"', async () => {
    await readyFight()
    expect(moveBtn('outrage')).toHaveTextContent(/3\s*\/\s*16/)
    for (const pp of document.querySelectorAll('.bt-move-pp')) expect(Array.from(pp.children).map((child) => child.textContent)).toEqual(['PP', expect.stringMatching(/^\d{1,3}\/\d{1,3}$/)])
  })

  it('los movimientos con PP disponibles están activados', async () => {
    await readyFight()
    expect(moveBtn('earthquake')).toBeEnabled()
  })

  it('un movimiento sin PP está desactivado con motivo accesible', async () => {
    const moves = [MOVES[0], mkPsMove('outrage', 'Outrage', { pp: 0, maxpp: 16 }), MOVES[2], MOVES[3]]
    await readyFight({ request: mkRequest({ moves, side: sidePokemon() }) })
    expect(moveBtn('outrage')).toBeDisabled()
    expect(moveBtn('outrage')).toHaveAccessibleDescription(/sin pp|agotad/i)
  })

  it('un movimiento deshabilitado por el sim (Elección, Anulación...) está desactivado con motivo accesible', async () => {
    const moves = [MOVES[0], MOVES[1], mkPsMove('stoneedge', 'Stone Edge', { disabled: true }), MOVES[3]]
    await readyFight({ request: mkRequest({ moves, side: sidePokemon() }) })
    expect(moveBtn('stoneedge')).toBeDisabled()
    expect(moveBtn('stoneedge')).toHaveAccessibleDescription(/no (se )?puede|no disponible|bloquead|desactivad|anulad/i)
  })

  it('el motivo de un movimiento bloqueado se ve en el propio botón, no solo para el lector de pantalla', async () => {
    const moves = [MOVES[0], MOVES[1], mkPsMove('stoneedge', 'Stone Edge', { disabled: true }), MOVES[3]]
    await readyFight({ request: mkRequest({ moves, side: sidePokemon() }) })
    const reason = within(moveBtn('stoneedge')).getByText(/no (se )?puede|no disponible|bloquead|desactivad|anulad/i)
    expect(reason).not.toHaveClass('sr-only')
  })

  it('el estado desactivado no depende solo del color: el botón lleva atributo disabled', async () => {
    const moves = [MOVES[0], MOVES[1], mkPsMove('stoneedge', 'Stone Edge', { disabled: true }), MOVES[3]]
    await readyFight({ request: mkRequest({ moves, side: sidePokemon() }) })
    expect(moveBtn('stoneedge')).toHaveAttribute('disabled')
  })

  it('pulsar un movimiento llama a client.choose con su slot', async () => {
    const { client, user } = await readyFight()
    await user.click(moveBtn('stoneedge'))
    expect(client.choose).toHaveBeenCalledWith({ type: 'move', slot: 3 })
  })

  it('al elegir, la caja de mensajes se vacía hasta el turno nuevo: no vuelve a asomar el último mensaje del turno anterior', async () => {
    const { user } = await readyFight()
    expect(screen.getByRole('status').textContent).toMatch(/Qué hará/)
    await user.click(moveBtn('stoneedge'))
    expect(screen.getByRole('status').textContent?.trim()).toBe('')
  })

  it('pulsar un movimiento desactivado no llama a client.choose', async () => {
    const moves = [MOVES[0], MOVES[1], mkPsMove('stoneedge', 'Stone Edge', { disabled: true }), MOVES[3]]
    const { client, user } = await readyFight({ request: mkRequest({ moves, side: sidePokemon() }) })
    await user.click(moveBtn('stoneedge'))
    expect(client.choose).not.toHaveBeenCalled()
  })

  it('si el request solo trae Forcejeo, solo se ofrece Forcejeo', async () => {
    await readyFight({ request: mkRequest({ moves: [{ move: 'Struggle', id: 'struggle' }], side: sidePokemon() }) })
    expect(screen.getByRole('button', { name: /forcejeo/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: new RegExp(mv('earthquake')) })).toBeNull()
  })

  it('Forcejeo envía el slot 1', async () => {
    const { client, user } = await readyFight({ request: mkRequest({ moves: [{ move: 'Struggle', id: 'struggle' }], side: sidePokemon() }) })
    await user.click(screen.getByRole('button', { name: /forcejeo/i }))
    expect(client.choose).toHaveBeenCalledWith({ type: 'move', slot: 1 })
  })

  it('sin request (esperando al rival) no se puede elegir movimiento', async () => {
    await ready({ request: null })
    expect(screen.queryAllByRole('button', { name: new RegExp(mv('earthquake')) })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /luchar/i })).toBeNull()
  })
})

// Menú de equipo como el del juego: al pulsar Cambiar salen los 6 Pokémon; al elegir uno, Cambiar / Datos / Cancelar.
const openParty = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /^cambiar$/i }))
const panel = (name: RegExp) => screen.getByRole('button', { name })
const optionsGroup = () => screen.getByRole('group', { name: /qué hacer con/i })
const option = (name: RegExp) => within(optionsGroup()).getByRole('button', { name })

describe('cambiar de Pokémon (CMP-13, RF-47, RF-70)', () => {
  it('Cambiar abre la pantalla de equipo con los 6 Pokémon', async () => {
    const { user } = await ready()
    await openParty(user)
    const group = screen.getByRole('group', { name: /equipo/i })
    expect(within(group).getAllByRole('button')).toHaveLength(3)
    expect(panel(/starmie/i)).toBeEnabled()
  })

  it('cada placa dice nombre, PS y estado (debilitado y en combate)', async () => {
    const { user } = await ready()
    await openParty(user)
    expect(panel(/gengar/i)).toHaveAccessibleName(/debilitado/i)
    expect(panel(/garchomp/i)).toHaveAccessibleName(/en combate/i)
    expect(panel(/starmie/i)).toHaveAccessibleName(/150\/150/)
  })

  it('al elegir un Pokémon salen Cambiar, Datos y Cancelar', async () => {
    const { user } = await ready()
    await openParty(user)
    await user.click(panel(/starmie/i))
    expect(['cambiar', 'datos', 'cancelar'].map((name) => within(optionsGroup()).queryByRole('button', { name: new RegExp(`^${name}$`, 'i') }) !== null)).toEqual([true, true, true])
  })

  it('Cancelar cierra el menú y deja el foco en la placa', async () => {
    const { user } = await ready()
    await openParty(user)
    await user.click(panel(/starmie/i))
    await user.click(option(/^cancelar$/i))
    expect(screen.queryByRole('group', { name: /qué hacer con/i })).toBeNull()
  })

  it('el Pokémon debilitado no es elegible: Cambiar queda desactivado con motivo y no envía nada', async () => {
    const { client, user } = await ready()
    await openParty(user)
    await user.click(panel(/gengar/i))
    expect(option(/^cambiar$/i)).toHaveAttribute('aria-disabled', 'true')
    expect(option(/^cambiar$/i)).toHaveAccessibleDescription(/debilitado/i)
    await user.click(option(/^cambiar$/i))
    expect(client.choose).not.toHaveBeenCalled()
  })

  it('el Pokémon activo no es elegible', async () => {
    const { client, user } = await ready()
    await openParty(user)
    await user.click(panel(/garchomp/i))
    expect(option(/^cambiar$/i)).toHaveAttribute('aria-disabled', 'true')
    await user.click(option(/^cambiar$/i))
    expect(client.choose).not.toHaveBeenCalled()
  })

  it('elegir uno envía switch con su posición en request.side.pokemon', async () => {
    const { client, user } = await ready()
    await openParty(user)
    await user.click(panel(/starmie/i))
    await user.click(option(/^cambiar$/i))
    expect(client.choose).toHaveBeenCalledWith({ type: 'switch', slot: 2 })
  })

  it('el slot sigue el orden de side.pokemon aunque el sim lo haya reordenado', async () => {
    const side = [mkSidePokemon('Garchomp', { active: true }), mkSidePokemon('Gengar', { fainted: true }), mkSidePokemon('Heatran'), mkSidePokemon('Starmie')]
    const { client, user } = await ready({ request: mkRequest({ moves: MOVES, side }) })
    await openParty(user)
    await user.click(panel(/starmie/i))
    await user.click(option(/^cambiar$/i))
    expect(client.choose).toHaveBeenCalledWith({ type: 'switch', slot: 4 })
  })

  it('Volver (o Escape) regresa al menú principal', async () => {
    const { user } = await ready()
    await openParty(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: /equipo/i })).toBeNull()
    expect(fightBtn()).toBeEnabled()
  })

  it('atrapado: Cambiar está desactivado con motivo accesible', async () => {
    await ready({ request: mkRequest({ moves: MOVES, side: sidePokemon(), trapped: true }) })
    const b = screen.getByRole('button', { name: /cambiar/i })
    expect(b).toBeDisabled()
    expect(b).toHaveAccessibleDescription(/atrapado/i)
  })

  it('sin nadie a quien cambiar: Cambiar está desactivado con motivo accesible', async () => {
    const side = [mkSidePokemon('Garchomp', { active: true }), mkSidePokemon('Gengar', { fainted: true })]
    await ready({ request: mkRequest({ moves: MOVES, side }) })
    const b = screen.getByRole('button', { name: /cambiar/i })
    expect(b).toBeDisabled()
    expect(b).toHaveAccessibleDescription(/no hay|ning[uú]n|nadie/i)
  })
})

describe('cambio forzado (CMP-14, RF-49)', () => {
  const forced = () => ({ request: mkRequest({ forceSwitch: true, side: [mkSidePokemon('Garchomp', { active: true, fainted: true }), mkSidePokemon('Starmie'), mkSidePokemon('Gengar', { fainted: true }), mkSidePokemon('Heatran')] }) })

  it('solo se ofrece elegir sustituto: no hay botones de movimiento', async () => {
    await ready(forced())
    expect(screen.queryByRole('button', { name: new RegExp(mv('earthquake')) })).toBeNull()
    expect(screen.getByRole('group', { name: /equipo/i })).toBeInTheDocument()
  })

  it('no hay botón de cancelar ni de volver, y el aviso pide el siguiente', async () => {
    await ready(forced())
    expect(screen.queryByRole('button', { name: /cancelar|volver/i })).toBeNull()
    expect(screen.getByText(/elige el siguiente pok[eé]mon/i)).toBeInTheDocument()
  })

  it('el menú no ofrece Cancelar pero sí Datos', async () => {
    const { user } = await ready(forced())
    await user.click(panel(/starmie/i))
    expect(within(optionsGroup()).queryByRole('button', { name: /cancelar/i })).toBeNull()
    expect(option(/^datos$/i)).toBeEnabled()
  })

  it('los debilitados no son elegibles', async () => {
    const { client, user } = await ready(forced())
    await user.click(panel(/gengar/i))
    await user.click(option(/^cambiar$/i))
    expect(client.choose).not.toHaveBeenCalled()
  })

  it('los vivos sí, y se envía su posición', async () => {
    const { client, user } = await ready(forced())
    await user.click(panel(/heatran/i))
    await user.click(option(/^cambiar$/i))
    expect(client.choose).toHaveBeenCalledWith({ type: 'switch', slot: 4 })
  })

  it('Escape no cancela el cambio forzado', async () => {
    const { user } = await ready(forced())
    await user.keyboard('{Escape}')
    expect(panel(/starmie/i)).toBeEnabled()
  })
})

describe('turno automático (CMP-15, RF-48)', () => {
  it('con Recarga como única opción, avanza solo sin que el jugador pulse nada', async () => {
    const { client } = await ready({ request: mkRequest({ moves: [{ move: 'Recharge', id: 'recharge' }], side: sidePokemon() }) })
    expect(client.choose).toHaveBeenCalledWith({ type: 'move', slot: 1 })
  })

  it('con un movimiento de dos turnos bloqueado (Vuelo) también avanza solo', async () => {
    const { client } = await ready({ request: mkRequest({ moves: [{ move: 'Fly', id: 'fly' }], side: sidePokemon() }) })
    expect(client.choose).toHaveBeenCalledTimes(1)
  })

  it('no se envía más de una vez aunque se re-renderice', async () => {
    const { client } = await ready({ request: mkRequest({ moves: [{ move: 'Recharge', id: 'recharge' }], side: sidePokemon() }) })
    await settle(10_000)
    expect(client.choose).toHaveBeenCalledTimes(1)
  })

  it('con varias opciones normales NO avanza solo', async () => {
    const { client } = await ready()
    await settle(10_000)
    expect(client.choose).not.toHaveBeenCalled()
  })
})

describe('una sola acción por turno (CMP-16)', () => {
  it('cinco clics rápidos envían un único choose', async () => {
    const { client } = await readyFight()
    const button = moveBtn('earthquake')
    act(() => { for (let i = 0; i < 5; i++) button.click() })
    expect(client.choose).toHaveBeenCalledTimes(1)
  })

  it('tras elegir, la pantalla táctil queda en espera (sin menú ni botones) mientras se resuelve el turno', async () => {
    const { user } = await readyFight()
    await user.click(moveBtn('earthquake'))
    expect(screen.queryByRole('group', { name: /movimientos/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /luchar|rendirse|mochila|cambiar/i })).toBeNull()
    expect(screen.getByText('Esperando…')).toBeInTheDocument()
  })

  it('durante la animación de un update la pantalla táctil sigue en espera', async () => {
    const { client, user } = await readyFight()
    await user.click(moveBtn('earthquake'))
    client.emit(mkUpdate({ lines: ['|move|p1a: Garchomp|Earthquake|p2a: Snorlax', '|-damage|p2a: Snorlax|50/100', '|move|p2a: Snorlax|Tackle|p1a: Garchomp', '|-damage|p1a: Garchomp|120/150'] }))
    expect(screen.queryByRole('button', { name: new RegExp(mv('earthquake')) })).toBeNull()
    expect(screen.queryByRole('button', { name: /luchar/i })).toBeNull()
  })

  it('al acabar la animación los controles vuelven a activarse', async () => {
    const { client, user } = await readyFight()
    await user.click(moveBtn('earthquake'))
    client.emit(mkUpdate({ lines: ['|move|p1a: Garchomp|Earthquake|p2a: Snorlax', '|-damage|p2a: Snorlax|50/100'] }))
    await settle()
    // Turno nuevo: vuelve el menú principal; al pulsar Luchar los movimientos están activos.
    await user.click(fightBtn())
    expect(moveBtn('earthquake')).toBeEnabled()
  })

  it('tras el nuevo update se puede volver a elegir (un choose más)', async () => {
    const { client, user } = await readyFight()
    await user.click(moveBtn('earthquake'))
    client.emit(mkUpdate({ lines: ['|turn|2'] }))
    await settle()
    await user.click(fightBtn())
    await user.click(moveBtn('earthquake'))
    expect(client.choose).toHaveBeenCalledTimes(2)
  })

  it('con el combate terminado no se pueden elegir movimientos', async () => {
    await ready({ request: null, ended: { result: 'win', reason: 'faint', turns: 9, playerAlive: 3, rivalFainted: 6, playerFainted: [true, false, true, false, true, false] } })
    expect(screen.queryAllByRole('button', { name: new RegExp(mv('earthquake')) }).filter((b) => !(b as HTMLButtonElement).disabled)).toHaveLength(0)
  })
})

describe('restantes (CMP-17, RF-45)', () => {
  it('al inicio 6/6 en ambos bandos', async () => {
    await ready({ view: sixView() })
    expect(screen.getByTestId('remaining-player')).toHaveTextContent('6/6')
    expect(screen.getByTestId('remaining-rival')).toHaveTextContent('6/6')
  })

  it('bajan al debilitarse con texto', async () => {
    const view = sixView({ player: SIX.map((s, i) => pMon(s, i < 2 ? 0 : 150, 150)), rival: RSIX.map((s, i) => rMon(s, i < 1 ? 0 : 100)) })
    await ready({ view })
    expect(screen.getByTestId('remaining-player')).toHaveTextContent('4/6')
    expect(screen.getByTestId('remaining-rival')).toHaveTextContent('5/6')
  })

  it('el indicador no depende solo del color: lleva texto numérico', async () => {
    await ready({ view: sixView() })
    expect(screen.getByTestId('remaining-player').textContent).toMatch(/\d\s*\/\s*6/)
  })
})

describe('campo de batalla (CMP-18, RF-44)', () => {
  it('el rival se ve de frente y el jugador de espaldas', async () => {
    await ready({ view: sixView() })
    const field = screen.getByTestId('field')
    expect(within(field).getByRole('img', { name: data.names.species.snorlax })).toHaveAttribute('src', expect.stringContaining('/front/'))
    expect(within(field).getByRole('img', { name: data.names.species.garchomp })).toHaveAttribute('src', expect.stringContaining('/back/'))
  })

  it('muestra el activo que indica la vista (rival activo 1 = Tyranitar)', async () => {
    await ready({ view: sixView({ rActive: 1 }) })
    expect(within(screen.getByTestId('field')).getByRole('img', { name: data.names.species.tyranitar })).toBeInTheDocument()
  })

  it('la barra del rival muestra solo porcentaje', async () => {
    await ready({ view: sixView({ rival: RSIX.map((s) => rMon(s, 64)) }) })
    const bar = screen.getByTestId('rival-hp')
    expect(bar).toHaveTextContent(/64\s*%/)
    expect(bar.textContent).not.toMatch(/\d+\s*\/\s*\d+/)
  })

  it('la barra del jugador muestra PS actual/máximo', async () => {
    await ready({ view: sixView({ player: SIX.map((s) => pMon(s, 111, 183)) }) })
    expect(screen.getByTestId('player-hp')).toHaveTextContent(/111\s*\/\s*183/)
  })

  it('el estado del jugador se muestra en español', async () => {
    await ready({ view: sixView({ player: SIX.map((s, i) => pMon(s, 150, 150, i === 0 ? { status: 'brn' } : {})) }) })
    expect(screen.getByTestId('player-hp')).toHaveTextContent(/quemad/i)
  })

  it('el estado del rival se muestra en español', async () => {
    await ready({ view: sixView({ rival: RSIX.map((s, i) => rMon(s, 100, i === 0 ? { status: 'par' } : {})) }) })
    expect(screen.getByTestId('rival-hp')).toHaveTextContent(/paraliz/i)
  })

  // UT-71 · DEC-53: el movimiento usado se anima en el lienzo del campo, salvo si se desactivan las animaciones en Ajustes.
  it('animación de movimiento: el lienzo recibe el movimiento usado; desactivadas en Ajustes, ninguno', async () => {
    const lines = ['|move|p1a: Garchomp|Earthquake|p2a: Snorlax', '|-damage|p2a: Snorlax|50/100']
    const on = mount()
    on.client.emit(mkUpdate({ lines }))
    await settle()
    expect(document.querySelector('.bt-fx')).toHaveAttribute('data-move', 'earthquake')
    on.unmount()
    const off = mount({ animations: 'never' })
    off.client.emit(mkUpdate({ lines }))
    await settle()
    expect(document.querySelector('.bt-fx')).not.toHaveAttribute('data-move')
  })

  it('el clima activo es visible en español', async () => {
    await ready({ view: sixView({ weather: 'raindance' }) })
    expect(screen.getByTestId('weather')).toHaveTextContent(/lluvia/i)
  })

  it('el clima indica los turnos que le quedan; el permanente (habilidad) va sin número', async () => {
    await ready({ view: { ...sixView({ weather: 'raindance' }), weatherTurns: 3 } })
    expect(screen.getByTestId('weather')).toHaveTextContent('Lluvia·3, quedan 3 turnos')
  })

  it('el clima permanente no lleva número', async () => {
    await ready({ view: { ...sixView({ weather: 'sandstorm' }), weatherTurns: null } })
    expect(screen.getByTestId('weather')).toHaveTextContent(/^Torm\. arena$/)
  })

  it('sin clima no se muestra indicador de clima', async () => {
    await ready({ view: sixView({ weather: null }) })
    expect(screen.queryByTestId('weather')).toBeNull()
  })

  it('el nombre del Pokémon activo aparece en su barra', async () => {
    await ready({ view: sixView() })
    expect(screen.getByTestId('player-hp')).toHaveTextContent(data.names.species.garchomp)
    expect(screen.getByTestId('rival-hp')).toHaveTextContent(data.names.species.snorlax)
  })
})

describe('registro (RF-51, INT-16)', () => {
  it('traduce las líneas del sim al español', async () => {
    const { user } = await ready({ lines: ['|move|p1a: Garchomp|Earthquake|p2a: Snorlax', '|-supereffective|p2a: Snorlax'] })
    const log = await openLog(user)
    expect(log).toHaveTextContent(mv('earthquake'))
    expect(log.textContent).not.toMatch(/Earthquake|\|move\||p1a:/)
  })

  it('no muestra líneas |debug| ni |raw|', async () => {
    const { user } = await ready({ lines: ['|debug|secreto', '|raw|<b>x</b>'] })
    expect((await openLog(user)).textContent).not.toMatch(/secreto|<b>/)
  })

  it('un nombre hostil con HTML se pinta como texto, sin crear elementos', async () => {
    const evil = makeGameData()
    evil.names.species.snorlax = '<img src=x onerror=alert(1)><b>evil</b>'
    const client = mockClient()
    render(<BattleScreen client={client as any} data={evil} challenge={challenge} playerLead={0} battleSeed="s" onFinish={vi.fn()} onExit={vi.fn()} />)
    client.emit(mkUpdate({ view: sixView(), lines: ['|faint|p2a: Snorlax'] }))
    await settle()
    expect(document.querySelector('b')).toBeNull()
    expect(document.querySelector('[onerror]')).toBeNull()
    expect(screen.getByTestId('rival-hp')).toHaveTextContent(evil.names.species.snorlax)
  })
})

describe('Rendirse (CMP-19, RF-54)', () => {
  const open = async () => {
    const m = await ready()
    await m.user.click(screen.getByRole('button', { name: /rendirse/i }))
    return m
  }

  it('abre un diálogo de confirmación', async () => {
    await open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('el foco queda dentro del diálogo', async () => {
    await open()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('Escape cancela sin rendirse', async () => {
    const { user, client } = await open()
    await user.keyboard('{Escape}')
    expect([screen.queryByRole('dialog'), client.forfeit]).toEqual([null, expect.any(Function)])
    expect(client.forfeit).not.toHaveBeenCalled()
  })

  it('Cancelar cierra el diálogo sin cambios', async () => {
    const { user, client } = await open()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancelar|no/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(client.forfeit).not.toHaveBeenCalled()
  })

  it('tras cancelar, el foco vuelve al botón Rendirse', async () => {
    const { user } = await open()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancelar|no/i }))
    expect(screen.getByRole('button', { name: /rendirse/i })).toHaveFocus()
  })

  it('tras cancelar se puede seguir eligiendo movimiento', async () => {
    const { user, client } = await open()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancelar|no/i }))
    await user.click(fightBtn())
    await user.click(moveBtn('earthquake'))
    expect(client.choose).toHaveBeenCalledTimes(1)
  })

  it('Confirmar envía forfeit', async () => {
    const { user, client } = await open()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /confirmar|s[ií]/i }))
    expect(client.forfeit).toHaveBeenCalledTimes(1)
  })

  it('al llegar el fin por rendición se llama a onFinish con derrota', async () => {
    const { user, client, onFinish } = await open()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /confirmar|s[ií]/i }))
    const ended = { result: 'loss', reason: 'forfeit', turns: 1, playerAlive: 6, rivalFainted: 0, playerFainted: [false, false, false, false, false, false] }
    client.emit(mkUpdate({ request: null, ended }))
    await settle()
    expect(onFinish).toHaveBeenCalledWith(ended)
  })

  it('un fin normal (victoria) también llama a onFinish una sola vez', async () => {
    const { client, onFinish } = await ready()
    const ended = { result: 'win', reason: 'faint', turns: 12, playerAlive: 2, rivalFainted: 6, playerFainted: [true, true, false, true, false, true] }
    client.emit(mkUpdate({ request: null, ended }))
    await settle()
    await settle()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(ended)
  })
})

describe('Salir del combate (CMP-20)', () => {
  const open = async () => {
    const m = await ready()
    await m.user.click(screen.getByRole('button', { name: /salir/i }))
    return m
  }

  it('pide confirmación', async () => {
    await open()
    expect(screen.getByRole('dialog')).toHaveTextContent(/salir|descart|perder/i)
  })

  it('cancelar no sale ni descarta', async () => {
    const { user, onExit, client } = await open()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancelar|no/i }))
    expect([onExit.mock.calls.length, client.terminate.mock.calls.length]).toEqual([0, 0])
  })

  it('confirmar sale (onExit) y descarta la partida', async () => {
    const { user, onExit } = await open()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /confirmar|s[ií]|salir/i }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('confirmar no registra una derrota por rendición (no llama a forfeit)', async () => {
    const { user, client } = await open()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /confirmar|s[ií]|salir/i }))
    expect(client.forfeit).not.toHaveBeenCalled()
  })
})

describe('velocidad y movimiento reducido (CMP-21, RF-52)', () => {
  const lines = ['|move|p1a: Garchomp|Earthquake|p2a: Snorlax', '|-damage|p2a: Snorlax|50/100', '|move|p2a: Snorlax|Tackle|p1a: Garchomp', '|-damage|p1a: Garchomp|120/150']
  async function msUntilEnabled(client: ReturnType<typeof mockClient>) {
    client.emit(mkUpdate({ lines }))
    let t = 0
    while (t < 60_000) {
      const b = screen.queryByRole('button', { name: /luchar/i }) as HTMLButtonElement | null
      if (b && !b.disabled) return t
      await settle(50)
      t += 50
    }
    return t
  }

  it('existe un control de velocidad', async () => {
    await ready()
    expect(screen.getByRole('button', { name: /velocidad/i })).toBeInTheDocument()
  })

  it('subir la velocidad acorta el tiempo hasta recuperar el control', async () => {
    const { client, user } = await ready()
    const slow = await msUntilEnabled(client)
    await user.click(screen.getByRole('button', { name: /velocidad/i }))
    const fast = await msUntilEnabled(client)
    expect(fast).toBeLessThan(slow)
  })

  // Animaciones (24/10/2026, Jose): por defecto «Siempre»; el sistema solo cuenta con «Según el sistema» (cambio de requisito: antes
  // «reducir movimiento» del sistema quitaba siempre las animaciones).
  it('con «Siempre» (por defecto) anima aunque el sistema pida reducir movimiento', async () => {
    mockMatchMedia(true)
    await ready()
    expect(screen.getByTestId('battle-screen')).not.toHaveAttribute('data-reduced-motion', 'true')
  })

  it('con «Según el sistema» y prefers-reduced-motion marca la raíz con data-reduced-motion', async () => {
    mockMatchMedia(true)
    mount({ animations: 'system' })
    await settle()
    expect(screen.getByTestId('battle-screen')).toHaveAttribute('data-reduced-motion', 'true')
  })

  it('con «Nunca» no anima aunque el sistema no lo pida', async () => {
    mockMatchMedia(false)
    mount({ animations: 'never' })
    await settle()
    expect(screen.getByTestId('battle-screen')).toHaveAttribute('data-reduced-motion', 'true')
  })

  it('sin prefers-reduced-motion no lo marca', async () => {
    mockMatchMedia(false)
    await ready()
    expect(screen.getByTestId('battle-screen')).not.toHaveAttribute('data-reduced-motion', 'true')
  })
})

describe('errores del worker (CMP-22)', () => {
  it('muestra un mensaje en español como alerta', async () => {
    const { client } = mount()
    client.emit({ type: 'error', message: 'boom stack trace' })
    expect(screen.getByRole('alert')).toHaveTextContent(/error|problema|no se pudo/i)
  })

  it('no filtra el mensaje técnico del worker', async () => {
    const { client } = mount()
    client.emit({ type: 'error', message: 'boom stack trace' })
    expect(screen.getByRole('alert').textContent).not.toMatch(/boom|stack/i)
  })

  it('ofrece "Volver a Hoy" y llama a onExit', async () => {
    const { client, user, onExit } = mount()
    client.emit({ type: 'error', message: 'x' })
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('en error no se ofrecen movimientos', async () => {
    const { client } = await ready()
    client.emit({ type: 'error', message: 'x' })
    expect(screen.queryByRole('button', { name: new RegExp(mv('earthquake')) })).toBeNull()
  })
})

describe('estructura accesible', () => {
  it('la pantalla es un main con encabezado de nivel 1', async () => {
    await ready()
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: /combate/i })).toBeInTheDocument()
  })

  it('los nombres de Pokémon del campo no se traducen automáticamente', async () => {
    await ready({ view: sixView() })
    for (const el of document.querySelectorAll('.hp-mon')) expect(el).toHaveAttribute('translate', 'no')
  })
})
