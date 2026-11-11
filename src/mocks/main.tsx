/**
 * Maquetas de la Liga de la campaña (solo desarrollo: `maquetas.html?v=…`, fuera del build). Opciones para elegir la evolución de los
 * Pokémon con varias formas finales y pantallas de objetos (dar desde el PC y canje de Puntos Batalla), para que Jose elija antes de
 * implementarlas. Textos de ejemplo escritos aquí a propósito: no es interfaz de la app.
 */
import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'
import { ConsoleStage } from '../ui/console/ConsoleStage'
import { GameText } from '../ui/console/GameText'
import { GameWindow } from '../ui/console/GameWindow'
import { emeraldSprite, emeraldTheme } from '../ui/console/themes/emerald'
import { PartySlot } from '../ui/campaign/PartySlot'
import { slotBox } from '../ui/campaign/partySlotModel'
import '../index.css'
import '../ui/campaign/campaign.css'

const team = [
  { species: 'gloom', name: 'GLOOM', level: 40, hp: 120, maxHp: 120 },
  { species: 'kirlia', name: 'KIRLIA', level: 40, hp: 110, maxHp: 110 },
  { species: 'grovyle', name: 'GROVYLE', level: 40, hp: 115, maxHp: 115 },
  { species: 'wingull', name: 'WINGULL', level: 40, hp: 98, maxHp: 98 },
]

function Party({ active = 0, message = 'Elige un POKéMON.', descriptions = {} as Record<number, string> }) {
  return (
    <>
      <img src={emeraldTheme.asset('equipo-fondo')} alt="" style={{ left: 0, top: 0 }} />
      {Array.from({ length: 6 }, (_, i) => {
        const r = slotBox(i)
        return (
          <div key={i} style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
            <PartySlot i={i} mon={team[i] ?? null} state={i === active ? 'activa' : 'normal'} bounce={i === active} description={descriptions[i]} />
          </div>
        )
      })}
      <GameWindow x={1} y={17} width={21} height={2}><GameText text={message} y={1} width={168} fit /></GameWindow>
    </>
  )
}

/** Lista con cursor ▶ en la fila `cursor`, como el menú del juego. */
function Menu({ x, y, width, items, cursor = 0 }: { x: number; y: number; width: number; items: string[]; cursor?: number }) {
  return (
    <GameWindow x={x} y={y} width={width} height={items.length * 2}>
      {items.map((item, i) => (
        <span key={item}>
          {i === cursor && <GameText text={'▶'} y={1 + i * 16} />}
          <GameText text={item} x={8} y={1 + i * 16} />
        </span>
      ))}
    </GameWindow>
  )
}

/** A · Escena de evolución (evolution_scene.c): fondo negro, el Pokémon y la caja de mensajes; ventana con las formas. */
function EvoScene() {
  return [
    <div key="t">
      <div style={{ inset: 0, background: '#000' }} />
      <img className="mon-front" src={emeraldSprite('front', 'gloom')} alt="" style={{ left: 88, top: 24 }} />
      <img src={emeraldTheme.asset('combate-caja-mensaje')} alt="" style={{ left: 0, top: 112 }} />
      <GameText text="¿En qué debería evolucionar" x={16} y={121} color="combate-mensaje" />
      <GameText text="GLOOM?" x={16} y={137} color="combate-mensaje" />
      <Menu x={18} y={7} width={10} items={['VILEPLUME', 'BELLOSSOM']} />
    </div>,
    <div key="b"><Party message="GLOOM tiene dos evoluciones." /></div>,
  ]
}

