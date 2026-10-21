import { describe, it, expect } from 'vitest'
import { importScript, readJson } from '../test-utils/paths'

// UT-33 · DEC-07. Lo versionado en src/generated/* y data/player-sets.json debe ser igual a regenerarlo EN MEMORIA.
// TODO-CONTRATO (scripts, sin efectos al importarlos: solo ejecutan main cuando se lanzan por CLI):
//   scripts/build-dex.mjs         export function buildDex(): DexData
//   scripts/build-names-es.mjs    export async function buildNamesEs({ offline: true }): Promise<NamesEs>
//        (offline = usa el CSV de PokeAPI ya vendorizado/cacheado; los tests no hacen red) + data/names-es-overrides.json
//   scripts/build-player-sets.mjs export function buildPlayerSets(trainers: Trainer[]): PokemonSet[]
// Si regenerar cambia el resultado, hay que ejecutar `npm run gen` y versionar el cambio.
describe('datos generados al día', () => {
  it('dex-gen5.json es igual a su regeneración', async () => {
    const { buildDex } = await importScript('scripts/build-dex.mjs')
    expect(JSON.parse(JSON.stringify(buildDex()))).toEqual(readJson('src', 'generated', 'dex-gen5.json'))
  })

  it('names-es.json es igual a su regeneración', async () => {
    const { buildNamesEs } = await importScript('scripts/build-names-es.mjs')
    expect(JSON.parse(JSON.stringify(await buildNamesEs({ offline: true })))).toEqual(readJson('src', 'generated', 'names-es.json'))
  })

  it('player-sets.json es igual a su regeneración desde trainers.json', async () => {
    const { buildPlayerSets } = await importScript('scripts/build-player-sets.mjs')
    const trainers = readJson('data', 'trainers.json').trainers
    expect(JSON.parse(JSON.stringify(buildPlayerSets(trainers)))).toEqual(readJson('data', 'player-sets.json'))
  })

  it('regenerar dos veces da exactamente lo mismo (determinista)', async () => {
    const { buildDex } = await importScript('scripts/build-dex.mjs')
    expect(JSON.stringify(buildDex())).toBe(JSON.stringify(buildDex()))
  })

  it('el dex generado trae la tabla de tipos de Gen 5 sin Hada', async () => {
    const dex = readJson('src', 'generated', 'dex-gen5.json')
    expect(Object.keys(dex.typeChart)).toHaveLength(17)
    expect(Object.keys(dex.typeChart)).not.toContain('Fairy')
  })

  it('el dex generado marca Onix como no totalmente evolucionado', () => {
    expect(readJson('src', 'generated', 'dex-gen5.json').species.onix.nfe).toBe(true)
  })

  it('el dex generado marca Garchomp como totalmente evolucionado', () => {
    expect(readJson('src', 'generated', 'dex-gen5.json').species.garchomp.nfe).toBe(false)
  })

  it('el dex generado tiene spriteId para cada especie', () => {
    const dex = readJson('src', 'generated', 'dex-gen5.json')
    expect(Object.values(dex.species).filter((s: any) => !s.spriteId)).toEqual([])
  })
})

// Datos de las pantallas de equipo y de datos (iconos de menú, descripciones en español, cajas de sprites).
describe('datos de la pantalla de equipo y de datos', () => {
  const trainers = () => readJson('data', 'trainers.json').trainers as { variants: { team: { species: string; moves: string[]; abilities?: string[]; ability?: string }[] }[] }[]
  const usedSets = () => [...trainers().flatMap((trainer) => trainer.variants.flatMap((variant) => variant.team)), ...readJson<any[]>('data', 'player-sets.json')]

  it('icon-index.json es igual a su regeneración y cubre todas las especies base de Gen 5', async () => {
    const { buildIconIndex } = await importScript('scripts/build-icon-index.mjs')
    const generated = readJson('src', 'generated', 'icon-index.json')
    expect(JSON.parse(JSON.stringify(buildIconIndex()))).toEqual(generated)
    expect(Object.keys(generated).length).toBeGreaterThanOrEqual(649)
  })

  it('battle-ui-images.json (precarga de la interfaz) es igual a su regeneración', async () => {
    const { buildBattleUiIndex } = await importScript('scripts/build-battle-ui-index.mjs')
    expect(buildBattleUiIndex()).toEqual(readJson('src', 'generated', 'battle-ui-images.json'))
  })

  it('toda especie usada en el juego tiene icono dentro de la hoja de Showdown (12 columnas, 4110 px de alto)', () => {
    const iconIndex = readJson('src', 'generated', 'icon-index.json')
    const dex = readJson('src', 'generated', 'dex-gen5.json')
    const rows = Math.floor(4110 / 30)
    for (const set of usedSets()) {
      const spriteId = dex.species[set.species].spriteId
      expect(iconIndex[spriteId], spriteId).toBeGreaterThan(0)
      expect(Math.floor(iconIndex[spriteId] / 12), spriteId).toBeLessThan(rows)
    }
  })

  it('descriptions-es.json es igual a su regeneración (CSV de PokeAPI en caché)', async () => {
    const { buildDescriptionsEs } = await importScript('scripts/build-descriptions-es.mjs')
    expect(JSON.parse(JSON.stringify(await buildDescriptionsEs({ offline: true })))).toEqual(readJson('src', 'generated', 'descriptions-es.json'))
  })

  it('todo movimiento y habilidad de los equipos tiene descripción en español, sin inglés ni saltos de línea', () => {
    const descriptions = readJson('src', 'generated', 'descriptions-es.json')
    const names = readJson('src', 'generated', 'names-es.json')
    for (const set of usedSets()) {
      for (const moveId of set.moves) expect(descriptions.moves[moveId], `movimiento ${moveId}`).toBeTruthy()
      for (const abilityId of set.abilities ?? [set.ability as string]) expect(descriptions.abilities[abilityId], `habilidad ${abilityId}`).toBeTruthy()
    }
    for (const text of [...Object.values<string>(descriptions.moves), ...Object.values<string>(descriptions.abilities)]) expect(text).not.toMatch(/[\n­]|\s{2,}/)
    expect(Object.keys(names.moves).length).toBeGreaterThan(0)
  })

  it('sprite-boxes.json es igual a su regeneración y tiene la caja de todos los sprites del repo', async () => {
    const { buildSpriteBoxes } = await importScript('scripts/build-sprite-boxes.mjs')
    const generated = readJson('src', 'generated', 'sprite-boxes.json')
    expect(JSON.parse(JSON.stringify(buildSpriteBoxes()))).toEqual(generated)
    expect(Object.keys(generated.back).length).toBeGreaterThanOrEqual(33)
    expect(Object.keys(generated.front).length).toBeGreaterThanOrEqual(33)
  })
})
