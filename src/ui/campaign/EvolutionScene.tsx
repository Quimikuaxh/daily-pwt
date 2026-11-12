/**
 * Escena de evolución de la Liga (D7, opción A aprobada el 11/11/2026; evolution_scene.c): fondo negro, el Pokémon en el centro y la
 * caja de mensajes del combate. Por cada miembro que evoluciona: «¿Qué? ¡GLOOM está evolucionando!», la ventana con las formas si hay
 * varias y «¡Enhorabuena! ¡Tu GLOOM ha evolucionado en VILEPLUME!». Abajo, el miembro en el equipo y el progreso. Al acabar devuelve
 * la forma elegida de cada uno (`evolveForLeague`).
 */
import { MessageArrow } from './MessageArrow'
import { textWidth } from '../console/glyphs'
import type { BitmapFont } from '../console/theme'
import { useEffect, useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import { PartySlot } from './PartySlot'
import { messagePages } from './emeraldBattleModel'
import { animationFrame, evolutionLength, evolutionSound, sceneSpriteTop, firstStep, nextStep, optionsWidth, type EvolutionChoices, type EvolutionStep, type LeagueEvolution } from './evolutionModel'
import { EVOLUTION_MUSIC, EVOLUTION_SFX_IDS, EVOLVED_MUSIC, playCry, playSfx, preloadCries, preloadSfx, useCampaignMusic } from './campaignMusic'

const LENGTH = evolutionLength()
const frameShowsNew = (step: EvolutionStep, frame: number) => { return step === 'animating' && animationFrame(frame).evolved }
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const t = esCampaign.evolution

type EvolutionSceneProps = {
  evolutions: readonly LeagueEvolution[]
  nameOf: (species: string) => string
  /** PS al nivel del miembro con la forma que se ve. */
  hpOf: (id: string, species: string) => number
  onDone: (choices: EvolutionChoices) => void
  scale?: number
  reservedHeight?: number
}

export function EvolutionScene({ evolutions, nameOf, hpOf, onDone, scale, reservedHeight }: EvolutionSceneProps) {
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState(firstStep)
  const [choices, setChoices] = useState({} as EvolutionChoices)
  const [cursor, setCursor] = useState(0)
  // Fotograma de la animación de evolución (60 Hz); con movimiento reducido no se anima.
  const [frame, setFrame] = useState(0)
  // La música de evolución suena mientras se anima (EVOSTATE_START_MUSIC hasta EVOSTATE_RESTORE_SCREEN).
  // Después, la fanfarria de «¡Enhorabuena!» con el mensaje (MUS_EVOLVED), una vez.
  useCampaignMusic(step === 'animating' ? EVOLUTION_MUSIC : step === 'evolved' ? EVOLVED_MUSIC : null)
  useEffect(() => {
    preloadSfx(EVOLUTION_SFX_IDS)
    preloadCries(evolutions.flatMap((evolution) => [evolution.species, ...evolution.targets]))
  }, [evolutions])
  // Un efecto al empezar cada fase de destellos y otro al acabar (Task_Sparkles_*_Init, EVOSTATE_EVO_SOUND).
  const sparklePhase = step === 'animating' ? evolutionSound(frame) : null
  useEffect(() => { if (sparklePhase) playSfx(sparklePhase) }, [sparklePhase])
  useEffect(() => { if (step === 'evolved') playSfx('emerald-evo-done') }, [step, index])
  // Grito al anunciarse (EVOSTATE_INTRO_MON_ANIM) y el de la forma nueva al acabar (EVOSTATE_EVO_MON_ANIM).
  const evolvingSpecies = step === 'evolving' ? evolutions[index]?.species : null
  useEffect(() => { if (evolvingSpecies) playCry(evolvingSpecies) }, [evolvingSpecies, index])
  const evolvedSpecies = step === 'evolved' ? (choices[evolutions[index]?.id ?? ''] ?? evolutions[index]?.targets[0]) : null
  useEffect(() => { if (evolvedSpecies) playCry(evolvedSpecies) }, [evolvedSpecies, index])
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
  const chosen = choices[current.id] ?? current.targets[0]
  const shownSpecies = step === 'evolved' || frameShowsNew(step, frame) ? chosen : current.species
  const message = step === 'evolving' || step === 'animating' ? t.evolving(name) : step === 'choose' ? t.which(name) : t.evolved(name, nameOf(chosen))
  const animation = step === 'animating' ? animationFrame(frame) : null
  const scales = animation?.scales ?? null
  const flash = animation?.flash ?? 0
  const white = animation?.white ?? 0
  const row = animation?.row ?? -1
  const lines = messagePages(message)[0] ?? []

  const advance = () => {
    const next = nextStep(step, current.targets.length)
    if (next) { setFrame(0); setStep(next); return }
    const all = { ...choices, [current.id]: chosen }
    if (index + 1 < evolutions.length) {
      setChoices(all)
      setIndex(index + 1)
      setStep(firstStep)
      setCursor(0)
      return
    }
    onDone(all)
  }
  const choose = (target: string) => {
    setChoices({ ...choices, [current.id]: target })
    setFrame(0)
    setStep('animating')
  }
  // La ventana de formas (como la de la maqueta: derecha, a media altura), con tantas filas como formas.
  const windowWidth = optionsWidth(current.targets.map(nameOf))

  return (
    <div className="evolution-screen">
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="scene" className="evolution-scene">
          <div className="moves-black" />
          {row >= 0 && <div className="evolution-bg" style={{ left: 0, top: 0, width: 240, height: 112, backgroundImage: `url("${emeraldTheme.asset('evolucion-fondo')}")`, backgroundPosition: `0 ${-160 * row}px` }} />}
          {/* El destello blanco de la lluvia funde el fondo (paletas de fondo 2–4 y 10), no la caja de mensajes. */}
          {flash > 0 && <div className="evolution-flash" style={{ left: 0, top: 0, width: 240, height: 112, opacity: flash }} />}
          {scales ? (
            <>
              <img className="mon-front evolution-silhouette" src={emeraldSprite('front', current.species)} alt="" style={{ left: 88, top: sceneSpriteTop(current.species), transform: `scale(${scales[0] / 256})` }} />
              <img className="mon-front evolution-silhouette" src={emeraldSprite('front', chosen)} alt="" style={{ left: 88, top: sceneSpriteTop(chosen), transform: `scale(${scales[1] / 256})` }} />
            </>
          ) : (
            <>
              <img className="mon-front" src={emeraldSprite('front', shownSpecies)} alt="" style={{ left: 88, top: sceneSpriteTop(shownSpecies) }} />
              {white > 0 && <img className="mon-front evolution-silhouette" src={emeraldSprite('front', shownSpecies)} alt="" style={{ left: 88, top: sceneSpriteTop(shownSpecies), opacity: white }} />}
            </>
          )}
          {/* Destellos (evo_sparkle.png, prioridad 1: siempre delante del Pokémon, de prioridad 2); su paleta también se funde a blanco. */}
          {animation?.sparkles.map((sparkle, i) => (
            <img key={i} className="evolution-sparkle" src={emeraldTheme.asset('evolucion-destello')} alt=""
              style={{ left: sparkle.x - 4, top: sparkle.y - 4, transform: sparkle.scale === 1 ? undefined : `scale(${sparkle.scale})`, filter: flash > 0 ? `brightness(${1 + 4 * flash})` : undefined }} />
          ))}
          <img src={emeraldTheme.asset('combate-caja-mensaje')} alt="" style={{ left: 0, top: 112 }} />
          {lines.map((line, i) => <GameText key={i} text={line} x={16} y={121 + 16 * i} color="combate-mensaje" hidden />)}
          {(step === 'evolving' || step === 'evolved') && lines.length > 0 && (
            <MessageArrow x={16 + textWidth(emeraldTheme.font as BitmapFont, lines[lines.length - 1]) + 1} y={120 + 16 * (lines.length - 1)} />
          )}
          {step === 'choose' ? (
            <GameWindow x={28 - windowWidth} y={13 - current.targets.length * 2} width={windowWidth} height={current.targets.length * 2}>
              <div role="menu" aria-label={message}>
                {current.targets.map((target, i) => (
                  <button key={target} type="button" role="menuitem" className="team-menu-item" style={{ left: 0, top: i * 16, width: windowWidth * 8, height: 16 }}
                    aria-label={t.optionLabel(nameOf(target))} autoFocus={i === cursor} onFocus={() => setCursor(i)} onPointerEnter={(event) => event.currentTarget.focus()} onClick={() => choose(target)}>
                    <GameText text={'▶'} y={1} hidden />
                    <GameText text={nameOf(target)} x={8} y={1} hidden />
                  </button>
                ))}
              </div>
            </GameWindow>
          ) : (
            <button type="button" className="result-continue" style={{ left: 0, top: 0, width: 240, height: 160 }} aria-label={t.continueLabel(message)} onClick={advance} />
          )}
          <p className="sr-only" role="status">{message}</p>
        </div>
      ), (
        <div key="party" className="evolution-party">
          <img src={emeraldTheme.asset('equipo-fondo')} alt="" style={{ left: 0, top: 0 }} />
          <div style={{ left: 8, top: 24, width: 80, height: 56 }} aria-hidden="true">
            <PartySlot i={0} mon={{ species: shownSpecies, name: nameOf(shownSpecies), level: current.level, hp: hpOf(current.id, shownSpecies), maxHp: hpOf(current.id, shownSpecies) }} state="activa" bounce />
          </div>
          <GameWindow x={1} y={17} width={21} height={2}>
            <GameText text={t.progress(index + 1, evolutions.length)} y={1} width={168} fit />
          </GameWindow>
        </div>
      )]} />
    </div>
  )
}
