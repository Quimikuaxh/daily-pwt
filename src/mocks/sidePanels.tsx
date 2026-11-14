/**
 * Maqueta de los paneles laterales de la campaña en escritorio (`maquetas.html?v=paneles`), con estética de Esmeralda: «Tu campaña» como la
 * Ficha de Entrenador (franjas verdes, borde azul, medallas en sus huecos) y «Tu equipo» como la pantalla de equipo (fondo oliva y placas).
 * Debajo, dos opciones de botón. Datos de ejemplo escritos aquí: no es interfaz de la app.
 */
import type { CSSProperties, ReactNode } from 'react'
import { ConsoleStage } from '../ui/console/ConsoleStage'
import { GameText } from '../ui/console/GameText'
import { GameWindow } from '../ui/console/GameWindow'
import { emeraldSprite, emeraldTheme } from '../ui/console/themes/emerald'
import { PartySlot } from '../ui/campaign/PartySlot'
import { TeamPanel } from '../ui/campaign/CampaignSide'
import { HpBar, StatusBadge } from '../ui/campaign/EmeraldBattle'
import { healthbox } from '../ui/campaign/emeraldBattleModel'

const PANEL = { w: 184, h: 296 }
const panelTheme = { ...emeraldTheme, screen: PANEL, screens: 1 }
const stripes = (a: string, b: string): CSSProperties => ({ background: `repeating-linear-gradient(${a} 0 2px, ${b} 2px 4px)` })

function Card() {
  const rows = [['PUNTOS BATALLA', '140 PB'], ['TIEMPO', '0:12'], ['BAJAS', '0'], ['ESPECIES', '4'], ['CAJA', '0'], ['SIGUIENTE', 'PETRA · Nv15']]
  return (
    <div style={{ inset: 0, ...stripes('#6ab4d5', '#297ba4') }}>
      <div style={{ left: 4, top: 4, width: 176, height: 288, borderRadius: 6, overflow: 'hidden', boxShadow: '0 0 0 1px #626273', ...stripes('#ffffff', '#e6ffde') }}>
        <div style={{ left: 0, top: 0, width: 176, height: 26, ...stripes('#94ee83', '#83de73') }} />
        <div style={{ left: 10, top: 6, width: 96, height: 14, background: '#6abdff', boxShadow: '0 0 0 1px #418bc5' }} />
        <GameText text="TU CAMPAÑA" x={16} y={6} color="datos" />
        {rows.map(([label, value], i) => (
          <span key={label}>
            <div style={{ left: 6, top: 38 + i * 26, width: 3, height: 8, background: '#94ee83' }} />
            <GameText text={label} x={14} y={34 + i * 26} face="small" color="ventana" />
            <GameText text={value} x={14} y={44 + i * 26} width={156} align="right" color="datos" />
            <div style={{ left: 14, top: 58 + i * 26, width: 156, height: 1, background: '#a4a4a4' }} />
          </span>
        ))}
        <div style={{ left: 0, top: 192, width: 176, height: 92, ...stripes('#94ee83', '#83de73') }} />
        <GameText text="MEDALLAS" x={10} y={196} face="small" color="blanco" />
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>
            <div style={{ left: 12 + (i % 4) * 40, top: 212 + Math.floor(i / 4) * 34, width: 30, height: 28, boxShadow: 'inset 0 0 0 1px #ffffff' }} />
            <img src={emeraldTheme.asset(`medalla-${i + 1}`)} alt="" style={{ left: 19 + (i % 4) * 40, top: 218 + Math.floor(i / 4) * 34, filter: i < 1 ? 'none' : 'brightness(0) opacity(.18)' }} />
          </span>
        ))}
      </div>
    </div>
  )
}

const team = [
  { species: 'treecko', name: 'TREECKO', level: 15, hp: 40, maxHp: 40, moves: ['DESTRUCTOR', 'MALICIOSO', 'ABSORBER', 'AT. RÁPIDO'], item: 'oranberry' },
  { species: 'wingull', name: 'WINGULL', level: 15, hp: 22, maxHp: 38, moves: ['GRUÑIDO', 'PISTOLA AGUA', 'AGUDEZA', 'ATAQUE ALA'], item: null },
  { species: 'makuhita', name: 'MAKUHITA', level: 15, hp: 6, maxHp: 52, moves: ['PLACAJE', 'FOCO ENERGÍA', 'ARENA', 'SORPASSO'], item: 'machobrace' },
  { species: 'ralts', name: 'RALTS', level: 15, hp: 30, maxHp: 30, moves: ['GRUÑIDO', 'CONFUSIÓN', 'DOBLE EQUIPO', 'TELETRANSP.'], item: null },
]