/** B · Datos del Pokémon, como en el Draft: una Poké Ball por forma y su ficha abajo. */
function EvoData() {
  return [
    <div key="t">
      <img src={emeraldTheme.asset('fabrica-fondo')} alt="" style={{ left: 0, top: 0 }} />
      <GameText text="EVOLUCIÓN DE GLOOM" x={2} y={17} width={140} color="fabrica" />
      <GameText text="VILEPLUME" x={152} y={17} width={86} align="right" color="especie" />
      {[0, 1].map((i) => <span key={i} className="draft-ball-sprite" style={{ left: 48 + 48 * i - 16, top: 48, width: 32, height: 32, backgroundImage: `url("${emeraldTheme.asset(i === 0 ? 'fabrica-ball-activa' : 'fabrica-ball-gris')}")` }} />)}
      <img src={emeraldTheme.asset('fabrica-flecha')} alt="" style={{ left: 40, top: 80 }} />
      <GameText text="Elige la evolución." x={2} y={125} width={156} color="fabrica" />
      <img className="draft-highlight-on" src={emeraldTheme.asset('fabrica-resalte-izda')} alt="" style={{ left: 176, top: 112 }} />
      <img src={emeraldTheme.asset('fabrica-resalte-dcha')} alt="" style={{ left: 208, top: 112 }} />
      <GameText text="DATOS" x={183} y={113} color="fabrica-menu" />
      <GameText text="ELEGIR" x={183} y={129} color="fabrica-menu" />
      <GameText text="OTROS" x={183} y={145} color="fabrica-menu" />
    </div>,
    <div key="b">
      <img src={emeraldTheme.asset('datos-info')} alt="" style={{ left: 0, top: 0 }} />
      <GameText text="INFO POKéMON" x={2} y={1} width={88} color="datos-rotulo" />
      <GameText text="{NO}045" x={8} y={17} color="datos-rotulo" />
      <img className="mon-front" src={emeraldSprite('front', 'vileplume')} alt="" style={{ left: 8, top: 32 }} />
      <GameText text="VILEPLUME" x={8} y={97} color="datos-rotulo" />
      <GameText text="/VILEPLUME" x={8} y={113} width={72} color="datos-rotulo" />
      <GameText text="{LV}40" x={32} y={129} color="datos-rotulo" />
      <GameText text="PERFIL" x={98} y={20} face="small" color="tira" />
      <GameText text="HABILIDAD" x={98} y={60} face="small" color="tira" />
      <GameText text="NOTAS" x={98} y={100} face="small" color="tira" />
      <GameText text="EVOLUCIÓN DE GLOOM" x={88} y={33} width={144} color="datos-rotulo" />
      <GameText text="TIPO/" x={88} y={49} color="datos" />
      <img src={emeraldTheme.asset('tipo-grass')} alt="" style={{ left: 120, top: 48 }} />
      <img src={emeraldTheme.asset('tipo-poison')} alt="" style={{ left: 160, top: 48 }} />
      <GameText text="CLOROFILA" x={88} y={73} width={144} color="datos-rotulo" />
      <GameText text="Evoluciona con la PIEDRA" x={88} y={113} width={144} color="datos" />
      <GameText text="HOJA (la tienes)." x={88} y={129} width={144} color="datos" />
    </div>,
  ]
}

/** C · Sin pantalla nueva: EVOLUCIONAR en el menú del PC y una ventana con las formas. */
function EvoPc() {
  return [
    <div key="t">
      <img src={emeraldTheme.asset('pc-fondo')} alt="" style={{ left: 0, top: 0 }} />
      <GameText text="CAJA 1" x={80} y={20} width={160} align="center" color="pc-caja" />
      <img className="mon-front" src={emeraldSprite('front', 'gloom')} alt="" style={{ left: 8, top: 16 }} />
      <GameText text="GLOOM" x={6} y={88} color="pc-datos" />
      <GameText text="/GLOOM" x={6} y={103} face="short" color="pc-datos" />
      <GameText text=" {LV_2}40" x={10} y={117} face="short" color="pc-nivel" />
      <Menu x={16} y={7} width={13} items={['MOVER', 'MOVIMIENTOS', 'EVOLUCIONAR', 'CANCELAR']} cursor={2} />
      <Menu x={1} y={14} width={10} items={['VILEPLUME', 'BELLOSSOM']} />
    </div>,
    <div key="b"><Party message="¿En qué evolucionará GLOOM?" /></div>,
  ]
}

const icon = (id: string) => emeraldTheme.asset(`objeto-${id}`)

/** Objetos desde el PC: OBJETO en el menú del PC; lista de la Mochila con cantidades, icono y descripción, y DAR/QUITAR. */
function ItemsPc() {
  const items: [string, string, string][] = [['RESTOS', 'leftovers', '×1'], ['BAYA ZIDRA', 'sitrusberry', ''], ['CINTA FOCUS', 'focusband', '×1'], ['GARRA RÁPIDA', 'quickclaw', '×1'], ['IMÁN', 'magnet', '×1'], ['SALIR', '', '']]
  return [
    <div key="t">
      <div style={{ inset: 0, background: '#000' }} />
      <GameWindow x={1} y={1} width={16} height={12}>
        <img src={icon('leftovers')} alt="" style={{ left: 0, top: 4 }} />
        <GameText text="RESTOS" x={30} y={9} />
        <GameText text="Lo lleva: nadie." x={0} y={33} />
        <GameText text="Restaura PS poco a poco" x={0} y={65} face="narrow" />
        <GameText text="en cada turno." x={0} y={81} face="narrow" />
      </GameWindow>
      <GameWindow x={19} y={1} width={10} height={12}>
        {items.map(([name, , count], i) => (
          <span key={name}>
            {i === 0 && <GameText text={'▶'} y={1} />}
            <GameText text={name} x={8} y={1 + i * 16} width={56} fit />
            <GameText text={count} x={64} y={1 + i * 16} width={16} align="right" />
          </span>
        ))}
      </GameWindow>
      <GameWindow x={4} y={15} width={22} height={4}>
        <GameText text="¿Qué objeto debería llevar" y={1} />
        <GameText text="GROVYLE?" y={17} />
      </GameWindow>
    </div>,
    <div key="b"><Party active={2} message="GROVYLE: sin objeto." /></div>,
  ]
}

