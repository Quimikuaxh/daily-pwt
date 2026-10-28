// Historial y visor (F5) en un solo fichero aparte, fuera de la ruta crítica (E2E-21): con dos, el empaquetador sacaba a ficheros
// compartidos parte del código de la carga inicial, que así se comprimía peor (unos 3 KB más).
export { MatchHistoryDialog } from './MatchHistoryDialog'
export { ReplayScreen } from './ReplayScreen'
