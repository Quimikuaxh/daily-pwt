import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayScreen } from './TodayScreen'
import { getDailyChallenge } from '../../core/challenge'
import { calcStats } from '../../core/stats'
import { fewTypesData, makeGameData } from '../../test-utils/fixtures'
import { dateForTrainer, setLocalTime } from '../../test-utils/ui'
import type { ResolvedSet } from '../../test-utils/types'

// CMP-01, 03..10 · RF-30, RF-32..39. Pantalla Hoy con datos sintéticos (3 entrenadores) y relojes falsos.
// TODO-CONTRATO (src/ui/today/TodayScreen.tsx):
//   <TodayScreen data={GameData} onStart={(challenge, leadIndex) => void} />   (el panel de emparejamientos, RF-37, se eliminó: PRD §0)
//   El día sale de new Date() (reloj del sistema).
//   Estructura accesible: <header>, regiones con nombre (/rival/i, /tu equipo/i), cada tarjeta del jugador es un
//   role="article"; <footer> (contentinfo) con el aviso fan.
//   Botones: "Combatir", "Sacar primero" (aria-pressed), toggle con aria-expanded: /Ver movimientos y objetos del rival/.
const data = makeGameData()
const NOW = '2026-10-19'
const challengeOf = (date = NOW) => getDailyChallenge(date, data)
const name = (kind: 'species' | 'moves' | 'abilities' | 'items' | 'types', id: string) => (data.names as any)[kind][id] as string

function renderToday(over: { date?: string; data?: any; onStart?: any; h?: number; mi?: number; s?: number } = {}) {
  setLocalTime(over.date ?? NOW, over.h ?? 12, over.mi ?? 0, over.s ?? 0)
  const onStart = over.onStart ?? vi.fn()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const utils = render(<TodayScreen data={over.data ?? data} onStart={onStart} />)
  return { ...utils, onStart, user }
}
const rivalRegion = () => screen.getByRole('region', { name: /rival/i })
const playerRegion = () => screen.getByRole('region', { name: /tu equipo/i })

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('cabecera (CMP-01)', () => {
  it('muestra el número del reto con #', () => {
    renderToday()
    expect(screen.getByRole('banner')).toHaveTextContent('#1')
  })

  it('el número crece con la fecha (#3 dos días después del lanzamiento)', () => {
    renderToday({ date: '2026-10-21' })
    expect(screen.getByRole('banner')).toHaveTextContent('#3')
  })

  it('muestra la cuenta atrás hh:mm:ss con ceros', () => {
    renderToday({ h: 20, mi: 15, s: 30 })
    expect(screen.getByRole('banner')).toHaveTextContent('03:44:30')
  })

  it('rellena con ceros las horas (00:00:05)', () => {
    renderToday({ h: 23, mi: 59, s: 55 })
    expect(screen.getByRole('banner')).toHaveTextContent('00:00:05')
  })

  it('la cuenta atrás baja cada segundo', async () => {
    renderToday({ h: 20, mi: 15, s: 30 })
    await vi.advanceTimersByTimeAsync(2000)
    expect(screen.getByRole('banner')).toHaveTextContent('03:44:28')
  })

  it.each([/estad[ií]sticas/i, /ayuda/i, /ajustes/i])('no hay icono ni botón %s', (re) => {
    renderToday()
    expect(screen.queryByRole('button', { name: re })).toBeNull()
  })

  it('la cabecera incluye el logo con el nombre del juego', () => {
    renderToday()
    expect(screen.getByRole('banner')).toHaveTextContent(/daily pwt/i)
  })
})