/** Canje de Puntos Batalla (mostrador del Frente Batalla, field_specials.c): PB arriba, lista con precios, icono y descripción. */
function Exchange() {
  const items: [string, string][] = [['RESTOS', '48 PB'], ['HIERBA BLANCA', '48 PB'], ['GARRA RÁPIDA', '48 PB'], ['HIERBA MENTAL', '48 PB'], ['POLVO BRILLO', '64 PB'], ['CINTA ELEGIDA', '64 PB'], ['SALIR', '']]
  return [
    <div key="t">
      <img src={emeraldTheme.asset('fabrica-fondo')} alt="" style={{ left: 0, top: 0, filter: 'brightness(.55)' }} />
      <GameWindow x={1} y={1} width={8} height={2}><GameText text="PB" y={1} /><GameText text="56" x={24} y={1} width={40} align="right" /></GameWindow>
      <GameWindow x={13} y={1} width={16} height={13}>
        {items.map(([name, price], i) => (
          <span key={name}>
            {i === 5 && <GameText text={'▶'} y={1 + i * 16} />}
            <GameText text={name} x={8} y={1 + i * 16} width={80} fit />
            <GameText text={price} x={88} y={1 + i * 16} width={40} align="right" />
          </span>
        ))}
      </GameWindow>
      <GameWindow x={1} y={5} width={3} height={3}><img src={icon('choiceband')} alt="" style={{ left: 0, top: 0 }} /></GameWindow>
      <GameWindow x={1} y={16} width={28} height={3}>
        <GameText text="Aumenta el ATAQUE, pero solo deja" y={1} />
        <GameText text="usar un movimiento." y={17} />
      </GameWindow>
    </div>,
    <div key="b"><Party active={-1} message="Canje: 56 PB. Precios 48 y 64." /></div>,
  ]
}

/** Mochila de Esmeralda (item_menu.c): bolsillo OBJETOS, lista a la derecha (14,2), icono en (24,88) y descripción (0,13). */
function Bag() {
  const items: [string, string][] = [['RESTOS', '×1'], ['CINTA FOCUS', '×1'], ['GARRA RÁPIDA', '×1'], ['IMÁN', '×1'], ['CARBÓN', '×1'], ['ROCA DEL REY', '×1'], ['CERRAR MOCHILA', '']]
  return [
    <div key="t">
      <img src={emeraldTheme.asset('mochila-fondo-brendan')} alt="" style={{ left: 0, top: 0 }} />
      <div style={{ left: 36, top: 34, width: 64, height: 64, overflow: 'hidden' }}>
        <img src={emeraldTheme.asset('mochila-brendan')} alt="" style={{ left: 0, top: -64 }} />
      </div>
      <GameText text="OBJETOS" x={32} y={9} width={64} align="center" color="mochila-bolsillo" />
      {items.map(([name, count], i) => (
        <span key={name}>
          {i === 0 && <GameText text={'\u25b6'} x={112} y={17 + i * 16} color="ventana" />}
          <GameText text={name} x={120} y={17 + i * 16} width={88} fit color="ventana" />
          <GameText text={count} x={208} y={17 + i * 16} width={24} align="right" face="narrow" color="ventana" />
        </span>
      ))}
      <img src={icon('leftovers')} alt="" style={{ left: 12, top: 76 }} />
      <GameText text="Restaura PS poco a" x={4} y={105} color="ventana" />
      <GameText text="poco en cada turno." x={4} y={121} color="ventana" />
    </div>,
    <div key="b"><Party active={2} message="¿Qué objeto llevará GROVYLE?" /></div>,
  ]
}

const views: Record<string, () => ReactNode[]> = { mochila: Bag, 'evo-a': EvoScene, 'evo-b': EvoData, 'evo-c': EvoPc, 'objetos-pc': ItemsPc, canje: Exchange }
const view = views[new URLSearchParams(location.search).get('v') ?? ''] ?? EvoScene

createRoot(document.getElementById('root')!).render(
  <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
    <ConsoleStage theme={emeraldTheme} scale={2} screens={view()} />
  </div>,
)
