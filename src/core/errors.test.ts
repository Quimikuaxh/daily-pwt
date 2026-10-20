import { describe, it, expect } from 'vitest'
import { DataError } from './errors'

// TODO-CONTRATO: DataError extiende Error, con name 'DataError', para distinguir errores de datos de bugs.
describe('DataError', () => {
  it('es una instancia de Error', () => {
    expect(new DataError('Datos inválidos')).toBeInstanceOf(Error)
  })

  it('conserva el mensaje', () => {
    expect(new DataError('Datos inválidos').message).toBe('Datos inválidos')
  })

  it('se identifica por su nombre', () => {
    expect(new DataError('x').name).toBe('DataError')
  })
})