function Team() {
  return (
    <div style={{ inset: 0, ...stripes('#cdd57b', '#b4b45a'), boxShadow: 'inset 0 0 0 4px #8b9c29' }}>
      <GameWindow x={1} y={1} width={10} height={2}><GameText text="TU EQUIPO" y={1} /></GameWindow>
      <GameText text="4 DE 6" x={96} y={14} width={80} align="right" face="small" color="equipo" />
      {Array.from({ length: 6 }, (_, i) => {
        const mon = team[i] ?? null
        const top = 40 + i * 42
        return (
          <span key={i}>
            <div style={{ left: 6, top, width: 144, height: 24 }}>
              <PartySlot i={1} mon={mon} state={i === 0 ? 'activa' : 'normal'} />
            </div>
            {mon && <div style={{ left: 152, top: top - 2, width: 28, height: 28, borderRadius: 4, background: '#ffffff', boxShadow: 'inset 0 0 0 1px #4a4a62' }} />}
            {mon?.item && <img src={emeraldTheme.asset(`objeto-${mon.item}`)} alt="" style={{ left: 154, top }} />}
          </span>
        )
      })}
    </div>
  )
}

/** A · Ventana del juego con marco y ▶ en la acción principal (menú de pausa). B · Píldora morada del menú de equipo (CANCELAR). */
function Buttons({ kind }: { kind: 'a' | 'b' }) {
  const items: [string, number, number, boolean][] = [['PREPARAR EQUIPO', 0, 112, true], ['TIENDA', 112, 48, false], ['NUEVA PARTIDA', 160, 80, false]]
  return (
    <div style={{ inset: 0 }}>
      {items.map(([label, x, w, main]) => kind === 'a'
        ? (
            <GameWindow key={label} x={x / 8 + 1} y={1} width={w / 8 - 2} height={2}>
              {main && <GameText text="▶" y={1} />}
              <GameText text={label} x={main ? 8 : 0} y={1} width={w - 16 - (main ? 8 : 0)} align={main ? 'left' : 'center'} fit />
            </GameWindow>
          )
        : (
            <span key={label}>
              <div className="mock-pill" style={{ left: x, top: 8, width: w, height: 16, filter: main ? 'hue-rotate(110deg) saturate(1.6)' : 'none', clipPath: 'inset(0 round 7px)' }} />
              <GameText text={label} x={x} y={9} width={w} align="center" color="blanco" fit />
            </span>
          ))}
    </div>
  )
}

type Skin = 'datos' | 'domo' | 'ventanas'
const SKINS: Record<Skin, { bg: CSSProperties; band: string; box: string; line: string; head: string; title: string }> = {
  // Datos del Pokémon (summary_screen): banda morada, cajas claras con rótulo dorado y marco violeta.
  datos: { bg: { background: '#735ad5' }, band: '#bd6ad5', box: '#f6ffee', line: '#d5bd39', head: 'blanco', title: 'datos-rotulo' },
  // Ficha del Domo Batalla (battle_dome.c): borde verde azulado, fondo claro y franjas verdes.
  domo: { bg: { background: '#20738b' }, band: '#6aa48b', box: '#deeede', line: '#83c58b', head: 'blanco', title: 'domo' },
  // Ventanas estándar con marco sobre el fondo oliva del equipo.
  ventanas: { bg: stripes('#cdd57b', '#b4b45a'), band: 'transparent', box: 'transparent', line: '#a4a4a4', head: 'equipo', title: 'equipo' },
}
const STATS = [['PS', '40'], ['ATAQUE', '24'], ['DEFENSA', '19'], ['AT. ESP.', '29'], ['DEF. ESP.', '24'], ['VELOC.', '31']]
const MOVES: [string, string, string][] = [['DESTRUCTOR', 'normal', '35/35'], ['MALICIOSO', 'normal', '30/30'], ['ABSORBER', 'grass', '24/25'], ['AT. RÁPIDO', 'normal', '30/30']]
const BENCH = [['wingull', 0.6], ['makuhita', 0.12], ['ralts', 1], ['geodude', 0]] as const

