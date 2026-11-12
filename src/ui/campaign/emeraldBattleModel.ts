/**
 * Modelo de la pantalla de combate de Esmeralda (D7, maqueta aprobada el 11/11/2026): equipo del jugador desde la petición del motor,
 * geometría de las cajas de PS (battle_interface.c: centros (158,88) del jugador y (44,30) del rival) y de los sprites
 * (battle_anim_mons.c: centros (72,80) y (176,40) con el desplazamiento vertical de cada especie), y mensajes en las dos líneas del juego.
 */
import type { BattleRequest, BattleView, MonView } from '../../battle/protocol'
import emeraldSprites from '../../generated/emerald/sprites.json'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { wrapText } from './draftModel'

const sprites = emeraldSprites as Record<string, { backY: number; frontY: number; dex: number }>
const font = emeraldTheme.font as BitmapFont

export type PartyMember = { species: string; name: string; level: number; hp: number; maxHp: number; fainted: boolean; active: boolean }

/** `"45/120 par"` o `"0 fnt"` → PS actuales y máximos. */
export function parseCondition(condition: string): { hp: number; maxHp: number; fainted: boolean } {
  const [hpPart, status] = condition.split(' ')
  const [hp, max] = hpPart.split('/').map(Number)
  return { hp: hp || 0, maxHp: max || hp || 0, fainted: status === 'fnt' || hp === 0 }
}

/** `"Grovyle, L19, M"` → nivel. */
export const levelOf = (details: string): number => Number(/, L(\d+)/.exec(details)?.[1] ?? 100)

/** Equipo del jugador en el orden del motor, con los nombres en mayúsculas de Esmeralda. */
export function partyFromRequest(request: BattleRequest | null, speciesOf: (index: number) => string, nameOf: (species: string) => string): PartyMember[] {
  return (request?.side.pokemon ?? []).map((pokemon, i) => {
    const species = speciesOf(i)
    return { species, name: nameOf(species).toUpperCase(), level: levelOf(pokemon.details), ...parseCondition(pokemon.condition), active: pokemon.active }
  })
}

/** Esquina superior izquierda de los sprites en la pantalla de arriba. */
/** El rival, 4 px a la izquierda y 4 arriba del centro (176,40) del juego: con este escenario quedaba desplazado sobre su plataforma
    (Jose, 11/11/2026). */
export const frontSpot = (species: string) => ({ x: 140, y: 4 + (sprites[species]?.frontY ?? 0) })
export const backSpot = (species: string) => ({ x: 40, y: 48 + (sprites[species]?.backY ?? 0) })

/** Caja de PS: imagen, textos y barra (SpriteCB_HealthBar: +16 en el jugador y +8 en el rival, en subsprites de 32×8). */
export function healthbox(player: boolean) {
  const x = player ? 158 : 44
  const y = player ? 88 : 30
  const left = x - 32
  const top = y - 16
  return {
    image: player ? 'combate-ps-player' : 'combate-ps-opponent',
    left, top,
    name: { x: left + (player ? 16 : 8), y: top + 3 },
    level: { x: left + (player ? 77 : 69), y: top + 3 },
    bar: { x: x + (player ? 16 : 8) - 16, y },
    // PS 2 px más arriba que en la maqueta (y + 19): pegados al borde inferior de la caja (Jose, 11/11/2026).
    hp: { x: left + 60, y: top + 19 },
    max: { x: left + 80, y: top + 19 },
  }
}

/** Barra de PS por proporción: verde, amarilla por debajo de la mitad y roja por debajo de un quinto. */
export const barImage = (ratio: number): string => ratio <= 0.2 ? 'combate-barra-roja' : ratio <= 0.5 ? 'combate-barra-amarilla' : 'combate-barra'

/** Mensaje en las dos líneas de la caja (208 px desde x 16); si no cabe, en varias pantallas de dos líneas. */
export function messagePages(message: string): string[][] {
  const lines = wrapText(message, 208, (line) => textWidth(font, line))
  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2))
  return pages
}

/** El activo del rival, para su sprite y su caja. */
export const activeOf = (side: { active: number | null; team: MonView[] }): MonView | null => side.active === null ? null : side.team[side.active] ?? null

