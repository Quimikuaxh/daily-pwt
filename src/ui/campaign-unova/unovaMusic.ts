/** Audio de Teselia: metadatos separados del diario y de Hoenn (E2E-21); solo se descarga la pista de la pantalla en curso. */
import { getAudio, SFX_IDS } from '../../audio/audio'
import type { AudioIndex } from '../../audio/audioEngine'
import unovaAudio from '../../generated/unova/audio-index.json'
import type { CampaignMusic, CampaignSounds } from '../campaign/campaignMusic'

const TOWNS: Record<string, string> = {
  cheren: 'aspertia', hiedra: 'virbank', camus: 'castelia', camila: 'nimbasa',
  yakon: 'driftveil', gerania: 'mistralton', lirio: 'opelucid', ciprian: 'humilau',
}

export const unovaMusic: CampaignMusic = {
  town: (id) => `unova-town-${TOWNS[id] ?? 'league'}`,
  battle: (kind) => kind === 'gym' ? 'gym-unova' : kind === 'champion' ? 'champion-unova' : 'unova-elite',
  // El Alto Mando comparte la victoria de gimnasio: no hay una victoria específica suya en el OST.
  result: (mode) => mode === 'medal' || mode === 'beaten' ? 'unova-gym-victory' : mode === 'hallOfFame' ? 'unova-hall-of-fame' : null,
  evolution: 'unova-evolution',
  evolved: 'unova-evolved',
  credits: 'unova-credits',
  register: () => getAudio().register(unovaAudio as Partial<AudioIndex>),
}

/** Equivalentes de N2/B2 ya usados por el diario; sin pitido, ataques ni destellos de Esmeralda. Gritos de Showdown, como el diario. */
export const unovaSounds: CampaignSounds = {
  battleIds: SFX_IDS,
  // La bola la sincroniza useBallSounds; el presentador no debe tocarla una segunda vez.
  sfxFor: (id) => id === 'ball-throw' || id === 'ball-open' ? null : id,
  select: 'menu-select', ballThrow: 'ball-throw', ballOpen: 'ball-open', lowHealth: null,
  playSfx: (id) => getAudio().playSfx(id),
  preloadSfx: (ids) => getAudio().preload([], ids),
  playCry: (species, faint = false) => getAudio().playCry(species, { faint }),
  preloadCries: (species) => getAudio().preload([], [], species),
  moveSoundIds: () => [],
  playMoveSounds: () => () => {},
}