describe('tarjeta del rival (CMP-03, RF-32)', () => {
  it('muestra sprite, nombre, categoría y región, y ya no el torneo de origen (Líder de Kanto con especialidad)', () => {
    const date = dateForTrainer('alpha', data)
    renderToday({ date })
    const c = challengeOf(date)
    const region = rivalRegion()
    expect(within(region).getByRole('img', { name: c.trainer.nameEs })).toBeInTheDocument()
    expect(region).toHaveTextContent(c.trainer.nameEs)
    expect(region).toHaveTextContent(/L[ií]der/)
    expect(region).toHaveTextContent(/Kanto/i)
    expect(region).not.toHaveTextContent(c.variant.sourceTournament)
    expect(region).not.toHaveTextContent(/torneo de origen/i)
  })

  it('muestra el tipo de especialidad si existe', () => {
    const date = dateForTrainer('alpha', data)
    renderToday({ date })
    expect(rivalRegion()).toHaveTextContent(name('types', 'Rock'))
  })

  it('no muestra especialidad si el entrenador no la tiene (campeón)', () => {
    const date = dateForTrainer('gamma', data)
    renderToday({ date })
    expect(rivalRegion()).not.toHaveTextContent(/especialidad/i)
  })

  it('un campeón sin región no muestra región', () => {
    const date = dateForTrainer('gamma', data)
    renderToday({ date })
    expect(rivalRegion()).toHaveTextContent(/Campe[oó]n/)
    expect(rivalRegion()).not.toHaveTextContent(/Kanto|Johto|Hoenn|Sinnoh|Teselia/i)
  })
})

describe('equipo rival y toggle (CMP-04, RF-33/34)', () => {
  const toggle = () => screen.getByRole('button', { name: /(ver|ocultar) movimientos y objetos del rival/i })

  it('muestra las 6 especies del rival', () => {
    renderToday()
    const c = challengeOf()
    for (const p of c.rivalTeam) expect(rivalRegion()).toHaveTextContent(p.nameEs)
  })

  it('por defecto el toggle está cerrado (aria-expanded=false)', () => {
    renderToday()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })

  it('cerrado: no hay movimientos, objetos ni habilidades del rival en el DOM', () => {
    renderToday()
    const c = challengeOf()
    const text = rivalRegion().textContent ?? ''
    const hidden = c.rivalTeam.flatMap((p) => [...p.moves.map((m) => name('moves', m)), name('items', p.item), name('abilities', p.ability)])
    expect(hidden.filter((h) => text.includes(h))).toEqual([])
  })

  it('abierto: aria-expanded=true', async () => {
    const { user } = renderToday()
    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('abierto: muestra los 4 movimientos de cada Pokémon rival', async () => {
    const { user } = renderToday()
    await user.click(toggle())
    const text = rivalRegion().textContent ?? ''
    const missing = challengeOf().rivalTeam.flatMap((p) => p.moves.map((m) => name('moves', m))).filter((m) => !text.includes(m))
    expect(missing).toEqual([])
  })

  it('abierto: muestra objeto y habilidad elegida del rival', async () => {
    const { user } = renderToday()
    await user.click(toggle())
    const text = rivalRegion().textContent ?? ''
    const missing = challengeOf().rivalTeam.flatMap((p) => [name('items', p.item), name('abilities', p.ability)]).filter((m) => !text.includes(m))
    expect(missing).toEqual([])
  })

  it('al volver a cerrar, desaparecen los detalles', async () => {
    const { user } = renderToday()
    await user.click(toggle())
    await user.click(toggle())
    const first = challengeOf().rivalTeam[0]
    expect(rivalRegion()).not.toHaveTextContent(name('items', first.item))
  })

  it('el texto cambia a «Ocultar…» al desplegar y vuelve a «Ver…» al ocultar, con aria-expanded coherente', async () => {
    const { user } = renderToday()
    expect(toggle()).toHaveTextContent('Ver movimientos y objetos del rival')
    await user.click(toggle())
    expect([toggle().textContent, toggle().getAttribute('aria-expanded')]).toEqual(['Ocultar movimientos y objetos del rival', 'true'])
    await user.click(toggle())
    expect([toggle().textContent, toggle().getAttribute('aria-expanded')]).toEqual(['Ver movimientos y objetos del rival', 'false'])
  })

  describe('al ocultar, la página sube al panel del rival', () => {
    const scrollIntoView = vi.fn()
    const mockReducedMotion = (reduced: boolean) =>
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} }))
    beforeEach(() => { scrollIntoView.mockClear(); Element.prototype.scrollIntoView = scrollIntoView })
    afterEach(() => vi.unstubAllGlobals())

    it('desplegar no hace scroll; ocultar sube con scroll suave al inicio de la sección del rival', async () => {
      mockReducedMotion(false)
      const { user } = renderToday()
      await user.click(toggle())
      expect(scrollIntoView).not.toHaveBeenCalled()
      await user.click(toggle())
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
      expect(scrollIntoView.mock.contexts[0]).toBe(rivalRegion())
    })

    it('con prefers-reduced-motion sube sin animación', async () => {
      mockReducedMotion(true)
      const { user } = renderToday()
      await user.click(toggle())
      await user.click(toggle())
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    })
  })
})

