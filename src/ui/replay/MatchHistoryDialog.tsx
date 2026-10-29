import { useCallback, useEffect, useState } from 'react'
import type { CloudApi, HistoryItem } from '../../cloud/api'
import { esReplay } from '../../i18n/esReplay'
import { Modal } from '../common/Modal'
import { shareResult } from '../share/shareText'
import { replayLink } from './replayLink'
import type { HistoryArt } from './historyArt'
import { MemberIcon } from '../battle/party/MemberIcon'
// Con la base de la web (`/daily-pwt/` en Pages), como el resto de sprites: las de `data/sprites` sin base apuntan a la raíz del dominio.
import { trainerMiniSprite, trainerSprite } from '../common/spriteUrls'
import './replay.css'
import { Loading } from '../common/Loading'

const text = esReplay.history

type MatchHistoryDialogProps = {
  api: CloudApi | null
  /** Nombre en español del rival a partir de su id (los datos del juego). */
  trainerName: (trainerId: string) => string
  art?: (item: HistoryItem) => HistoryArt | null
  onWatch: (date: string) => void
  onClose: () => void
}

/** «12/11/2026» a partir de «2026-11-12». */
const shortDate = (date: string) => date.split('-').reverse().join('/')

/**
 * Historial (F5, RF-124 a RF-126): los 20 últimos oficiales con su resultado, «Ver repetición» y «Compartir» (RF-131), que copia el
 * enlace. Con enlace, «Dejar de compartir» (RF-133).
 */
