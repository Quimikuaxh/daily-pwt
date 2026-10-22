import { JSDOM } from 'jsdom'

const clean = (text) => text.replace(/[ \s]+/g, ' ').trim()
const GENDER_CLASSES = { macho: 'M', hembra: 'F' }

function parsePokemonBlock(block) {
  const genders = [...block.querySelectorAll('.sexo > span')].map((span) => GENDER_CLASSES[span.className]).filter(Boolean)
  const abilityText = clean(block.querySelector('.e-d-hab .val')?.textContent ?? '')
  return {
    species: clean(block.querySelector('.nombre')?.textContent ?? ''),
    item: clean(block.querySelector('.e-d-obj .val')?.textContent ?? '') || null,
    types: [...block.querySelectorAll('.pri-tipo img')].map((image) => clean(image.getAttribute('alt') ?? '').replace(/^Tipo /, '')),
    abilities: abilityText ? abilityText.split(/ o | \/ /) : [],
    moves: [...block.querySelectorAll('.mov')].map((move) => clean(move.textContent)),
    level: Number(/(\d+)/.exec(block.querySelector('.nivel')?.textContent ?? '')?.[1]),
    ...(genders.length === 1 ? { gender: genders[0] } : {}),
  }
}

/**
 * Equipos de una página de torneo de WikiDex (nombres en español). Cada entrenador es un encabezado cuyo contenido
 * son bloques `.equipo2 .e-pokemon`. `group` es el último encabezado superior (p. ej. «Expertos en Pokémon de tipo acero»).
 */
export function parseWikidex(html) {
  const document = new JSDOM(html).window.document
  const entries = []
  let current = null
  let currentGroup = null
  let inParticipants = false
  for (const element of document.querySelectorAll('h2, h3, h4, .e-pokemon')) {
    if (element.matches('h2, h3, h4')) {
      const headline = element.querySelector('.mw-headline')
      if (!headline) continue
      const title = clean(headline.textContent)
      if (element.tagName === 'H2') {
        inParticipants = title === 'Participantes'
        current = null
        currentGroup = null
      } else if (inParticipants && /^(Líderes de|Expertos en)/.test(title)) {
        currentGroup = title
        current = null
      } else if (inParticipants) {
        current = { trainer: title, anchor: headline.id, group: currentGroup, alwaysLeadsWith: null, team: [] }
        entries.push(current)
      }
    } else if (current) {
      current.team.push(parsePokemonBlock(element))
    }
  }
  return entries
}
