import { describe, expect, it } from 'vitest'
import { fitPoint, trainerSpriteFit } from './trainerSpriteFit'
import { rivalHandPoint } from './throwGeometry'

// UT-251 (Jose, 22/11/2026): Ciprián y Sachiko, agachados en un GIF más ancho que su figura, se amplían x1,25 y se centran por su figura;
// la mano desde la que lanzan la bola sigue al sprite. El resto no cambia.
describe('ajuste del sprite de combate del entrenador', () => {
  it('solo Ciprián y Sachiko: ampliados x1,25 desde su centro inferior y desplazados para centrar la figura', () => {
    expect(trainerSpriteFit('ciprian')).toMatchObject({ transform: 'translate(38.125px, 6.25px) scale(1.25)', transformOrigin: '50% 100%' })
    expect(trainerSpriteFit('sachiko')).toMatchObject({ transform: 'translate(6.25px, 0px) scale(1.25)' })
    expect(trainerSpriteFit('misty')).toBeUndefined()
  })

  it('la mano se mueve con el sprite; la de los demás, igual que antes', () => {
    const feet = { x: 100, y: 100 }
    expect(fitPoint('ciprian', feet, { x: 110, y: 60 })).toEqual({ x: 100 + 38.125 + 12.5, y: 100 + 6.25 - 50 })
    expect(fitPoint('misty', feet, { x: 110, y: 60 })).toEqual({ x: 110, y: 60 })
    expect(rivalHandPoint('ciprian')).not.toEqual(rivalHandPoint('misty'))
  })
})