/** Color de los PP en el menú de movimientos (GetCurrentPPToMaxPPState de battle_message.c). */
export function ppColor(current: number, max: number): 'pp-0' | 'pp-1' | 'pp-2' | 'pp-3' {
  if (max === current) return 'pp-3'
  if (max <= 7) return current > (max <= 2 ? 1 : 2) ? 'pp-3' : (`pp-${2 - current}` as 'pp-1' | 'pp-2')
  if (current === 0) return 'pp-2'
  if (current <= Math.floor(max / 4)) return 'pp-1'
  if (current > Math.floor(max / 2)) return 'pp-3'
  return 'pp-0'
}

/** Píxeles de la barra de PS (B_HEALTHBAR_PIXELS de battle_interface.c). */
const BAR_PIXELS = 48

/**
 * PS que enseña la barra de Gen 3 `frame` fotogramas después de empezar a moverse de `from` a `to` (CalcNewBarValue): con 48 PS
 * máximos o más, 1 PS por fotograma; con menos, 1 píxel por fotograma (máximos/48 PS en Q24.8, redondeando hacia arriba al bajar).
 */
export function barHpAt(from: number, to: number, max: number, frame: number): number {
  if (frame <= 0 || from === to) return from
  const down = to < from
  if (max >= BAR_PIXELS) return down ? Math.max(to, from - frame) : Math.min(to, from + frame)
  const step = Math.floor((max * 256) / BAR_PIXELS)
  const current = from * 256 + (down ? -step : step) * frame
  if (down) {
    const value = Math.floor(current / 256) + (current % 256 > 0 ? 1 : 0)
    return value <= to ? to : value
  }
  const value = Math.floor(current / 256)
  return value >= to ? to : value
}

/** Fotogramas que tarda la barra en ir de `from` a `to`. */
export function barFrames(from: number, to: number, max: number): number {
  let frame = 0
  while (barHpAt(from, to, max, frame) !== to) frame++
  return frame
}

/** PS de un Pokémon en la vista: los reales del jugador; del rival, el porcentaje sobre sus PS máximos (`rivalMaxHp`). */
export function viewHp(mon: MonView, rivalMaxHp: (mon: MonView) => number): { hp: number; maxHp: number } {
  if (mon.maxHp) return { hp: mon.hp ?? 0, maxHp: mon.maxHp }
  const maxHp = rivalMaxHp(mon)
  return { hp: mon.fainted ? 0 : Math.round((mon.hpPercent * maxHp) / 100), maxHp }
}

/** Espera tras un cambio de PS (ms a x1): lo que tarde la barra más lenta en llegar, más 100 ms, como la del PWT. */
export function hpPauseMs(before: BattleView, after: BattleView, rivalMaxHp: (mon: MonView) => number): number {
  let frames = 0
  for (const side of ['player', 'rival'] as const) {
    after[side].team.forEach((mon, i) => {
      const previous = before[side].team[i]
      if (!previous || previous.species !== mon.species) return
      const from = viewHp(previous, rivalMaxHp)
      const to = viewHp(mon, rivalMaxHp)
      if (from.hp !== to.hp) frames = Math.max(frames, barFrames(from.hp, to.hp, to.maxHp))
    })
  }
  return Math.round((frames * 1000) / 60) + 100
}

/**
 * Caída al debilitarse. El rival (SpriteCB_AnimFaintOpponent) baja 8 px cada 2 fotogramas y se borra por abajo, en 8 − frontY/8 pasos;
 * el del jugador (SpriteCB_FaintSlideAnim) baja 5 px por fotograma hasta que su centro pasa de y 160. Pasos, distancia y fotogramas.
 */
export function faintDrop(player: boolean, species: string): { steps: number; distance: number; frames: number } {
  if (player) {
    const center = backSpot(species).y + 32
    const steps = Math.floor((160 - center) / 5) + 1
    return { steps, distance: 5 * steps, frames: steps }
  }
  const steps = 8 - Math.floor((sprites[species]?.frontY ?? 0) / 8)
  return { steps, distance: 8 * steps, frames: 2 * steps }
}

