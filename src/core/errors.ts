/** Error de datos (JSON corrupto, pool sin solución...): distinguible de un bug. Mensajes en español. */
export class DataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataError'
  }
}
