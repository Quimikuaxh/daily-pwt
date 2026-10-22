import { JSDOM } from 'jsdom'

const clean = (text) => text.replace(/[ \s]+/g, ' ').trim()
const GENDER_SYMBOLS = { '♂': 'M', '♀': 'F' }

/** Tipos mostrados (sin «Unknown», que la plantilla antigua usa como segundo tipo vacío). Distinguen las formas de Rotom. */
const typesIn = (root) => [...new Set([...root.querySelectorAll('a[title$="(type)"]')].map((link) => clean(link.textContent)).filter((type) => type !== 'Unknown'))]

function parsePokemonTable(container) {
  const itemTable = [...container.querySelectorAll('table')].find((table) => /Held item:/.test(table.textContent))
  const abilityTable = [...container.querySelectorAll('table')].find((table) => /Ability:/.test(table.textContent))
  const nameCell = [...container.querySelectorAll('td')].find((cell) => /Lv\./.test(cell.textContent) && !cell.querySelector('table'))
  const speciesLink = nameCell?.querySelector('a[title]')
  if (!itemTable || !abilityTable || !speciesLink) throw new Error('Bloque de Pokémon con estructura inesperada')

  const itemLink = [...itemTable.querySelectorAll('a[title]')].find((link) => !link.classList.contains('image'))
  const genderSymbols = [...nameCell.querySelectorAll('span')].map((span) => clean(span.textContent)).filter((text) => text in GENDER_SYMBOLS)
  const genders = [...new Set(genderSymbols)]
  return {
    species: clean(speciesLink.textContent),
    item: itemLink ? clean(itemLink.textContent) : null,
    types: typesIn([...container.querySelectorAll('table')].find((table) => /Types?:/.test(table.textContent) && !table.querySelector('table'))),
    abilities: [...abilityTable.querySelectorAll('a[title$="(Ability)"]')].map((link) => clean(link.textContent)),
    moves: [...container.querySelectorAll('a[title$="(move)"]')].map((link) => clean(link.textContent)),
    level: Number(/Lv\.\s*(\d+)/.exec(nameCell.textContent)?.[1]),
    ...(genders.length === 1 ? { gender: GENDER_SYMBOLS[genders[0]] } : {}),
  }
}

function parsePartyBox(box) {
  const nameBox = box.querySelector('.PKMNnamebox')
  const genders = [...nameBox.querySelectorAll('.PKMNmale, .PKMNfemale')].map((span) => GENDER_SYMBOLS[clean(span.textContent)])
  return {
    species: clean(nameBox.querySelector('b a')?.textContent ?? ''),
    item: clean(box.querySelector('.PKMNheld b a')?.textContent ?? '') || null,
    types: typesIn(box.querySelector('.PKMNright > div')),
    abilities: [...box.querySelectorAll('.PKMNability b a')].map((link) => clean(link.textContent)),
    moves: [...box.querySelectorAll('.PKMNmovename a')].map((link) => clean(link.textContent)),
    level: Number(/Lv\.\s*(\d+)/.exec(clean(box.querySelector('.PKMNlevel')?.textContent ?? ''))?.[1]),
    ...(genders.length === 1 ? { gender: genders[0] } : {}),
  }
}

/**
 * Equipos de una página de torneo de Bulbapedia (HTML renderizado): un h3 por entrenador dentro de «Participants»,
 * con un bloque por Pokémon (plantilla de tablas antigua o `.PKMNcontainer`) y, a veces, la frase «X always leads with Y».
 */
export function parseBulbapedia(html) {
  const document = new JSDOM(html).window.document
  const containers = new Set(
    [...document.querySelectorAll('table')]
      .filter((table) => !table.querySelector('table') && /Held item:/.test(table.textContent))
      .map((itemTable) => itemTable.parentElement.closest('table') ?? itemTable),
  )
  const entries = []
  let inParticipants = false
  let current = null
  for (const element of document.querySelectorAll('h2, h3, p, table, .PKMNcontainer')) {
    if (element.tagName === 'H2') {
      inParticipants = clean(element.textContent).replace(/\[.*\]$/, '') === 'Participants'
      current = null
    } else if (element.tagName === 'H3' && inParticipants) {
      const headline = element.querySelector('.mw-headline')
      current = { trainer: clean(headline.textContent), anchor: headline.id, alwaysLeadsWith: null, team: [] }
      entries.push(current)
    } else if (element.tagName === 'P' && current) {
      const leadsWith = /always leads with (.+?)\./.exec(clean(element.textContent))
      if (leadsWith) current.alwaysLeadsWith = leadsWith[1].trim()
    } else if (element.tagName === 'TABLE' && current && containers.has(element)) {
      current.team.push(parsePokemonTable(element))
    } else if (current && element.classList.contains('PKMNcontainer')) {
      current.team.push(parsePartyBox(element))
    }
  }
  return entries
}
