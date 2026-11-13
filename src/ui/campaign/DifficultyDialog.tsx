/**
 * Dificultad al empezar una campaña (PRD §0, 13/11/2026): dos selectores separados, la IA de los rivales y los Pokémon que salen en el
 * draft, cada uno Fácil / Normal / Difícil (Normal marcado de entrada), y EMPEZAR. Va dentro de la página de la campaña (fija sobre
 * ella) para heredar el marco de los botones (`--campaign-frame`).
 */
import { useEffect, useRef, useState } from 'react'
import { DIFFICULTIES, type CampaignDifficulty, type Difficulty } from '../../core/nuzlocke/campaign'
import { esCampaign } from '../../i18n/esCampaign'

const t = esCampaign.difficulty

export function DifficultyDialog({ onStart, onCancel }: { onStart: (difficulty: CampaignDifficulty) => void; onCancel: () => void }) {
  const [choice, setChoice] = useState({ ai: 'normal', draft: 'normal' } as CampaignDifficulty)
  const first = useRef(null as HTMLButtonElement | null)
  useEffect(() => { first.current?.focus() }, [])
  const group = (key: keyof CampaignDifficulty) => { return (
    <fieldset className="campaign-difficulty-group">
      <legend>{t.groups[key]}</legend>
      <div className="campaign-difficulty-options">
        {DIFFICULTIES.map((level: Difficulty) => (
          <button key={level} type="button" className="campaign-restart" aria-pressed={choice[key] === level}
            onClick={() => { setChoice({ ...choice, [key]: level }) }}>
            {t.levels[level]}
          </button>
        ))}
      </div>
      <p className="campaign-difficulty-hint">{t.hints[key][choice[key]]}</p>
    </fieldset>
  ) }
  return (
    <div className="campaign-difficulty-backdrop" onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }}>
      <div className="campaign-difficulty" role="dialog" aria-modal="true" aria-label={t.title}>
        <h2>{t.title}</h2>
        {group('ai')}
        {group('draft')}
        <div className="campaign-difficulty-actions">
          <button ref={first} type="button" className="campaign-action" onClick={() => { onStart(choice) }}>{t.start}</button>
          <button type="button" className="campaign-restart" onClick={onCancel}>{t.cancel}</button>
        </div>
      </div>
    </div>
  )
}
