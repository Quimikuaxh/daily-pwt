import { Dex } from '@pkmn/dex'
import { Generations } from '@pkmn/data'

export const gen5 = new Generations(Dex).get(5)
export const toId = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
