import { JSDOM } from 'jsdom'

const clean = (text) => text.replace(/[ \s]+/g, ' ').trim()

/**
 * Equipos de una página de torneo de Serebii: una tabla `table.trainer` por entrenador con filas de especies, niveles,
 * ataques («Attacks») y objetos («Hold Item»). Serebii no publica habilidades ni género.
 */
export function parseSerebii(html) {
  const document = new JSDOM(html).window.document
  return [...document.querySelectorAll('table.trainer')].map((table) => {
    const nameCell = [...table.querySelectorAll('td')].find((cell) => /^Pokémon Trainer /.test(clean(cell.textContent)))
    if (!nameCell) throw new Error('Tabla de entrenador de Serebii sin nombre')
    const speciesCells = [...nameCell.parentElement.querySelectorAll('td')].slice(1)
    const levelCells = [...table.querySelectorAll('td.level')]
    const moveCells = [...table.querySelectorAll('td.bor')].filter((cell) => /^Attacks/.test(clean(cell.textContent)))
    const itemCells = [...table.querySelectorAll('td.bor')].filter((cell) => /^Hold Item/.test(clean(cell.textContent)))
    const team = speciesCells.map((cell, index) => ({
      species: clean(cell.textContent),
      item: clean(itemCells[index]?.textContent.replace(/^Hold Item:?/, '') ?? '') || null,
      abilities: [],
      moves: [...(moveCells[index]?.querySelectorAll('a') ?? [])].map((link) => clean(link.textContent)),
      level: Number(/(\d+)/.exec(levelCells[index]?.textContent ?? '')?.[1]),
    }))
    return { trainer: clean(nameCell.textContent).replace(/^Pokémon Trainer /, ''), anchor: null, alwaysLeadsWith: null, team }
  })
}