export function MatchHistoryDialog({ api, trainerName, art, onWatch, onClose }: MatchHistoryDialogProps) {
  const [items, setItems] = useState(null as HistoryItem[] | null)
  const [failed, setFailed] = useState(false)
  const [status, setStatus] = useState(null as { date: string; message: string; link?: string } | null)

  const reload = useCallback(() => {
    if (!api) return
    api.myHistory().then(setItems, () => setFailed(true))
  }, [api])
  useEffect(reload, [reload])

  async function share(item: HistoryItem) {
    if (!api) return
    try {
      const link = replayLink(item.sharedId ?? (await api.shareReplay(item.date)))
      const outcome = await shareResult(link)
      setStatus({ date: item.date, message: outcome === 'copied' ? text.copied : text.copyFailed, link: outcome === 'copied' ? undefined : link })
      reload()
    } catch {
      setStatus({ date: item.date, message: text.actionFailed })
    }
  }

  async function unshare(item: HistoryItem) {
    if (!api || !item.sharedId) return
    try {
      await api.deleteSharedReplay(item.sharedId)
      setStatus(null)
      reload()
    } catch {
      setStatus({ date: item.date, message: text.actionFailed })
    }
  }

  return (
    <Modal title={text.title} onClose={onClose} className="history-list-dialog">
      <HistoryBody api={api} items={items} failed={failed}>
        <ul className="history-items">
          {(items ?? []).map((item) => (
            <li key={item.date} className="history-item">
              <HistoryItemHeader item={item} name={trainerName(item.trainerId)} art={art?.(item) ?? null}>
                {/* Botones cuadrados con icono, a la derecha (decisión de Jose, 28/10/2026); el nombre va en la etiqueta y en la ayuda. */}
                <div className="history-item-actions">
                  <button type="button" className="btn btn-small history-icon-button" aria-label={text.watch} title={text.watch} onClick={() => onWatch(item.date)}><HistoryIcon icon="play" /></button>
                  <button type="button" className="btn btn-small history-icon-button" aria-label={text.share} title={text.share} onClick={() => void share(item)}><HistoryIcon icon="share" /></button>
                  {item.sharedId && (
                    <button type="button" className="btn btn-small history-icon-button" aria-label={text.unshare} title={text.unshare} onClick={() => void unshare(item)}><HistoryIcon icon="unshare" /></button>
                  )}
                </div>
              </HistoryItemHeader>
              {status?.date === item.date && (
                <p className="settings-status" role="status">
                  {status.message} {status.link && <span className="history-link">{status.link}</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      </HistoryBody>
    </Modal>
  )
}

/** Iconos en píxel (10 × 10, como los de la cabecera): ver la repetición, compartirla y dejar de compartirla (compartir tachado). */
const HISTORY_ICONS = {
  play: 'M3 1h1v8H3zM4 2h1v6H4zM5 3h1v4H5zM6 4h1v2H6z',
  share: 'M7 0h3v3H7zM0 3h3v3H0zM7 7h3v3H7zM3 3h1v1H3zM4 2h1v1H4zM5 1h2v1H5zM3 5h1v1H3zM4 6h1v1H4zM5 7h2v1H5z',
  unshare: 'M7 0h3v3H7zM0 3h3v3H0zM7 7h3v3H7zM3 3h1v1H3zM5 1h2v1H5zM3 5h1v1H3zM5 7h2v1H5zM0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM4 4h2v2H4zM6 6h1v1H6zM8 8h1v1H8zM9 9h1v1H9z',
} as const

function HistoryIcon({ icon }: { icon: keyof typeof HISTORY_ICONS }) {
  return (
    <svg className="header-icon" viewBox="0 0 10 10" width="20" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path d={HISTORY_ICONS[icon]} fill="currentColor" />
    </svg>
  )
}

/**
 * Copa en píxel (12 × 12) del resultado (decisión de Jose, 29/10/2026): dorada si se ganó; gris y tachada en rojo si no. El lector de
 * pantalla la lee como «Victoria» o «Derrota».
 */
const CUP = {
  body: 'M2 1h8v1H2zM3 2h6v4H3zM4 6h4v1H4zM5 7h2v1H5zM4 8h4v1H4zM3 9h6v2H3zM1 2h1v2H1zM10 2h1v2H10zM2 4h1v1H2zM9 4h1v1H9z',
  shade: 'M7 2h2v4H7zM6 6h2v1H6zM6 7h1v1H6zM6 8h2v1H6zM7 9h2v2H7z',
  shine: 'M4 2h1v2H4z',
  // Diagonal de 2 px de grueso, de abajo a la izquierda a arriba a la derecha.
  cross: Array.from({ length: 11 }, (_, step) => `M${step} ${10 - step}h2v1H${step}z`).join(''),
} as const

function ResultCup({ won }: { won: boolean }) {
  return (
    <svg className="history-cup" data-won={won ? 'true' : 'false'} viewBox="0 0 12 12" width="24" height="24" role="img" aria-label={won ? text.won : text.lost} shapeRendering="crispEdges">
      <path className="history-cup-body" d={CUP.body} />
      <path className="history-cup-shade" d={CUP.shade} />
      <path className="history-cup-shine" d={CUP.shine} />
      {!won && <path className="history-cup-cross" d={CUP.cross} />}
    </svg>
  )
}

/** Sprite de mapa del rival, número, fecha, nombre y resultado, y los iconos de caja de los 6 del equipo. */
function HistoryItemHeader({ item, name, art, children }: { item: HistoryItem; name: string; art: HistoryArt | null; children: React.ReactNode }) {
  return (
    <div className="history-item-head" data-art={art ? 'true' : undefined}>
      {art && (
        <div className="history-trainer-slot">
          <TrainerMini sprite={art.trainerSprite} />
        </div>
      )}
      <div className="history-item-text">
        <p className="history-item-title">
          {text.item(item.challengeNumber, shortDate(item.date))} · {name}
        </p>
        <p className="history-item-result">
          <ResultCup won={item.status === 'won'} />
          {text.turns(item.turns ?? 0)}
          {item.status === 'won' && ` · ${text.alive(item.survivors ?? 0)}`}
        </p>
      </div>
      {art && (
        <div className="history-item-team" aria-hidden="true">
          {art.team.map((spriteId, index) => (
            <MemberIcon key={`${spriteId}-${index}`} spriteId={spriteId} dimmed={item.playerFainted?.[index] ?? false} />
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

/** Sprite de mapa (`-mini`) del entrenador; a los que no lo tienen (PENDIENTE), su sprite de combate en pequeño. */
function TrainerMini({ sprite }: { sprite: string }) {
  const [missing, setMissing] = useState(false)
  return missing ? (
    <img className="history-trainer history-trainer-battle" src={trainerSprite(sprite)} alt="" />
  ) : (
    <img className="history-trainer" src={trainerMiniSprite(sprite)} alt="" onError={() => setMissing(true)} />
  )
}

function HistoryBody({ api, items, failed, children }: { api: CloudApi | null; items: HistoryItem[] | null; failed: boolean; children: React.ReactNode }) {
  if (!api) {
    return <p className="settings-hint">{text.offline}</p>
  }
  if (failed) {
    return <p className="settings-hint" role="alert">{text.failed}</p>
  }
  if (items === null) {
    return <Loading label={text.loading} />
  }
  if (items.length === 0) {
    return <p className="settings-hint">{text.empty}</p>
  }
  return <>{children}</>
}
