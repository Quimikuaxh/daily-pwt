import { describe, it, expect } from 'vitest'
import { getDailyChallenge } from '../core/challenge'
import { loadGameData } from './gameData'
import { dates } from '../test-utils/dates'

// El artículo y el género de "¡La Líder Camila te desafía!" (RF-53) salen del dato `gender` del entrenador.
const data = loadGameData()

describe('género del entrenador', () => {
  it('todos los entrenadores de trainers.json tienen gender F o M', () => {
    expect(data.trainers.filter((t) => t.gender !== 'F' && t.gender !== 'M').map((t) => t.id)).toEqual([])
  })

  it('Misty y Camila son F; Brock, Máximo, Plubio y Rojo son M', () => {
    const byId = Object.fromEntries(data.trainers.map((t) => [t.id, t.gender]))
    expect(byId).toEqual({ brock: 'M', misty: 'F', camila: 'F', plubio: 'M', rojo: 'M', maximo: 'M' })
  })

  it('el reto expone el género del rival del día', () => {
    for (const date of dates(5)) {
      const challenge = getDailyChallenge(date, data)
      expect(challenge.trainer.gender).toBe(data.trainers.find((t) => t.id === challenge.trainer.id)!.gender)
    }
  })
})