function Box({ skin, x, y, w, h, label, children }: { skin: Skin; x: number; y: number; w: number; h: number; label: string; children: ReactNode }) {
  const k = SKINS[skin]
  if (skin === 'ventanas') return <GameWindow x={x / 8} y={y / 8} width={w / 8} height={h / 8}><GameText text={label} y={-1} face="small" color="ventana" />{children}</GameWindow>
  return (
    <div style={{ left: x - 4, top: y - 4, width: w + 8, height: h + 8, background: k.box, borderRadius: 4, boxShadow: `inset 0 0 0 1px ${skin === 'datos' ? '#bda462' : '#20738b'}` }}>
      <div style={{ left: 0, top: 0, width: w + 8, height: 11, background: k.line, borderRadius: '4px 4px 0 0' }} />
      <GameText text={label} x={4} y={0} face="small" color={k.title} />
      <div style={{ left: 4, top: 4, width: w, height: h }}>{children}</div>
    </div>
  )
}

function BattleSide({ skin }: { skin: Skin }) {
  const k = SKINS[skin]
  const pad = skin === 'ventanas' ? 0 : 8
  return (
    <div style={{ inset: 0, ...k.bg }}>
      <div style={{ left: 0, top: 0, width: 184, height: 20, background: k.band }} />
      <GameText text="TU EQUIPO" x={8} y={3} color={k.head} />
      {Array.from({ length: 6 }, (_, i) => <img key={i} src={emeraldTheme.asset(i < 5 ? 'bola-0' : 'bola-1')} alt="" style={{ left: 120 + i * 9, top: 6 }} />)}
      <Box skin={skin} x={8} y={32} w={168} h={40} label="EN COMBATE">
        <img className="mon-icon mon-icon-anim" src={emeraldSprite('icon', 'treecko')} alt="" style={{ left: -4, top: 6 - pad / 2 }} />
        <GameText text="TREECKO" x={28} y={8} color="datos" />
        <GameText text="Nv15" x={130} y={8} width={38} align="right" color="datos" />
        <img src={emeraldTheme.asset('tipo-grass')} alt="" style={{ left: 28, top: 24 }} />
        <i className="party-hp-bar" style={{ left: 66, top: 30, width: 60, height: 3, background: 'linear-gradient(#5ad583 0 1px, #73ffac 1px)' }} />
        <GameText text="40/40" x={128} y={24} width={40} align="right" face="small" color="datos" />
      </Box>
      <Box skin={skin} x={8} y={88} w={168} h={40} label="ESTADÍSTICAS">
        {STATS.map(([label, value], i) => (
          <span key={label}>
            <GameText text={label} x={(i % 2) * 88} y={8 + Math.floor(i / 2) * 11} face="small" color="datos" />
            <GameText text={value} x={(i % 2) * 88 + 52} y={8 + Math.floor(i / 2) * 11} width={26} align="right" face="small" color="datos" />
          </span>
        ))}
      </Box>
      <Box skin={skin} x={8} y={144} w={168} h={24} label="OBJETO · HABILIDAD">
        <GameText text="BAYA ARANJA" x={0} y={9} face="small" color="datos" />
        <GameText text="ESPESURA" x={88} y={9} face="small" color="datos" />
      </Box>
      <Box skin={skin} x={8} y={184} w={168} h={72} label="MOVIMIENTOS">
        {MOVES.map(([name, type, pp], i) => (
          <span key={name}>
            <img src={emeraldTheme.asset(`tipo-${type}`)} alt="" style={{ left: 0, top: 8 + i * 16 }} />
            <GameText text={name} x={36} y={10 + i * 16} face="small" color="datos" />
            <GameText text={pp} x={128} y={10 + i * 16} width={40} align="right" face="small" color="datos" />
          </span>
        ))}
      </Box>
      {BENCH.map(([species, ratio], i) => (
        <span key={species}>
          <img className={ratio ? 'mon-icon mon-icon-anim' : 'mon-icon'} src={emeraldSprite('icon', species)} alt="" style={{ left: 8 + i * 44, top: 266, filter: ratio ? 'none' : 'grayscale(1) opacity(.5)' }} />
          <i className="party-hp-bar" style={{ left: 8 + i * 44, top: 300, width: Math.ceil(32 * ratio), height: 3, background: ratio > 0.5 ? '#5ad583' : ratio > 0.2 ? '#cdac08' : '#c53900' }} />
        </span>
      ))}
    </div>
  )
}