describe('tarjetas del jugador (CMP-05, RF-35)', () => {
  const cards = () => within(playerRegion()).getAllByRole('article')

  it('hay 6 tarjetas', () => {
    renderToday()
    expect(cards()).toHaveLength(6)
  })

  it.each([0, 1, 2, 3, 4, 5])('la tarjeta %i muestra sprite, nombre, objeto y habilidad', (i) => {
    renderToday()
    const p = challengeOf().playerTeam[i]
    const card = cards()[i]
    expect(within(card).getByRole('img', { name: p.nameEs })).toBeInTheDocument()
    expect(card).toHaveTextContent(name('items', p.item))
    expect(card).toHaveTextContent(name('abilities', p.ability))
  })

  it('cada tarjeta muestra sus tipos en texto', () => {
    renderToday()
    const c = challengeOf()
    c.playerTeam.forEach((p, i) => {
      for (const t of data.dex.species[p.species].types) expect(cards()[i]).toHaveTextContent(name('types', t))
    })
  })

  it('cada tarjeta muestra el total de stats base', () => {
    renderToday()
    challengeOf().playerTeam.forEach((p, i) => {
      const total = Object.values(data.dex.species[p.species].baseStats).reduce((a, b) => a + b, 0)
      expect(cards()[i]).toHaveTextContent(String(total))
    })
  })

  it('cada tarjeta muestra los 6 stats reales a Nv. 50 (iguales a calcStats)', () => {
    renderToday()
    challengeOf().playerTeam.forEach((p: ResolvedSet, i) => {
      const s = calcStats(data.dex.species[p.species].baseStats, p.ivs, p.evs, p.nature, 50)
      for (const v of Object.values(s)) expect(cards()[i]).toHaveTextContent(new RegExp(`\\b${v}\\b`))
    })
  })

  it('cada movimiento muestra su nombre, tipo y categoría en texto', () => {
    renderToday()
    challengeOf().playerTeam.forEach((p, i) => {
      for (const m of p.moves) {
        expect(cards()[i]).toHaveTextContent(name('moves', m))
        expect(cards()[i]).toHaveTextContent(name('types', data.dex.moves[m].type))
      }
      expect(cards()[i]).toHaveTextContent(/F[ií]sico|Especial|Estado/)
    })
  })

  it('muestra la potencia de los movimientos de daño', () => {
    renderToday()
    challengeOf().playerTeam.forEach((p, i) => {
      for (const m of p.moves) {
        const bp = data.dex.moves[m].basePower
        if (bp > 0) expect(cards()[i]).toHaveTextContent(new RegExp(`\\b${bp}\\b`))
      }
    })
  })

  it('usa "—" para potencia/precisión que no aplican (movimientos de estado)', () => {
    renderToday()
    const withStatus = challengeOf().playerTeam
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.moves.some((m) => data.dex.moves[m].category === 'Status'))
    expect(withStatus.length).toBeGreaterThan(0)
    for (const { i } of withStatus) expect(cards()[i]).toHaveTextContent('—')
  })
})

