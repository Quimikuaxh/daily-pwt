import { describe, it, expect } from 'vitest'
import { importScript } from '../src/test-utils/paths'

const bulbapediaPage = `
<h2><span class="mw-headline" id="Participants">Participants</span></h2>
<h3><span class="mw-headline" id="Brock">Brock</span></h3>
<p>Brock always leads with <a href="/wiki/Onix_(Pok%C3%A9mon)" title="Onix (Pokémon)">Onix</a>.</p>
<div class="PKMNcontainer"><div class="PKMNbox">
  <div class="PKMNnamebox"><b><a title="Onix (Pokémon)"><span>Onix</span></a></b><span class="PKMNmale">♂</span>/<span class="PKMNfemale">♀</span><span class="PKMNlevel"> <span class="PKMNsmall">Lv.</span>50</span></div>
  <div class="PKMNright"><div><a title="Rock (type)"><span>Rock</span></a><a title="Ground (type)"><span>Ground</span></a></div>
  <div class="PKMNability"><b><a title="Rock Head (Ability)"><span>Rock Head</span></a></b> or <b><a title="Sturdy (Ability)"><span>Sturdy</span></a></b></div>
  <div class="PKMNheld"><b><a title="Eviolite"><span>Eviolite</span></a></b></div>
  <div class="PKMNmovename"><a title="Stone Edge (move)"><span>Stone Edge</span></a></div>
  <div class="PKMNmovename"><a title="Earthquake (move)"><span>Earthquake</span></a></div>
  <div class="PKMNmovename"><a title="Iron Head (move)"><span>Iron Head</span></a></div>
  <div class="PKMNmovename"><a title="Sandstorm (move)"><span>Sandstorm</span></a></div>
</div></div></div>
<h2><span class="mw-headline" id="Trivia">Trivia</span></h2>
<h3><span class="mw-headline" id="Ignored">Ignored</span></h3>`

const wikidexPage = `
<h2><span class="mw-headline" id="Participantes">Participantes</span></h2>
<h3><span class="mw-headline" id="Expertos_en_Pokémon_de_tipo_roca">Expertos en Pokémon de tipo roca</span></h3>
<h4><span class="mw-headline" id="Brock">Brock</span></h4>
<div class="e-pokemon"><span class="nombre"><a>Onix</a></span><span class="sexo"><span class="macho">♂</span>/<span class="hembra">♀</span></span><span class="nivel">Nv. 50</span>
  <div class="e-d-movs"><div class="mov">Roca afilada</div><div class="mov">Terremoto</div><div class="mov">Cabeza de hierro</div><div class="mov">Tormenta arena</div></div>
  <div class="e-d-hab"><div class="val">Cabeza roca o robustez</div></div><div class="e-d-obj"><div class="val">Mineral evolutivo</div></div></div>`

const serebiiPage = `<table class="trainer"><tr><td class="tcol"></td></tr>
<tr><td>Pokémon Trainer Brock </td><td><a>Onix</a></td></tr>
<tr><td class="level">Level 50</td></tr>
<tr><td valign="top" class="bor"><b>Attacks</b>:<br /><a>Stone Edge</a><br /><a>Earthquake</a><br /><a>Iron Head</a><br /><a>Sandstorm</a></td></tr>
<tr><td valign="top" class="bor"><b>Hold Item</b>:<br /><a>Eviolite</a></td></tr></table>`

