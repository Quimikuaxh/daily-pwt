/** Acceder a `localStorage` puede lanzar (cookies bloqueadas, modo privado): sin él el sitio funciona igual, sin guardar. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