describe('Sacar primero (CMP-06, RF-36)', () => {
  const leadButtons = () => screen.getAllByRole('button', { name: /primero/i })

  it('hay un botón por tarjeta (6)', () => {
    renderToday()
    expect(leadButtons()).toHaveLength(6)
  })

  it('al principio ninguno está seleccionado', () => {
    renderToday()
    expect(leadButtons().filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(0)
  })

  it('pulsar uno lo deja seleccionado (aria-pressed=true)', async () => {
    const { user } = renderToday()
    await user.click(leadButtons()[2])
    expect(leadButtons()[2]).toHaveAttribute('aria-pressed', 'true')
  })

  it('solo hay un inicial a la vez: elegir otro deselecciona el anterior', async () => {
    const { user } = renderToday()
    await user.click(leadButtons()[2])
    await user.click(leadButtons()[4])
    expect(leadButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false', 'true', 'false'])
  })

  it('pulsar sobre el ya elegido no lo deselecciona', async () => {
    const { user } = renderToday()
    await user.click(leadButtons()[1])
    await user.click(leadButtons()[1])
    expect(leadButtons()[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('el inicial seleccionado es visible en texto, no solo por aria', async () => {
    const { user } = renderToday()
    await user.click(leadButtons()[3])
    const card = within(playerRegion()).getAllByRole('article')[3]
    expect(card).toHaveTextContent(/inicial|primero|saldr[aá]/i)
  })
})

describe('botón Combatir (CMP-07, RF-38)', () => {
  const fight = () => screen.getByRole('button', { name: /combatir/i })

  it('está desactivado sin inicial', () => {
    renderToday()
    expect(fight()).toBeDisabled()
  })

  it('muestra el motivo visible cuando está desactivado', () => {
    renderToday()
    expect(screen.getByText(/elige.*(inicial|primero)|selecciona.*(inicial|primero)/i)).toBeVisible()
  })

  it('el motivo está asociado al botón (descripción accesible)', () => {
    renderToday()
    expect(fight()).toHaveAccessibleDescription(/elige|selecciona/i)
  })

  it('se activa al elegir inicial', async () => {
    const { user } = renderToday()
    await user.click(screen.getAllByRole('button', { name: /primero/i })[0])
    expect(fight()).toBeEnabled()
  })

  it('al pulsar llama a onStart con el reto y el índice del inicial', async () => {
    const { user, onStart } = renderToday()
    await user.click(screen.getAllByRole('button', { name: /primero/i })[4])
    await user.click(fight())
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ number: 1, date: NOW }), 4)
  })

  it('desactivado, un clic no llama a onStart', async () => {
    const { user, onStart } = renderToday()
    await user.click(fight())
    expect(onStart).not.toHaveBeenCalled()
  })

  it('es el único botón de combate: no hay "Práctica" ni "Oficial"', () => {
    renderToday()
    expect(screen.queryByRole('button', { name: /pr[aá]ctica|oficial/i })).toBeNull()
    expect(screen.getAllByRole('button', { name: /combatir/i })).toHaveLength(1)
  })
})

describe('pie y errores (CMP-09, CMP-10)', () => {
  it('el pie contiene el aviso de proyecto fan no oficial con las cuatro entidades', () => {
    renderToday()
    const footer = screen.getByRole('contentinfo')
    for (const t of ['Nintendo', 'Creatures', 'GAME FREAK', 'The Pokémon Company']) expect(footer).toHaveTextContent(t)
    expect(footer).toHaveTextContent(/fan|no oficial/i)
  })

  it('datos sin entrenadores: muestra un error en español en un role=alert', () => {
    renderToday({ data: { ...data, trainers: undefined } })
    expect(screen.getByRole('alert')).toHaveTextContent(/datos/i)
  })

  it('el error no muestra trazas, ids internos ni inglés técnico', () => {
    renderToday({ data: { ...data, trainers: undefined } })
    expect(screen.getByRole('alert').textContent).not.toMatch(/TypeError|undefined|at \w+ \(|Cannot read|DataError|stack/i)
  })

  it('con datos corruptos no hay pantalla en blanco: sigue el pie y hay algo visible', () => {
    const { container } = renderToday({ data: { ...data, dex: null } })
    expect(container.textContent!.trim().length).toBeGreaterThan(20)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('un pool sin solución para el equipo del jugador también da error en español', () => {
    renderToday({ data: fewTypesData() })
    expect(screen.getByRole('alert')).toHaveTextContent(/datos|equipo/i)
  })

  it('en error no se ofrece Combatir', () => {
    renderToday({ data: { ...data, trainers: undefined } })
    expect(screen.queryByRole('button', { name: /combatir/i })).toBeNull()
  })

  it('el error no usa console.error de React por excepción no capturada', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderToday({ data: { ...data, trainers: undefined } })
    const uncaught = spy.mock.calls.filter((c) => /The above error occurred|Uncaught/.test(String(c[0])))
    spy.mockRestore()
    expect(uncaught).toEqual([])
  })
})

describe('navegación por teclado y traducción', () => {
  it('el primer enlace salta al contenido principal', () => {
    renderToday()
    const link = screen.getByRole('link', { name: /saltar al contenido/i })
    expect(link).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('el nombre del rival no se traduce automáticamente', () => {
    renderToday()
    expect(within(rivalRegion()).getByText(challengeOf().trainer.nameEs)).toHaveAttribute('translate', 'no')
  })
})
