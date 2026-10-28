/**
 * Textos del historial y las repeticiones (F5) que solo usan las partes que se cargan aparte (ventana Historial y visor): fuera de `es.ts`
 * para que no entren en la ruta crítica (E2E-21). Lo que se pinta al cargar (el acceso de la cabecera) sigue en `es.ts`.
 */
export const esReplay = {
  history: {
    title: 'Historial',
    empty: 'Aún no hay combates en tu historial. Se guardan a partir de ahora, al terminar cada combate oficial.',
    loading: 'Cargando…',
    failed: 'No se ha podido cargar el historial.',
    offline: 'El historial necesita conexión con el servidor.',
    item: (number: number, date: string) => `#${number} · ${date}`,
    won: (turns: number, alive: number) => `Victoria · ${turns} ${turns === 1 ? 'turno' : 'turnos'} · ${alive}/6 en pie`,
    lost: (turns: number) => `Derrota · ${turns} ${turns === 1 ? 'turno' : 'turnos'}`,
    watch: 'Ver repetición',
    share: 'Compartir',
    copied: 'Enlace copiado.',
    copyFailed: 'No se ha podido copiar; copia el enlace a mano:',
    unshare: 'Dejar de compartir',
    actionFailed: 'No se ha podido completar. Inténtalo de nuevo.',
  },
  viewer: {
    controls: 'Controles de la repetición',
    turnOf: (turn: number, total: number) => `Turno ${turn} de ${total}`,
    intro: 'Inicio',
    start: 'Al principio',
    previous: 'Turno anterior',
    play: 'Reproducir',
    pause: 'Pausa',
    next: 'Turno siguiente',
    end: 'Al final',
    deleteLink: 'Borrar enlace',
    deleteTitle: '¿Borrar el enlace?',
    deleteBody: 'Nadie podrá volver a ver esta repetición con el enlace. No se puede deshacer.',
    deleteConfirm: 'Sí, borrar',
    cancel: 'Cancelar',
    loading: 'Cargando la repetición…',
    notFound: 'Esta repetición no existe o se ha borrado.',
    failed: 'No se ha podido cargar la repetición.',
    toToday: 'Ir al reto de hoy',
    sharedBy: (nickname: string | null, number: number, date: string) => `${nickname ?? 'Un jugador'} · reto #${number} · ${date}`,
  },
} as const
