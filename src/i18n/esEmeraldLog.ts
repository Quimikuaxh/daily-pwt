/**
 * Frases de los mensajes del combate de la campaña de Hoenn, al estilo de la edición española de Esmeralda (DEC-97): sobre las del reto
 * diario (`es.log`) cambian las que el juego dice de otra forma, a partir de src/battle_message.c de pret/pokeemerald (edición inglesa;
 * no hay fuente de los textos españoles del juego). Nombres en mayúsculas (los títulos, no: «la Líder»), el rival como «GEODUDE enemigo», características en mayúsculas
 * y pasado simple («se debilitó», «subió»). Las demás frases se quedan como en el diario.
 */
import { es } from './es'
import type { BattleLog } from '../battle/translate'

const base = es.log

/** «La Defensa» → «La DEFENSA»: el artículo en minúscula y la característica en mayúsculas, como el juego. */
const statWord = (stat: string): string => stat.replace(/^(El|La)\s+(.*)$/, (_, article: string, rest: string) => `${article} ${rest.toUpperCase()}`)

export const emeraldLog: BattleLog = {
  ...base,
  rivalMon: (mon: string) => `${mon} enemigo`,
  // El título va como en el juego, sin mayúsculas: «la Líder» (Jose, 11/11/2026); el nombre del entrenador, sí.
  trainerTitle: {
    leader: { M: 'el Líder', F: 'la Líder' },
    champion: { M: 'el Campeón', F: 'la Campeona' },
  },
  // «{CLASS} {NAME} would like to battle!» y «{CLASS} {NAME} sent out {MON}!» (sText_TrainerWantsToBattle / sText_Trainer1SentOutPkmn).
  challenge: (title: string, name: string) => `¡${title.charAt(0).toUpperCase()}${title.slice(1)} ${name.toUpperCase()} quiere luchar!`,
  trainerSends: (trainer: string, mon: string) => `¡${trainer.toUpperCase()} envió a ${mon}!`,
  rivalSwitchIn: (trainer: string, mon: string) => `¡${trainer.toUpperCase()} envió a ${mon}!`,
  fainted: (mon: string) => `¡${mon} se debilitó!`,
  notVeryEffective: 'No es muy eficaz…',
  missed: (mon: string) => `¡El ataque de ${mon} falló!`,
  failed: '¡Pero falló!',
  hitCount: (times: number) => `¡Golpeó ${times} veces!`,
  // Gen 3 solo distingue una o dos fases («rose» / «sharply rose»).
  statRose: (stat: string, mon: string, stages: number) => `¡${statWord(stat)} de ${mon} ${stages >= 2 ? 'subió mucho' : 'subió'}!`,
  statFell: (stat: string, mon: string, stages: number) => `¡${statWord(stat)} de ${mon} ${stages >= 2 ? 'bajó mucho' : 'bajó'}!`,
  rivalWon: () => '¡No te quedan POKéMON que puedan combatir!',
  // sText_PkmnRestoredHPUsing y sText_PkmnHadEnergyDrained: «{X} restored health using its {ITEM}!» y «{X} had its energy drained!».
  healed: (mon: string) => `¡${mon} recuperó PS!`,
  healedByItem: (mon: string, item: string) => `¡${mon} recuperó PS con su ${item.toUpperCase()}!`,
  drained: (mon: string) => `¡Se drenó la energía de ${mon}!`,
}
