import { useEffect, useState } from 'react'
import { CloudError, type CloudApi } from '../../cloud/api'
import type { GameData } from '../../core/types'
import { esReplay } from '../../i18n/esReplay'
import { decodeReplay } from '../../replay/replayCodec'
import type { ReplayData } from '../../replay/replayData'
import type { Settings } from '../../storage/settings'
import { Dialog } from '../common/Dialog'
import { ReplayViewer } from './ReplayViewer'
import './replay.css'
import { Loading } from '../common/Loading'

const text = esReplay.viewer

/** De dónde sale la repetición: del historial propio (por fecha) o de un enlace compartido (por id). */
/** `local`: la del oficial que acaba de terminar, ya en memoria (RF-135; también sin conexión). */
export type ReplaySource = { kind: 'mine'; date: string } | { kind: 'shared'; id: string } | { kind: 'local'; replay: ReplayData }

type Loaded = { status: 'loading' } | { status: 'ready'; replay: ReplayData; mine: boolean } | { status: 'notFound' | 'failed' }

type ReplayScreenProps = {
  source: ReplaySource
  /** `null` mientras no hay sesión (la cuenta se está abriendo) o sin servicio. */
  api: CloudApi | null
  /** La cuenta ya no está cargando: sin `api`, no hay servicio. */
  ready: boolean
  data: GameData
  settings: Settings
  onExit: () => void
}

/** Carga y abre una repetición (RF-127, RF-132). Un enlace que no existe muestra un aviso y el camino a Hoy (RF-134). */
export function ReplayScreen({ source, api, ready, data, settings, onExit }: ReplayScreenProps) {
  const [loaded, setLoaded] = useState((source.kind === 'local' ? { status: 'ready', replay: source.replay, mine: false } : { status: 'loading' }) as Loaded)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const key = source.kind === 'mine' ? source.date : source.kind === 'shared' ? source.id : 'local'

  useEffect(() => {
    if (!api || source.kind === 'local') return
    let cancelled = false
    const load = async () => {
      if (source.kind === 'mine') return { replay: await decodeReplay(await api.getMyReplay(source.date)), mine: false }
      const shared = await api.getSharedReplay(source.id)
      return { replay: await decodeReplay(shared.data), mine: shared.mine }
    }
    load().then(
      (result) => !cancelled && setLoaded({ status: 'ready', ...result }),
      (error) => !cancelled && setLoaded({ status: error instanceof CloudError && error.code === 'replay_not_found' ? 'notFound' : 'failed' }),
    )
    return () => {
      cancelled = true
    }
    // `source` cambia de objeto en cada render de App; manda su clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ready, key])

  // Sin servicio (la cuenta ya terminó de abrirse y no hay sesión): no se puede cargar.
  const shownStatus = !api && ready && source.kind !== 'local' ? 'failed' : loaded.status
  if (shownStatus !== 'ready' || loaded.status !== 'ready') {
    return (
      <main className="page-main replay-message">
        {shownStatus === 'loading' ? (
          <Loading label={text.loading} />
        ) : (
          <p className="settings-hint" role="alert">{shownStatus === 'notFound' ? text.notFound : text.failed}</p>
        )}
        {shownStatus !== 'loading' && <button type="button" className="btn btn-primary" onClick={onExit}>{text.toToday}</button>}
      </main>
    )
  }

  const canDelete = source.kind === 'shared' && loaded.mine && api !== null
  return (
    <>
      <ReplayViewer replay={loaded.replay} data={data} settings={settings} onExit={onExit} onDelete={canDelete ? () => setConfirmDelete(true) : undefined} own={source.kind !== 'shared' || loaded.mine} />
      {confirmDelete && source.kind === 'shared' && api && (
        <Dialog
          title={text.deleteTitle}
          body={text.deleteBody}
          confirmLabel={text.deleteConfirm}
          cancelLabel={text.cancel}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            api.deleteSharedReplay(source.id).then(onExit, () => setLoaded({ status: 'failed' }))
          }}
        />
      )}
    </>
  )
}
