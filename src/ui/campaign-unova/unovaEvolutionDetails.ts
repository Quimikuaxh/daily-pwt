import type { CampaignDefinition } from '../../core/nuzlocke/campaign'
import { campaignRules } from '../../core/nuzlocke/rules'
import type { GameData } from '../../core/types'
import { esUnova } from '../../i18n/esUnova'

const rules = campaignRules('unova-n2b2')
const t = esUnova.evolutionDetails

export function unovaEvolutionDetails(definition: CampaignDefinition, data: GameData, species: string) {
  const progression = definition.species[species]
  return progression?.evolutions.flatMap(({ method, parameter, target }) => {
    const level = Number(parameter)
    const item = data.names.items[String(parameter)] ?? String(parameter)
    const move = data.names.moves[String(parameter)] ?? String(parameter)
    const requirement = (() => {
      switch (method) {
        case 'LEVEL':
        case 'LEVEL_NINJASK': return t.level(level)
        case 'LEVEL_MALE': return t.levelGender(level, t.male)
        case 'LEVEL_FEMALE': return t.levelGender(level, t.female)
        case 'LEVEL_ATK_GT_DEF':
        case 'LEVEL_ATK_LT_DEF':
        case 'LEVEL_ATK_EQ_DEF': return t.levelTest(level, t.choice)
        case 'LEVEL_SILCOON':
        case 'LEVEL_CASCOON': return t.levelTest(level, t.byPokemon)
        case 'ITEM': return item
        case 'ITEM_MALE': return t.itemTest(item, t.male)
        case 'ITEM_FEMALE': return t.itemTest(item, t.female)
        case 'TRADE_ITEM': return t.itemTest(item, t.level(rules.tradeLevel))
        case 'TRADE':
        case 'TRADE_SPECIES':
        case 'LEVEL_PARTY': return t.level(rules.tradeLevel)
        case 'LEVEL_ITEM_DAY': return t.itemTest(item, t.day)
        case 'LEVEL_ITEM_NIGHT': return t.itemTest(item, t.night)
        case 'FRIENDSHIP': return t.wins(rules.friendshipWins)
        case 'FRIENDSHIP_DAY': return t.itemTest(t.wins(rules.friendshipWins), t.day)
        case 'FRIENDSHIP_NIGHT': return t.itemTest(t.wins(rules.friendshipWins), t.night)
        case 'LEVEL_MOVE': {
          const entry = progression.levelUp.find((entry) => entry.move === parameter)
          return entry ? t.moveAt(move, entry.level) : t.move(move)
        }
        case 'LOCATION': {
          const location = rules.locations[String(parameter)]
          if (location === null) return t.league
          const index = location ? rules.milestones.indexOf(location) : -1
          const rival = definition.encounters[index - 1]
          return rival && 'nameEs' in rival && typeof rival.nameEs === 'string' ? t.after(rival.nameEs) : null
        }
        default: return null
      }
    })()
    return requirement ? [{ species: target, name: data.names.species[target] ?? target, requirement }] : []
  }) ?? []
}