/**
 * Envío y retirada (pokeball.c y battle_anim_throw.c), en fotogramas de 60 Hz. El rival tiene la bola en su sitio 16 fotogramas
 * (SpriteCB_OpponentMonSendOut); la del jugador vuela desde (24,68) (`playerBallPath`). Al abrirse (5 + 5 fotogramas) salen 16 chispas
 * (PokeBallOpenParticleAnimation) y el Pokémon: crece de 0x28 a 0x100 en 12 fotogramas (sAffineAnim_Battler_Emerge) subiendo 16 px
 * (HandleBallAnimEnd), pasa del color de la Poké Ball al suyo en 16 (Task_FadeMon_ToNormal) y su caja de PS entra 115 px a 5 px por
 * fotograma (StartHealthboxSlideIn). La retirada encoge 2/256 por fotograma 18 fotogramas y 16/256 después (sAffineAnim_Battler_Return)
 * mientras toma el color de la bola.
 */
export const SEND_OUT = { rivalWait: 16, throwFrames: 25, ballOpen: 5, emerge: 12, tint: 16, slide: 115, slideSpeed: 5 } as const
/** Color de apertura de la Poké Ball (gBallOpenFadeColors[BALL_POKE] = RGB(31, 22, 30)). */
export const BALL_TINT = 'rgb(255 181 247)'

/** Centro de la bola al abrirse: 24 px por debajo del centro del Pokémon (el del rival, con el mismo ajuste que su sprite). */
export const ballTarget = (player: boolean, species: string) =>
  player ? { x: backSpot(species).x + 32, y: backSpot(species).y + 32 + 24 } : { x: 172, y: 36 + 24 }

const sineQ8 = (index: number) => Math.trunc(Math.sin(((index & 0xff) * Math.PI) / 128) * 256)
const gbaSin = (index: number, amplitude: number) => Math.floor((amplitude * sineQ8(index)) / 256)
const gbaCos = (index: number, amplitude: number) => gbaSin((index & 0xff) + 64, amplitude)
const hiByte = (value: number) => (value >> 8) & 0xff

export type BallStep = { x: number; y: number; angle: number }

/**
 * Vuelo de la bola del jugador (SpriteCB_PlayerMonSendOut_1/_2, InitAnimArcTranslation y AnimTranslateLinear, en enteros de 16 bits como
 * el juego): recta de 25 pasos de (24,68) al destino con medio seno de 30 px hacia arriba; mientras la fase del arco va de 35 a 80, la
 * bola va a un tercio de velocidad, la fase avanza a un tercio y gira 25/256 de vuelta por fotograma (sAffineAnim_BallRotate_4), y solo
 * gasta un paso de cada tres. Una posición y giro (grados) por fotograma, hasta el de abrirse.
 */
export function playerBallPath(species: string): BallStep[] {
  const target = ballTarget(true, species)
  const dx = target.x - 24
  const dy = target.y - 68
  const delta = (d: number) => { const v = Math.floor(((Math.abs(d) << 8) & 0xffff) / SEND_OUT.throwFrames); return d < 0 ? v | 1 : v & ~1 }
  let steps: number = SEND_OUT.throwFrames
  let vx = delta(dx)
  let vy = delta(dy)
  let accX = 0
  let accY = 0
  const phaseSpeed = Math.floor(0x8000 / SEND_OUT.throwFrames)
  let phase = 0
  let spin = 0
  let spinning = false
  let angle = 0
  const path: BallStep[] = []
  const linear = () => {
    if (!steps) return true
    accX = (accX + vx) & 0xffff
    accY = (accY + vy) & 0xffff
    steps--
    return false
  }
  const offset = () => ({ x2: vx & 1 ? -(accX >> 8) : accX >> 8, y2: vy & 1 ? -(accY >> 8) : accY >> 8 })
  for (let frame = 0; frame < 200; frame++) {
    const hi = hiByte(phase)
    if (hi >= 35 && hi < 80) {
      if (!spin) {
        vx = (Math.trunc(vx / 3) & ~1) | (vx & 1)
        vy = (Math.trunc(vy / 3) & ~1) | (vy & 1)
        spinning = true
      }
      const kept = steps
      linear()
      phase = (phase + Math.trunc(phaseSpeed / 3)) & 0xffff
      spin += 1
      steps = spin % 3 !== 0 ? kept : kept - 1
      if (hiByte(phase) >= 80) {
        vx = ((vx * 3) & ~1) | (vx & 1)
        vy = ((vy * 3) & ~1) | (vy & 1)
      }
    } else {
      if (linear()) break
      phase = (phase + phaseSpeed) & 0xffff
    }
    if (spinning) angle -= (25 * 360) / 256
    const { x2, y2 } = offset()
    path.push({ x: 24 + x2, y: 68 + y2 + gbaSin(hiByte(phase), -30), angle })
  }
  return path
}

