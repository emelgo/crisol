/**
 * Un mapa con tope para lo que se guarda en memoria (la visión, por campaña y escena): pasado el tope, se va lo que
 * lleva más tiempo sin usarse. Leer con `get` cuenta como usar; `peek` no
 */
export class Lru<K, V> {
  private readonly map = new Map<K, V>()
  private readonly max: number
  private readonly onEvict: ((key: K, value: V) => void) | undefined

  constructor(max: number, onEvict?: (key: K, value: V) => void) {
    this.max = max
    this.onEvict = onEvict
  }

  get size() {
    return this.map.size
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key) as V
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  /** Sin contarlo como uso */
  peek(key: K): V | undefined {
    return this.map.get(key)
  }

  has(key: K) {
    return this.map.has(key)
  }

  set(key: K, value: V) {
    this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.max) {
      const [oldest, gone] = this.map.entries().next().value as [K, V]
      this.map.delete(oldest)
      this.onEvict?.(oldest, gone)
    }
    return this
  }

  delete(key: K) {
    return this.map.delete(key)
  }

  keys() {
    return this.map.keys()
  }
}
