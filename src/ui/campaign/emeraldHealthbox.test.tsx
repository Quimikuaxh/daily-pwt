import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { RivalHpBar } from './EmeraldBattle'

it.each(['slp', 'psn', 'tox', 'par', 'brn', 'frz'])('muestra PS junto al estado del rival (%s)', (status) => {
  const { container } = render(<RivalHpBar status={status} ratio={0.5} />)
  const badge = container.querySelector<HTMLImageElement>('img[src*="/estado-"]')!
  const bar = container.querySelector<HTMLImageElement>('img[src*="/combate-barra"]')!.parentElement!
  expect(parseFloat(bar.style.left) - parseFloat(badge.style.left)).toBe(20)
  expect(bar.style.top).toBe(badge.style.top)
  expect(badge.nextElementSibling).toBe(bar)
})