/** Chispa al abrirse la bola: posición y fotograma de su tira (0, 1, 2 o el 0 volteado). */
export type BallParticle = { x: number; y: number; frame: number }
const PARTICLE_FRAMES = [0, 1, 2, 3, 2, 1]

/**
 * Chispas de la Poké Ball (PokeBallOpenParticleAnimation): una por fotograma durante 16, en 8 direcciones (la novena vuelve a la
 * primera), que se alejan de 5 px por encima de la bola 2 px por fotograma hasta 48. `f`: fotogramas desde que se abre.
 */
export function ballParticles(center: { x: number; y: number }, f: number): BallParticle[] {
  const particles: BallParticle[] = []
  for (let k = 0; k < 16; k++) {
    const age = f - k
    if (age < 0 || age > 24) continue
    const radius = Math.max(0, 2 * (age - 1))
    const angle = (k % 8) * 32
    particles.push({ x: center.x + gbaSin(angle, radius), y: center.y - 5 + gbaCos(angle, radius), frame: PARTICLE_FRAMES[age % 6] })
  }
  return particles
}

export type SendOutState = {
  ball: { x: number; y: number; frame: number; angle: number } | null
  particles: BallParticle[]
  mon: { visible: boolean; scale: number; dy: number; tint: number }
  /** Desplazamiento de la caja de PS mientras entra (`null`: aún no se ve). */
  healthboxDx: number | null
}

/** Fotograma en que se abre la bola: el rival a los 16; el jugador, cuando su bola llega. */
export const releaseFrame = (player: boolean, species: string): number => (player ? playerBallPath(species).length : SEND_OUT.rivalWait)

/** Lo que se ve `frame` fotogramas después de empezar a enviar al Pokémon. */
export function sendOutFrame(player: boolean, species: string, frame: number): SendOutState {
  const path = player ? playerBallPath(species) : null
  const release = path ? path.length : SEND_OUT.rivalWait
  // Se abre donde acaba el vuelo (el juego suma ahí el desplazamiento; puede quedar a unos píxeles del destino por el redondeo).
  const end = path?.at(-1)
  const target = end ? { x: end.x, y: end.y } : ballTarget(player, species)
  const f = frame - release
  let ball: SendOutState['ball'] = null
  if (f < 0) ball = path ? { x: path[frame].x, y: path[frame].y, frame: 0, angle: path[frame].angle } : { ...target, frame: 0, angle: 0 }
  else if (f < 2 * SEND_OUT.ballOpen) ball = { ...target, frame: f < SEND_OUT.ballOpen ? 1 : 2, angle: 0 }
  const emerging = f >= 0 && f < SEND_OUT.emerge
  const slide = f < 0 ? null : Math.max(0, SEND_OUT.slide - SEND_OUT.slideSpeed * (f + 1))
  return {
    ball,
    particles: f < 0 ? [] : ballParticles(target, f),
    mon: {
      visible: f >= 0,
      scale: emerging ? (0x28 + 0x12 * f) / 256 : 1,
      dy: emerging ? Math.floor((0x1000 - 288 * (f + 1)) / 256) : 0,
      tint: f < 0 ? 1 : Math.max(0, 1 - f / SEND_OUT.tint),
    },
    healthboxDx: slide === null ? null : player ? slide : -slide || 0,
  }
}

/** Fotogramas del envío completo (hasta que la caja de PS ha entrado y las chispas se han ido). */
export const sendOutLength = (player: boolean, species: string): number =>
  releaseFrame(player, species) + Math.max(Math.ceil(SEND_OUT.slide / SEND_OUT.slideSpeed), 16 + 25)

/** Retirada: escala y color de la bola `frame` fotogramas después de empezar. */
export function recallFrame(frame: number): { visible: boolean; scale: number; tint: number } {
  const steps = frame + 1
  const scale = (256 - 2 * Math.min(steps, 18) - 16 * Math.max(0, steps - 18)) / 256
  return { visible: scale > 0, scale: Math.max(0, scale), tint: Math.min(1, steps / SEND_OUT.tint) }
}
