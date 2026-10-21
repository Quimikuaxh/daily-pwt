import { describe, it, expect, vi } from 'vitest'
import { BATTLE_DATABOX_IMAGES, BATTLE_UI_IMAGES, PARTY_SCREEN_IMAGES, SUMMARY_SCREEN_IMAGES, challengeSpriteUrls, imagesReady, preloadBattleImages } from './preloadAssets'
import { getDailyChallenge } from '../../core/challenge'
import { loadGameData } from '../../data/gameData'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('precarga de imágenes de la caja de datos', () => {
  it('pide los 10 dígitos de PS y de nivel, los 3 colores de barra y los iconos de estado', () => {
    const requested: string[] = []
    preloadBattleImages(() => ({ set src(url: string) { requested.push(url) } }) as { src: string })
    expect(requested).toEqual([...BATTLE_DATABOX_IMAGES])
    for (let digit = 0; digit < 10; digit += 1) expect(requested.some((url) => url.endsWith(`digits/hp-${digit}.png`))).toBe(true)
    for (const color of ['green', 'yellow', 'red']) expect(requested.some((url) => url.endsWith(`hp/fill-${color}.png`))).toBe(true)
  })

  it('todas las imágenes existen en public/', () => {
    for (const url of BATTLE_DATABOX_IMAGES) expect(existsSync(resolve('public', url.replace(/^\.?\/?/, ''))), url).toBe(true)
  })
})

describe('precarga de la interfaz y de los sprites del reto', () => {
  const data = loadGameData()
  const challenge = getDailyChallenge('2026-10-21', data)

  it('los sprites precargados son solo los del reto: frente y espalda de los 6 rivales y los 6 propios, y el entrenador', () => {
    const urls = challengeSpriteUrls(challenge, data)
    const species = new Set([...challenge.rivalTeam, ...challenge.playerTeam].map((set) => set.species))
    expect(urls.length).toBe(species.size * 2 + 1)
    for (const url of urls.filter((candidate) => candidate.includes('/pokemon/'))) {
      expect([...species].some((id) => url.endsWith(`/${data.dex.species[id].spriteId}.gif`)), url).toBe(true)
    }
    expect(urls.some((url) => url.includes(`trainers/${challenge.trainer.sprite}.gif`))).toBe(true)
  })

  it('la lista de interfaz cubre las pantallas de equipo y de datos y no incluye fondos de combate sin usar', () => {
    expect(PARTY_SCREEN_IMAGES.some((url) => url.endsWith('party/bg-top.png'))).toBe(true)
    expect(SUMMARY_SCREEN_IMAGES.some((url) => url.endsWith('summary/info-top.png'))).toBe(true)
    expect(BATTLE_UI_IMAGES.some((url) => url.endsWith('bg/pwt.png'))).toBe(true)
    expect(BATTLE_UI_IMAGES.filter((url) => url.includes('/bg/'))).toHaveLength(1)
  })

  it('imagesReady espera a la decodificación y no se queda colgada si una imagen falla o tarda', async () => {
    let finishDecoding: () => void = () => undefined
    const slow = () => ({ src: '', decode: () => new Promise<void>((resolve) => { finishDecoding = resolve }) })
    let resolved = false
    const waiting = imagesReady(['/ui/a.png'], 5000, slow).then(() => { resolved = true })
    await Promise.resolve()
    expect(resolved, 'sigue esperando a decode()').toBe(false)
    finishDecoding()
    await waiting
    expect(resolved).toBe(true)

    vi.useFakeTimers()
    const never = () => ({ src: '', decode: () => new Promise<void>(() => undefined) })
    const bounded = imagesReady(['/ui/b.png'], 1500, never)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(bounded).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