describe('extractores del PWT (scripts/lib/pwt-parse-*.mjs)', () => {
  it('Bulbapedia: entrenador, equipo, habilidades en orden, sin género si salen ambos y «always leads with»', async () => {
    const { parseBulbapedia } = await importScript('scripts/lib/pwt-parse-bulbapedia.mjs')
    const entries = parseBulbapedia(bulbapediaPage)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ trainer: 'Brock', anchor: 'Brock', alwaysLeadsWith: 'Onix' })
    expect(entries[0].team).toEqual([{ species: 'Onix', item: 'Eviolite', types: ['Rock', 'Ground'], abilities: ['Rock Head', 'Sturdy'], moves: ['Stone Edge', 'Earthquake', 'Iron Head', 'Sandstorm'], level: 50 }])
  })

  it('WikiDex: separa habilidades «A o B» y agrupa por tipo', async () => {
    const { parseWikidex } = await importScript('scripts/lib/pwt-parse-wikidex.mjs')
    const entries = parseWikidex(wikidexPage)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ trainer: 'Brock', group: 'Expertos en Pokémon de tipo roca' })
    expect(entries[0].team[0]).toMatchObject({ species: 'Onix', item: 'Mineral evolutivo', abilities: ['Cabeza roca', 'robustez'], level: 50 })
  })

  it('Serebii: especies, ataques y objeto sin habilidades', async () => {
    const { parseSerebii } = await importScript('scripts/lib/pwt-parse-serebii.mjs')
    const entries = parseSerebii(serebiiPage)
    expect(entries).toHaveLength(1)
    expect(entries[0].trainer).toBe('Brock')
    expect(entries[0].team[0]).toEqual({ species: 'Onix', item: 'Eviolite', abilities: [], moves: ['Stone Edge', 'Earthquake', 'Iron Head', 'Sandstorm'], level: 50 })
  })
})

describe('roster y normalización del PWT', () => {
  it('el roster tiene 53 entrenadores con ids únicos en minúsculas sin tildes', async () => {
    const { ROSTER } = await importScript('scripts/lib/pwt-roster.mjs')
    expect(ROSTER).toHaveLength(53)
    expect(new Set(ROSTER.map((trainer: { id: string }) => trainer.id)).size).toBe(53)
    expect(ROSTER.every((trainer: { id: string }) => /^[a-z]+(-[a-z]+)*$/.test(trainer.id))).toBe(true)
    expect(ROSTER.filter((trainer: { category: string }) => trainer.category === 'leader')).toHaveLength(46)
  })

  it('resuelve nombres ingleses y españoles a ids de @pkmn', async () => {
    const { speciesIdFromEnglish, idFromEnglish, spanishToIds, loadNameAliases } = await importScript('scripts/lib/pwt-normalize.mjs')
    expect(speciesIdFromEnglish('Nidoran♀')).toBe('nidoranf')
    expect(idFromEnglish('items', 'Light Ball')).toBe('lightball')
    expect(idFromEnglish('moves', 'Hidden Power Fire')).toBe('hiddenpowerfire')
    expect(idFromEnglish('moves', 'Inventado')).toBeNull()
    expect(spanishToIds('items', 'Bolaluminosa', loadNameAliases())).toEqual(['lightball'])
  })
})

describe('fusión de las fuentes del PWT (datos fijados en data/pwt-raw)', () => {
  it('distingue las formas por tipo: Rotom Eléctrico/Fuego es Rotom-Heat', async () => {
    const { refineSpeciesForm } = await importScript('scripts/lib/pwt-normalize.mjs')
    expect(refineSpeciesForm('rotom', ['Electric', 'Fire'], ['levitate'])).toEqual({ id: 'rotomheat', certain: true })
    expect(refineSpeciesForm('rotom', ['Electric', 'Ghost'], ['levitate'])).toEqual({ id: 'rotom', certain: true })
    expect(refineSpeciesForm('castform', ['Normal'], ['forecast'])).toEqual({ id: 'castform', certain: true })
  })

  it('genera los 53 entrenadores sin variantes descartadas y reproduce los ya cargados a mano', async () => {
    const { mergePwt } = await importScript('scripts/merge-pwt.mjs')
    const { trainers, notes } = mergePwt()
    expect(trainers).toHaveLength(53)
    expect(notes.trainersWithoutVariants).toEqual([])
    expect(notes.skippedVariants).toEqual([])
    expect(notes.missingSpanishNames).toEqual([])
    expect(notes.regression.differences).toEqual([])
    expect(trainers.every((trainer: { variants: unknown[] }) => trainer.variants.length >= 1)).toBe(true)
  })
})
