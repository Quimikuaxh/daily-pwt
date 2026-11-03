import { es } from '../../i18n/es'
import type { SoundPrefs } from '../../storage/settings'

const text = es.settings

type SoundSettingsProps = {
  settings: SoundPrefs
  onChange: (sound: SoundPrefs) => void
  /** Sin el rótulo «Sonido» cuando la ventana ya se llama así (botón Sonido del combate). */
  showTitle?: boolean
}

/** Activado/Silenciado y deslizador de volumen (DEC-57): en Ajustes y en el botón Sonido del combate, guardados en los mismos ajustes. */
export function SoundSettings({ settings, onChange, showTitle = true }: SoundSettingsProps) {
  return (
    <section className="settings-section">
      {showTitle && <h3 className="help-title" id="settings-sound">{text.soundTitle}</h3>}
      <div className="settings-options" role="group" aria-labelledby={showTitle ? 'settings-sound' : undefined} aria-label={showTitle ? undefined : text.soundTitle}>
        {[true, false].map((on) => (
          <button
            key={String(on)}
            type="button"
            className="btn btn-small settings-option"
            aria-pressed={settings.sound === on}
            onClick={() => onChange({ ...settings, sound: on })}
          >
            {on ? text.soundOn : text.soundOff}
          </button>
        ))}
      </div>
      <label className="settings-volume">
        <span>{text.volumeLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={settings.volume}
          aria-valuetext={text.volumeValue(settings.volume)}
          onChange={(event) => onChange({ ...settings, volume: Number(event.currentTarget.value) })}
        />
        <output className="settings-volume-value" aria-hidden="true">{text.volumeValue(settings.volume)}</output>
      </label>
      <p className="settings-hint">{text.soundHint}</p>
      {/* Música de vida baja y tema del último Pokémon (Jose, 03/11/2026): cada una con su Sí / No. */}
      {(['pinchMusic', 'lastPokemonMusic'] as const).map((key) => (
        <div key={key} className="settings-music">
          <span id={`settings-${key}`}>{key === 'pinchMusic' ? text.pinchMusicTitle : text.lastPokemonMusicTitle}</span>
          <div className="settings-options" role="group" aria-labelledby={`settings-${key}`}>
            {[true, false].map((on) => (
              <button key={String(on)} type="button" className="btn btn-small settings-option" aria-pressed={settings[key] === on} onClick={() => onChange({ ...settings, [key]: on })}>
                {on ? text.musicOn : text.musicOff}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="settings-hint">{text.specialMusicHint}</p>
    </section>
  )
}
