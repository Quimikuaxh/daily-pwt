import { es } from '../../i18n/es'
import type { GameStore } from '../../storage/gameStore'
import { computeStats } from '../../storage/playerStats'
import { Modal } from '../common/Modal'
import { ShareButton } from '../share/ShareButton'
import { shareTextFor } from '../share/shareText'
import { StatsPanel } from './StatsPanel'

type StatsDialogProps = {
  store: GameStore
  /** Fecha del reto que se está viendo: con ella se decide si la racha de días sigue viva y si hay oficial de hoy que compartir. */
  today: string
  onClose: () => void
}

/** Estadísticas sobre el historial de oficiales y, si el de hoy ya terminó, su botón de compartir. */
export function StatsDialog({ store, today, onClose }: StatsDialogProps) {
  const days = store.listDays()
  const stats = computeStats(days, today)
  const text = shareTextFor(days, today)

  return (
    <Modal title={es.stats.title} onClose={onClose} className="stats-dialog">
      {stats.played === 0 ? <p className="dialog-body">{es.stats.empty}</p> : <StatsPanel stats={stats} />}
      {text && <ShareButton text={text} />}
      <p className="stats-note">{es.stats.note}</p>
    </Modal>
  )
}
