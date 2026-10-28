import { FAN_NOTICE } from './es'

/** Textos de la ventana de Ayuda (PRD §10.5): van aparte de `es.ts` y se cargan con la ventana, fuera de la ruta crítica (E2E-21). */
export const esHelp = {
  title: 'Ayuda',
  sections: [
    {
      title: 'Cómo se juega',
      items: [
        'Cada día hay un reto nuevo: un rival del Torneo Mundial Pokémon (PWT) de Negro 2 y Blanco 2, con uno de sus equipos del torneo, y un equipo de 6 Pokémon para ti. Es el mismo para todos y cambia a medianoche, con la hora de tu dispositivo.',
        'Elige qué Pokémon sacas primero y empieza el combate oficial. Solo hay uno al día: si sales o recargas la página, se reanuda donde lo dejaste, y rendirse cuenta como derrota.',
        'Las prácticas son ilimitadas, con el mismo reto, antes o después del oficial, y no cuentan para nada.',
        'Ganas si debilitas a los 6 Pokémon del rival.',
      ],
    },
    {
      title: 'Reglas del combate',
      items: [
        'Combate individual de 6 contra 6 con las mecánicas de la 5.ª generación, todos a nivel 50.',
        'Tus Pokémon tienen los mismos IV que los del rival (20 contra líderes, 25 contra campeones y 30 contra Rojo), 0 EV y naturaleza Seria.',
        'Como en el PWT, no se pueden usar objetos: en su lugar, el botón Rival del combate enseña el equipo del rival y sus Datos.',
        'Un empate o pasar de 300 turnos cuentan como derrota.',
      ],
    },
    {
      title: 'Mecánicas de la 5.ª generación',
      items: [
        'Los golpes críticos hacen el doble de daño.',
        'El clima que activa una habilidad (Llovizna, Sequía, Chorro Arena o Nevada) dura todo el combate, hasta que otro clima lo sustituya.',
        'No existe el tipo Hada, y Acero resiste los ataques de tipo Fantasma y Siniestro.',
        'Robustez y la Banda Focus dejan al Pokémon con 1 PS ante un golpe que lo debilitaría, si tenía los PS al máximo.',
        'Las gemas potencian una vez, en un 50 %, el primer movimiento de su tipo.',
      ],
    },
    {
      title: 'Consejos',
      items: [
        'Antes de empezar, mira los movimientos y objetos del rival: «Ver movimientos y objetos del rival».',
        'Piensa con qué Pokémon abrirá el rival y elige un inicial que le haga frente.',
        'Juega una práctica antes del oficial para conocer el combate.',
        'Cambiar a tiempo salva Pokémon: aprovecha las resistencias y las inmunidades de tu equipo.',
      ],
    },
    {
      title: 'Estadísticas',
      items: [
        'Solo cuentan los combates oficiales. La racha de victorias se rompe al perder o al dejar pasar un día sin jugar; la de días, al dejar pasar un día.',
        'Todo se guarda en este navegador, sin cuentas: si borras los datos del sitio o cambias de navegador, empiezas de cero.',
      ],
    },
  ],
  creditsTitle: 'Créditos',
  credits: [
    'Sprites animados de Pokémon de 5.ª generación, iconos de equipo y efectos: Pokémon Showdown.',
    'Sprites de entrenadores de Negro 2 y Blanco 2: WikiDex (con copia en Internet Archive).',
    'Gráficos de la interfaz de combate de Negro 2 y Blanco 2: Bulbagarden Archives y The Spriters Resource (ripeados por GameMaster12, Ploaj, redblueyellow y Floofy Panthar).',
    'Música de Negro 2 y Blanco 2: Super Music Collection (Internet Archive). Efectos de sonido: The Sounds Resource.',
    'Fuente: réplica fan de la de Pokémon Diamante y Perla, de hexparrot/pokemon-assets (MIT).',
    'Motor de combate y datos: @pkmn/sim, @pkmn/dex y @pkmn/data (Pokémon Showdown); cálculo de daño: @smogon/calc.',
    'Sets del equipo del jugador: Smogon University.',
    'Equipos del PWT: Bulbapedia y Serebii. Nombres en español: PokeAPI y WikiDex.',
  ],
  legalTitle: 'Aviso legal',
  legal: FAN_NOTICE,
} as const