const battleTheme = { ...emeraldTheme, screen: { w: 184, h: 312 }, screens: 1 }

export function BattlePanelsMock(): ReactNode {
  return (
    <div style={{ display: 'flex', gap: 24, padding: 16, background: '#222' }}>
      {(['datos', 'domo', 'ventanas'] as const).map((skin) => (
        <div key={skin} id={`combate-${skin}`}><ConsoleStage theme={battleTheme} scale={2} screens={[<BattleSide key={skin} skin={skin} />]} /></div>
      ))}
    </div>
  )
}

const buttonTheme = { ...emeraldTheme, screen: { w: 240, h: 32 }, screens: 1 }

export function SidePanelsMock(): ReactNode {
  const box = ['ralts', 'zubat', 'geodude', 'machop', 'wingull', 'taillow', 'shroomish', 'nincada', 'whismur', 'aron', 'meditite', 'electrike', 'roselia'].map((species, i) => ({ species, name: species.toUpperCase(), fainted: i % 5 === 4 }))
  return (
    <div style={{ display: 'flex', gap: 24, padding: 16, alignItems: 'flex-start', background: '#222' }}>
      <div id="panel-equipo-real"><TeamPanel party={team.map((mon) => ({ ...mon, item: mon.item }))} box={box} limit={6} itemName={(id) => id} /></div>
      <div id="panel-campana"><ConsoleStage theme={panelTheme} scale={2} screens={[<Card key="c" />]} /></div>
      <div id="panel-equipo"><ConsoleStage theme={panelTheme} scale={2} screens={[<Team key="t" />]} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div id="botones-a"><ConsoleStage theme={buttonTheme} scale={2} screens={[<Buttons key="a" kind="a" />]} /></div>
        <div id="botones-b"><ConsoleStage theme={buttonTheme} scale={2} screens={[<Buttons key="b" kind="b" />]} /></div>
      </div>
      <style>{`.mock-pill { border: 7px solid transparent; border-image: url(${new URL(emeraldTheme.asset('boton-pildora'), document.baseURI).href}) 7 fill / 7px; box-sizing: border-box; image-rendering: pixelated }`}</style>
    </div>
  )
}

/** Cajas de PS con cada estado alterado (`maquetas.html?v=estados`), para revisar el icono. */
export function StatusMock(): ReactNode {
  const boxes = ['slp', 'psn', 'par', 'brn', 'frz'].map((status, i) => {
    const player = healthbox(true)
    const rival = healthbox(false)
    return (
      <div key={status} style={{ left: 0, top: i * 40 - 10, width: 240, height: 40 }}>
        <img src={emeraldTheme.asset(rival.image)} alt="" style={{ left: rival.left, top: rival.top - 20 }} />
        {/* Mismo orden que el combate: la barra y, encima, el icono. */}
        <div style={{ left: 0, top: -20, width: 240, height: 40 }}>
          <HpBar x={rival.bar.x} y={rival.bar.y} ratio={0.6} />
          <StatusBadge status={status} x={rival.status.x} y={rival.status.y} coverLabel />
        </div>
        <img src={emeraldTheme.asset(player.image)} alt="" style={{ left: player.left, top: player.top - 72 }} />
        <div style={{ left: 0, top: -72, width: 240, height: 120 }}>
          <HpBar x={player.bar.x} y={player.bar.y} ratio={0.6} />
          <StatusBadge status={status} x={player.status.x} y={player.status.y} />
        </div>
      </div>
    )
  })
  return <div style={{ padding: 16, background: '#222' }}><ConsoleStage theme={{ ...emeraldTheme, screen: { w: 240, h: 200 }, screens: 1 }} scale={3} screens={[<div key="s">{boxes}</div>]} /></div>
}
