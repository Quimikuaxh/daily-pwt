/**
 * Escena de evolución de la campaña de Teselia (maqueta aprobada el 14/11/2026). Arriba, fondo oscuro con un halo detrás del Pokémon (su
 * sprite de 5.ª generación) y el mensaje en la franja de mensajes del combate del diario. Abajo, la pantalla táctil del combate del diario
 * con su botón central grande (CONTINUAR en lugar de LUCHAR); para elegir forma, los botones de movimiento del combate, uno por forma.
 * El orden de los pasos y la animación (dos siluetas que crecen y menguan) son los de Hoenn (evolutionModel); el audio pertenece a Teselia.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { TouchBackground } from '../battle/TouchScreen'
import { moveTileColor } from '../battle/moveTileColors'
import { speciesSprite } from '../common/spriteUrls'
import { usePreloadImages } from '../campaign/usePreloadImages'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import type { GameData } from '../../core/types'
import { animationFrame, evolutionLength, availableTargets, firstStep, nextStep, nothingLeft, type EvolutionChoices, type EvolutionStep, type LeagueEvolution } from '../campaign/evolutionModel'
import { useCampaignMusic, type CampaignMusic } from '../campaign/campaignMusic'
import { unovaMusic, unovaSounds } from './unovaMusic'
import '../battle/battle.css'
import './unova.css'

const LENGTH = evolutionLength()
const t = esCampaign.evolution
const u = esUnova
const frameShowsNew = (step: EvolutionStep, frame: number) => { return step === 'animating' && animationFrame(frame).evolved }
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export type UnovaEvolutionSceneProps = {
  evolutions: readonly LeagueEvolution[]
  nameOf: (species: string) => string
  hpOf: (id: string, species: string) => number
  onDone: (choices: EvolutionChoices) => void
  data: GameData
  scale?: number
  music?: CampaignMusic
  reservedHeight?: number
}

export function UnovaEvolutionScene({ evolutions, nameOf, onDone, data, scale, reservedHeight, music = unovaMusic }: UnovaEvolutionSceneProps) {
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState(firstStep)
  const [choices, setChoices] = useState({} as EvolutionChoices)
  const [frame, setFrame] = useState(0)
  const sprite = (species: string) => speciesSprite(data.dex, species, 'front') ?? ''
  usePreloadImages(evolutions.flatMap((evolution) => [evolution.species, ...evolution.targets].map(sprite)))
  useCampaignMusic(step === 'animating' ? music.evolution : step === 'evolved' ? music.evolved : null, music.register)
  useEffect(() => {
    unovaSounds.preloadCries(evolutions.flatMap((evolution) => [evolution.species, ...evolution.targets]))
  }, [evolutions])
  const evolvingSpecies = step === 'evolving' ? evolutions[index]?.species : null
  useEffect(() => { if (evolvingSpecies) unovaSounds.playCry(evolvingSpecies) }, [evolvingSpecies, index])
  const evolvedSpecies = step === 'evolved' ? (choices[evolutions[index]?.id ?? ''] ?? evolutions[index]?.targets[0]) : null
  useEffect(() => { if (evolvedSpecies) unovaSounds.playCry(evolvedSpecies) }, [evolvedSpecies, index])
  useEffect(() => {
    if (step !== 'animating') return
    if (reducedMotion()) { setStep('evolved'); return }
    const started = performance.now()
    let handle = requestAnimationFrame(function tick(now) {
      const next = Math.max(0, Math.floor(((now - started) * 60) / 1000))
      if (next >= LENGTH) { setStep('evolved'); return }
      setFrame(next)
      handle = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(handle)
  }, [step])

  const current = evolutions[index]
  const name = nameOf(current.species)
  // Las formas que le quedan (un objeto de evolución ya usado por otro no vuelve a salir); con la suya entre ellas, puede quedarse así.
  const targets = availableTargets(evolutions, index, choices)
  const optional = targets.includes(current.species)
  const chosen = choices[current.id] ?? targets.find((target) => target !== current.species) ?? targets[0]
  const shownSpecies = step === 'evolved' || frameShowsNew(step, frame) ? chosen : current.species
  const message = step === 'evolving' && optional ? t.canEvolve(name) : step === 'evolving' || step === 'animating' ? t.evolving(name)
    : step === 'choose' ? t.which(name) : t.evolved(name, nameOf(chosen))
  const animation = step === 'animating' ? animationFrame(frame) : null
  const scales = animation?.scales ?? null
  const flash = animation?.flash ?? 0

  // Pasa al siguiente miembro que aún tenga algo que hacer (los que se quedaron sin su objeto, tal cual) o termina.
  const finish = (all: EvolutionChoices) => {
    let next = index + 1
    while (next < evolutions.length && nothingLeft(evolutions[next], availableTargets(evolutions, next, all))) {
      all = { ...all, [evolutions[next].id]: evolutions[next].species }
      next += 1
    }
    if (next < evolutions.length) {
      setChoices(all)
      setIndex(next)
      setStep(firstStep)
      return true
    }
    onDone(all)
    return false
  }
  const advance = () => {
    const next = nextStep(step, targets.length)
    if (next) { setFrame(0); setStep(next); return }
    finish({ ...choices, [current.id]: chosen })
  }
  const choose = (target: string) => {
    // Quedarse como está: sin animación, al siguiente.
    if (target === current.species) { finish({ ...choices, [current.id]: target }); return }
    setChoices({ ...choices, [current.id]: target })
    setFrame(0)
    setStep('animating')
  }

  return (
    <div className="evolution-screen">
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} freeScreens={[0, 1]} screens={[(
        <div key="scene" className="unova-evo-scene">
          <span className="unova-evo-halo" style={{ opacity: 0.6 + 0.4 * flash } as CSSProperties} />
          {scales ? (
            <>
              <img className="unova-evo-mon unova-evo-silhouette" src={sprite(current.species)} alt="" style={{ transform: `translate(-50%, 0) scale(${scales[0] / 256})` }} />
              <img className="unova-evo-mon unova-evo-silhouette" src={sprite(chosen)} alt="" style={{ transform: `translate(-50%, 0) scale(${scales[1] / 256})` }} />
            </>
          ) : (
            <img className="unova-evo-mon" src={sprite(shownSpecies)} alt="" />
          )}
          <div className="bt-message">
            <p className="bt-message-text" role="status">{message}</p>
          </div>
        </div>
      ), (
        <section key="touch" className="bt-touch unova-evo-touch" aria-label={t.screen}>
          <TouchBackground />
          <span className="unova-evo-progress">{u.evolutionProgress(index + 1, evolutions.length)}</span>
          {step === 'choose' ? (
            <div className="bt-moves" role="menu" aria-label={message}>
              {targets.map((target, i) => (
                <button key={target} type="button" role="menuitem" className="bt-move" data-slot={i + 1} autoFocus={i === 0}
                  style={{ '--tile': moveTileColor(data.dex.species[target]?.types[0] ?? null) } as CSSProperties}
                  aria-label={target === current.species ? t.keepLabel(nameOf(target)) : t.optionLabel(nameOf(target))} onClick={() => choose(target)}>
                  <span className="bt-move-shape" aria-hidden="true" />
                  <span className="bt-move-name">{nameOf(target)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="bt-main">
              <button type="button" className="bt-fight" disabled={step === 'animating'} autoFocus aria-label={t.continueLabel(message)} onClick={advance}>
                <span className="bt-fight-shape" aria-hidden="true" />
                <span className="bt-fight-label">{u.continueLabel}</span>
              </button>
            </div>
          )}
        </section>
      )]} />
    </div>
  )
}
