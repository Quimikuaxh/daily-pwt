/** `Storage` en memoria para los tests del progreso guardado; `failWrites` simula la cuota llena y `failReads` el almacenamiento bloqueado. */
export class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>()
  failWrites = false
  failReads = false

  get length(): number {
    return this.items.size
  }
  clear(): void {
    this.items.clear()
  }
  getItem(key: string): string | null {
    if (this.failReads) throw new DOMException('bloqueado', 'SecurityError')
    return this.items.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.items.delete(key)
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('cuota llena', 'QuotaExceededError')
    this.items.set(key, value)
  }
}
