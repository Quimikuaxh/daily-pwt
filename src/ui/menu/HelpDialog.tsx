import { esHelp } from '../../i18n/esHelp'
import { Modal } from '../common/Modal'

const text = esHelp

/** Ayuda (PRD §10.5): cómo se juega, reglas, mecánicas de 5.ª generación, consejos, créditos y aviso legal. */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={text.title} onClose={onClose} className="help-dialog">
      {text.sections.map((section) => (
        <section key={section.title} className="help-section">
          <h3 className="help-title">{section.title}</h3>
          <ul className="help-list">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <section className="help-section">
        <h3 className="help-title">{text.creditsTitle}</h3>
        <ul className="help-list">
          {text.credits.map((credit) => (
            <li key={credit}>{credit}</li>
          ))}
        </ul>
      </section>
      <section className="help-section">
        <h3 className="help-title">{text.legalTitle}</h3>
        <p className="help-legal">{text.legal}</p>
      </section>
    </Modal>
  )
}
