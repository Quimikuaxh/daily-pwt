/**
 * Textos de la interfaz en español (RNF-05). Todo texto visible sale de aquí.
 * Las plantillas del registro de combate (`log`) las usa `src/battle/translate.ts`; el resto de secciones las añade cada pantalla.
 */

const STAT_LABELS = {
  atk: 'El Ataque',
  def: 'La Defensa',
  spa: 'El Ataque Especial',
  spd: 'La Defensa Especial',
  spe: 'La Velocidad',
  accuracy: 'La precisión',
  evasion: 'La evasión',
} as const

const STATUS_INFLICTED = {
  brn: (mon: string) => `¡${mon} se ha quemado!`,
  par: (mon: string) => `¡${mon} se ha paralizado! Quizá no pueda moverse.`,
  slp: (mon: string) => `¡${mon} se ha dormido!`,
  psn: (mon: string) => `¡${mon} se ha envenenado!`,
  tox: (mon: string) => `¡${mon} se ha envenenado gravemente!`,
  frz: (mon: string) => `¡${mon} se ha congelado!`,
} as const

const STATUS_CURED = {
  brn: (mon: string) => `¡${mon} se ha curado de la quemadura!`,
  par: (mon: string) => `¡${mon} se ha curado de la parálisis!`,
  slp: (mon: string) => `¡${mon} se ha despertado!`,
  psn: (mon: string) => `¡${mon} se ha curado del envenenamiento!`,
  tox: (mon: string) => `¡${mon} se ha curado del envenenamiento!`,
  frz: (mon: string) => `¡${mon} se ha descongelado!`,
} as const

const WEATHER_STARTED = {
  raindance: 'Ha comenzado a caer una lluvia.',
  sunnyday: 'El sol brilla con fuerza.',
  sandstorm: 'Se ha desatado una tormenta de arena.',
  hail: 'Está cayendo granizo.',
} as const

const WEATHER_CONTINUES = {
  raindance: 'La lluvia sigue cayendo.',
  sunnyday: 'El sol sigue brillando con fuerza.',
  sandstorm: 'La tormenta de arena arrecia.',
  hail: 'El granizo sigue cayendo.',
} as const

const WEATHER_ENDED = {
  raindance: 'La lluvia ha cesado.',
  sunnyday: 'El sol ha dejado de brillar con fuerza.',
  sandstorm: 'La tormenta de arena ha amainado.',
  hail: 'Ha dejado de caer granizo.',
} as const

const CANT_MOVE_REASONS = {
  par: (mon: string) => `¡${mon} está totalmente paralizado y no puede moverse!`,
  slp: (mon: string) => `¡${mon} sigue durmiendo!`,
  frz: (mon: string) => `¡${mon} está congelado y no puede moverse!`,
  flinch: (mon: string) => `¡${mon} se ha acobardado y no puede atacar!`,
  recharge: (mon: string) => `¡${mon} necesita recargarse y no puede moverse!`,
  attract: (mon: string) => `¡El enamoramiento impide atacar a ${mon}!`,
  nopp: (mon: string) => `¡${mon} no tiene PP para usar ese movimiento!`,
} as const

const DAMAGE_SOURCES = {
  brn: (mon: string) => `¡${mon} sufre quemaduras!`,
  psn: (mon: string) => `¡${mon} sufre los efectos del veneno!`,
  tox: (mon: string) => `¡${mon} sufre los efectos del veneno!`,
  confusion: (mon: string) => `¡${mon} se ha hecho daño por la confusión!`,
  sandstorm: (mon: string) => `¡La tormenta de arena zarandea a ${mon}!`,
  hail: (mon: string) => `¡El granizo golpea a ${mon}!`,
  leechseed: (mon: string) => `¡Las Drenadoras restan PS a ${mon}!`,
  stealthrock: (mon: string) => `¡Unas piedras puntiagudas se clavan en ${mon}!`,
  spikes: (mon: string) => `¡${mon} ha sido herido por las púas!`,
  recoil: (mon: string) => `¡${mon} se ha herido por el retroceso!`,
  curse: (mon: string) => `¡${mon} sufre los efectos de la maldición!`,
  nightmare: (mon: string) => `¡${mon} sufre una pesadilla!`,
} as const


const STAT_NAMES = {
  hp: 'PS',
  atk: 'Ataque',
  def: 'Defensa',
  spa: 'At. Esp.',
  spd: 'Def. Esp.',
  spe: 'Velocidad',
} as const

const NATURES = {
  Hardy: 'Fuerte', Lonely: 'Huraña', Brave: 'Audaz', Adamant: 'Firme', Naughty: 'Pícara',
  Bold: 'Osada', Docile: 'Dócil', Relaxed: 'Plácida', Impish: 'Agitada', Lax: 'Floja',
  Timid: 'Miedosa', Hasty: 'Activa', Serious: 'Seria', Jolly: 'Alegre', Naive: 'Ingenua',
  Modest: 'Modesta', Mild: 'Afable', Quiet: 'Mansa', Bashful: 'Tímida', Rash: 'Alocada',
  Calm: 'Serena', Gentle: 'Amable', Sassy: 'Grosera', Careful: 'Cauta', Quirky: 'Rara',
} as const

const BATTLE_STATUS = {
  brn: 'Quemado',
  par: 'Paralizado',
  slp: 'Dormido',
  psn: 'Envenenado',
  tox: 'Gravemente envenenado',
  frz: 'Congelado',
} as const

/** Aviso de proyecto fan: pie de Hoy y Ayuda. */
const FAN_NOTICE =
  'Daily PWT es un proyecto de fans, no oficial y sin ánimo de lucro. Pokémon y sus nombres son marcas de Nintendo, Creatures Inc., GAME FREAK inc. y The Pokémon Company. Este sitio no está afiliado a ninguna de ellas.'

const BATTLE_WEATHER = {
  raindance: 'Lluvia',
  sunnyday: 'Sol',
  sandstorm: 'Torm. arena',
  hail: 'Granizo',
} as const

const REGIONS = {
  kanto: 'Kanto',
  johto: 'Johto',
  hoenn: 'Hoenn',
  sinnoh: 'Sinnoh',
  unova: 'Teselia',
} as const

export const es = {
  app: {
    name: 'Daily PWT',
    skipToContent: 'Saltar al contenido',
    headerActions: 'Menú',
  },

  errors: {
    engine: 'El motor de combate ha fallado. Vuelve a Hoy e inténtalo de nuevo.',
    worker: 'No se ha podido iniciar el combate. Vuelve a Hoy e inténtalo de nuevo.',
  },


  /** Abreviaturas de los tipos para chips estrechos (como los iconos del juego, que también abrevian). */
  typeShort: {
    normal: 'NORMAL', fire: 'FUEGO', water: 'AGUA', electric: 'ELÉCTR', grass: 'PLANTA', ice: 'HIELO', fighting: 'LUCHA', poison: 'VENENO',
    ground: 'TIERRA', flying: 'VOLAD', psychic: 'PSÍQUI', bug: 'BICHO', rock: 'ROCA', ghost: 'FANTAS', dragon: 'DRAGÓN', dark: 'SINIES', steel: 'ACERO',
  },

  today: {
    challengeNumber: (number: number) => `#${number}`,
    nextChallengeIn: 'Próximo reto en',
    dataError: 'No se han podido preparar los datos del reto de hoy. Recarga la página o vuelve más tarde.',

    rivalSection: 'Tu rival de hoy',
    rivalTeam: 'Equipo rival',
    categories: { leader: 'Líder de gimnasio', champion: { M: 'Campeón', F: 'Campeona' } },
    regions: REGIONS,
    specialty: (type: string) => `Especialidad: ${type}`,
    showRivalDetails: 'Ver movimientos y objetos del rival',
    hideRivalDetails: 'Ocultar movimientos y objetos del rival',
    itemLabel: 'Objeto:',
    abilityLabel: 'Habilidad:',
    moves: 'Movimientos',

    playerSection: 'Tu equipo',
    playerSectionHint: 'Elige con quién empiezas el combate.',
    types: 'Tipos',
    baseStatTotal: (total: number) => `Total de stats base: ${total}`,
    statsTitle: 'Stats a Nv. 50',
    statNames: STAT_NAMES,
    categoryNames: { Physical: 'Físico', Special: 'Especial', Status: 'Estado' },
    power: 'Pot.',
    accuracy: 'Prec.',
    notApplicable: '—',
    leadButton: 'Sacar primero',
    leadSelected: 'Sale primero',

    fight: 'Combatir',
    fightHint: 'Elige tu Pokémon inicial para poder combatir.',
    officialFight: 'Combate oficial',
    practiceFight: 'Práctica',
    practiceHint: 'La práctica es ilimitada, no cuenta para nada y no se guarda.',
    official: {
      play: 'Jugar',
      resume: 'Reanudar',
      won: (turns: number, alive: number) => `Victoria · ${turns} ${turns === 1 ? 'turno' : 'turnos'} · ${alive}/6 en pie`,
      lost: (turns: number, alive: number) => `Derrota · ${turns} ${turns === 1 ? 'turno' : 'turnos'} · ${alive}/6 en pie`,
      void: 'Anulado: no se pudo reanudar',
      doneHint: 'Ya has jugado el combate oficial de hoy. Mañana, uno nuevo; mientras, puedes practicar.',
      resumeHint: 'Tu combate oficial de hoy sigue en curso: retómalo donde lo dejaste.',
      earlierResume: (number: number) => `Tienes sin terminar el combate oficial del reto #${number}.`,
      earlierResumeButton: (number: number) => `Reanudar el combate oficial del reto #${number}`,
      notSaved: 'Este navegador no deja guardar datos: el combate oficial no se podrá reanudar si recargas ni se recordará mañana.',
      resumeFailed: 'No se ha podido reanudar tu combate oficial (los datos del reto o el guardado no coinciden). Cuenta como jugado, sin victoria ni derrota, y no se puede repetir hoy. Puedes practicar.',
    },

    fanNotice: FAN_NOTICE,
  },

  battle: {
    heading: 'Combate',
    exit: 'Salir',
    forfeit: 'Rendirse',
    switchMon: 'Cambiar',
    pokemonLabel: 'Pokémon',
    speed: (multiplier: number) => `Velocidad: x${multiplier}`,
    you: 'Tú',
    rival: 'Rival',
    remaining: (alive: number, total: number) => `${alive}/${total}`,
    remainingLabel: (side: string) => `Pokémon en pie: ${side}`,
    level: 'Nv. 50',
    hpLabel: 'PS',
    percent: (value: number) => `${value} %`,
    hpValues: (current: number, max: number) => `${current}/${max}`,
    fieldLabel: 'Campo de combate',
    controlsLabel: 'Pantalla táctil',
    logLabel: 'Registro del combate',
    status: BATTLE_STATUS,
    weather: BATTLE_WEATHER,
    weatherUnknown: 'Clima',
    weatherTurnsLeft: (turns: number) => (turns === 1 ? ', queda 1 turno' : `, quedan ${turns} turnos`),

    movesLabel: 'Movimientos',
    ppLabel: 'PP',
    moveAria: (name: string, typeLabel: string | null, pp: { current: number; max: number } | null) =>
      `${name}${typeLabel ? `, tipo ${typeLabel}` : ''}${pp ? `, PP ${pp.current} de ${pp.max}` : ''}`,
    struggle: 'Forcejeo',
    unknownMove: 'Movimiento',
    moveReasons: {
      noPp: 'Sin PP: agotado.',
      blocked: 'No se puede usar ahora.',
    },
    waitingTurn: 'Esperando…',
    whatWillDo: (mon: string) => `¿Qué hará ${mon}?`,
    fight: 'Luchar',
    rivalTeam: 'Rival',
    rivalTeamAria: 'Ver el equipo rival',
    history: 'Registro',
    historyClose: 'Cerrar',
    historyTitle: 'Registro del combate',
    historyEmpty: 'Todavía no ha pasado nada.',
    introAria: 'Introducción del combate',
    advanceHint: 'Toca o pulsa una tecla para avanzar',

    party: {
      label: 'Equipo',
      choosePrompt: 'Elige un Pokémon.',
      forcedPrompt: 'Elige el siguiente Pokémon.',
      rivalLabel: 'Equipo rival',
      rivalPrompt: (trainer: string) => `Equipo de ${trainer}.`,
      memberAria: (name: string, level: string, hp: string, state: string) => `${name} ${level} ${hp} PS${state ? `, ${state}` : ''}`,
      options: { switch: 'Cambiar', summary: 'Datos', cancel: 'Cancelar' },
      optionsLabel: (name: string) => `¿Qué hacer con ${name}?`,
      fainted: 'Debilitado',
      inBattle: 'En combate',
      reasonFainted: 'Está debilitado y no puede combatir.',
      reasonActive: 'Ya está en combate.',
      levelShort: (level: number) => `Nv.${level}`,
      levelLong: (level: number) => `Nv. ${level}`,
    },
    summary: {
      label: (name: string) => `Datos de ${name}`,
      heading: 'DATOS DEL POKÉMON',
      pageTitles: { info: 'Información', skills: 'Habilidades y estadísticas', moves: 'Movimientos' },
      pageNames: ['Información', 'Habilidades', 'Movimientos'],
      previousPage: 'Página anterior',
      nextPage: 'Página siguiente',
      previousMon: 'Pokémon anterior',
      nextMon: 'Pokémon siguiente',
      back: 'Volver',
      close: 'Cerrar datos',
      pageCounter: (page: number, total: number) => `Página ${page} de ${total}`,
      natureLead: 'Naturaleza',
      natureNeutral: 'No cambia ninguna estadística.',
      natureEffect: (up: string, down: string) => `Sube ${up} y baja ${down}.`,
      dexNumber: 'N.º Dex',
      name: 'Nombre',
      types: 'Tipo',
      level: 'Nivel',
      nature: 'Naturaleza',
      gender: { M: 'Macho', F: 'Hembra' },
      genderless: 'Sin género',
      ability: 'Habilidad',
      item: 'Objeto',
      noItem: 'Ninguno',
      hp: 'PS',
      pp: 'PP',
      category: 'Categoría',
      power: 'Potencia',
      accuracy: 'Precisión',
      statUp: ' (sube con la naturaleza)',
      statDown: ' (baja con la naturaleza)',
      selectMove: (name: string) => `Ver detalle de ${name}`,
      natures: NATURES,
    },
    switchTitle: 'Elige un Pokémon',
    forcedSwitchTitle: 'Tu Pokémon se ha debilitado. Elige el siguiente.',
    back: 'Volver',
    switchStates: { fainted: 'Debilitado', active: 'En combate' },
    switchReasons: {
      trapped: 'Atrapado: no puedes cambiar de Pokémon.',
      nobody: 'No hay ningún Pokémon disponible para cambiar.',
    },

    forfeitTitle: '¿Quieres rendirte?',
    forfeitBody: 'Si te rindes, el combate cuenta como derrota.',
    forfeitConfirm: 'Sí, rendirme',
    exitTitle: '¿Salir del combate?',
    exitBody: 'Se descartará la partida y no podrás recuperarla.',
    exitBodyOfficial: 'El combate oficial queda guardado: podrás reanudarlo desde Hoy. No cuenta como otro intento.',
    forfeitBodyOfficial: 'Si te rindes, el combate oficial cuenta como derrota y hoy no podrás repetirlo.',
    modeOfficial: 'OFICIAL',
    modePractice: 'PRÁCTICA',
    modeLabel: (official: boolean) => (official ? 'Combate oficial' : 'Combate de práctica'),
    exitConfirm: 'Sí, salir',
    cancel: 'Cancelar',

    failure: 'Se ha producido un problema en el combate. Vuelve a Hoy e inténtalo de nuevo.',
    backToToday: 'Volver a Hoy',
  },

  result: {
    victory: 'Victoria',
    defeat: 'Derrota',
    victoryLead: '¡Has ganado el combate!',
    defeatReasons: {
      faint: 'Todos tus Pokémon se han debilitado.',
      forfeit: 'Te has rendido.',
      turnLimit: (turns: number) => `Se alcanzó el límite de ${turns} turnos: cuenta como derrota.`,
      tie: 'Ha habido un empate, que cuenta como derrota.',
    },
    turns: (turns: number) => `Turnos: ${turns}`,
    alive: (alive: number) => `Pokémon en pie: ${alive}`,
    rivalFainted: (fainted: number, total: number) => `Rivales debilitados: ${fainted}/${total}`,
    backToToday: 'Volver a Hoy',
    rematch: 'Otro combate',
    officialRecorded: 'Combate oficial registrado. «Otro combate» es una práctica: no cuenta para nada.',
    practiceNote: 'Práctica: no cuenta para nada.',
  },

  stats: {
    title: 'Estadísticas',
    open: 'Estadísticas',
    close: 'Cerrar',
    played: 'Jugados',
    winPercent: '% victorias',
    winStreak: 'Racha de victorias',
    dayStreak: 'Racha de días',
    current: 'Actual',
    max: 'Máxima',
    empty: 'Aún no has terminado ningún combate oficial. Las prácticas no cuentan.',
    note: 'Solo cuentan los combates oficiales. Se guardan en este navegador.',
  },

  help: {
    title: 'Ayuda',
    open: 'Ayuda',
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
      'Fuente: réplica fan de la de Pokémon Diamante y Perla, de hexparrot/pokemon-assets (MIT).',
      'Motor de combate y datos: @pkmn/sim, @pkmn/dex y @pkmn/data (Pokémon Showdown); cálculo de daño: @smogon/calc.',
      'Sets del equipo del jugador: Smogon University.',
      'Equipos del PWT: Bulbapedia y Serebii. Nombres en español: PokeAPI y WikiDex.',
    ],
    legalTitle: 'Aviso legal',
    legal: FAN_NOTICE,
  },

  settings: {
    title: 'Ajustes',
    open: 'Ajustes',
    speedTitle: 'Velocidad del combate',
    speedHint: 'También se cambia con el botón Velocidad durante el combate.',
    speedOption: (speed: number) => `x${speed}`,
    animationsTitle: 'Animaciones de movimientos',
    animationsOn: 'Activadas',
    animationsOff: 'Desactivadas',
    animationsHint: 'Con «reducir movimiento» activado en el sistema no se muestran.',
    dataTitle: 'Datos locales',
    dataHint: 'Tus estadísticas, rachas, el combate oficial de hoy y los ajustes se guardan en este navegador.',
    clear: 'Borrar datos locales',
    confirmTitle: '¿Borrar todos los datos?',
    confirmBody: 'Se borrarán tus estadísticas y rachas, el combate oficial de hoy (también si está a medias) y los ajustes. No se puede deshacer.',
    confirm: 'Sí, borrar',
    cancel: 'Cancelar',
    cleared: 'Datos borrados.',
  },

  share: {
    button: 'Compartir',
    copied: 'Resultado copiado al portapapeles.',
    failed: 'No se ha podido copiar. Selecciona el texto y cópialo a mano.',
    title: (number: number) => `Daily PWT #${number}`,
    victory: (turns: number) => `✅ Victoria en ${turns} turnos`,
    defeat: (rivalFainted: number, total: number) => `❌ Derrota (${rivalFainted}/${total} rivales debilitados)`,
    streak: (streak: number) => `🔥 Racha: ${streak}`,
    alive: '🟩',
    fainted: '🟥',
  },

  log: {
    generic: 'Ha ocurrido algo en el combate.',
    unknownMove: 'un movimiento',
    unknownItem: 'un objeto',
    unknownAbility: 'una habilidad',
    unknownMon: 'el Pokémon',
    rivalMon: (mon: string, trainer: string) => `${mon} de ${trainer}`,
    yourTeam: 'tu equipo',
    rivalTeam: 'el equipo rival',

    trainerTitle: {
      leader: { M: 'El Líder', F: 'La Líder' },
      champion: { M: 'El Campeón', F: 'La Campeona' },
    },
    challenge: (title: string, name: string) => `¡${title} ${name} te desafía!`,
    trainerSends: (trainer: string, mon: string) => `¡${trainer} saca a ${mon}!`,
    playerSends: (mon: string) => `¡Adelante, ${mon}!`,
    rivalSwitchIn: (trainer: string, mon: string) => `¡${trainer} saca a ${mon}!`,
    rivalDragged: (mon: string) => `¡${mon} ha sido arrastrado al combate!`,
    playerDragged: (mon: string) => `¡${mon} ha sido arrastrado al combate!`,

    moveUsed: (mon: string, move: string) => `¡${mon} usó ${move}!`,
    fainted: (mon: string) => `¡${mon} se ha debilitado!`,
    superEffective: '¡Es muy eficaz!',
    notVeryEffective: '¡Es poco eficaz!',
    critical: '¡Un golpe crítico!',
    missed: (mon: string) => `¡El ataque de ${mon} ha fallado!`,
    noEffect: (mon: string) => `No afecta a ${mon}…`,
    immuneByAbility: (mon: string, ability: string) => `No afecta a ${mon} gracias a ${ability}.`,
    failed: '¡Pero ha fallado!',
    noTarget: '¡Pero no había ningún objetivo!',
    oneHitKo: '¡Es un KO de un golpe!',
    hitCount: (times: number) => `¡Ha golpeado ${times} veces!`,

    statusInflicted: STATUS_INFLICTED,
    statusCured: STATUS_CURED,
    statusCuredFallback: (mon: string) => `¡${mon} se ha curado de su problema de estado!`,
    teamStatusCured: 'Se han curado los problemas de estado del equipo.',

    statLabels: STAT_LABELS,
    statRose: (stat: string, mon: string, stages: number) =>
      `¡${stat} de ${mon} ${stages >= 3 ? 'ha subido muchísimo' : stages === 2 ? 'ha subido mucho' : 'ha subido'}!`,
    /** «¡La Baya Aslac ha subido la Velocidad de Garchomp!» (las bayas son todas femeninas). */
    berryStatRose: (berry: string, stat: string, mon: string, stages: number) =>
      `¡La ${berry} ha subido ${stages >= 3 ? 'muchísimo ' : stages === 2 ? 'mucho ' : ''}${stat.charAt(0).toLowerCase()}${stat.slice(1)} de ${mon}!`,
    statFell: (stat: string, mon: string, stages: number) =>
      `¡${stat} de ${mon} ${stages >= 3 ? 'ha bajado muchísimo' : stages === 2 ? 'ha bajado mucho' : 'ha bajado'}!`,
    statMaxed: (stat: string, mon: string) => `¡${stat} de ${mon} ha llegado al máximo!`,
    boostsReset: (mon: string) => `¡Los cambios de características de ${mon} han desaparecido!`,
    negativeBoostsReset: (mon: string) => `¡${mon} ha recuperado las características que le habían bajado!`,
    allBoostsReset: 'Todos los cambios de características han desaparecido.',
    boostsCopied: (mon: string) => `¡${mon} ha copiado los cambios de características de su objetivo!`,
    boostsSwapped: (mon: string) => `¡${mon} ha intercambiado los cambios de características con su objetivo!`,
    boostsInverted: (mon: string) => `¡Los cambios de características de ${mon} se han invertido!`,

    weatherStarted: WEATHER_STARTED,
    weatherContinues: WEATHER_CONTINUES,
    weatherEnded: WEATHER_ENDED,
    weatherCleared: 'El clima ha vuelto a la normalidad.',

    abilityActivated: (mon: string, ability: string) => `¡${mon} activa su habilidad ${ability}!`,
    abilityBlocks: (mon: string, ability: string) => `¡${ability} de ${mon} ha bloqueado el efecto!`,
    itemObtained: (mon: string, item: string) => `¡${mon} ha obtenido ${item}!`,
    itemLost: (mon: string, item: string) => `¡${mon} ha perdido ${item}!`,
    itemSpent: (mon: string, item: string) => `¡${item} de ${mon} se ha gastado!`,
    itemWeakenedHit: (mon: string, item: string) => `¡${item} ha reducido el daño que iba a recibir ${mon}!`,
    gemBoosted: (mon: string, item: string) => `¡${item} ha potenciado el movimiento de ${mon}!`,
    focusSashHeld: (mon: string, item: string) => `¡${mon} ha aguantado el golpe con ${item}!`,
    whiteHerbRestored: (mon: string, item: string) => `¡${item} ha restaurado las características de ${mon}!`,
    powerHerbCharged: (mon: string, item: string) => `¡${mon} ha usado ${item} y ataca sin esperar!`,
    airBalloonPopped: (mon: string, item: string) => `¡${item} de ${mon} ha explotado!`,

    cantMove: CANT_MOVE_REASONS,
    cantMoveFallback: (mon: string) => `¡${mon} no puede moverse!`,
    cantMoveTaunt: (mon: string, move: string) => `¡${mon} no puede usar ${move} por la mofa!`,
    mustRecharge: (mon: string) => `¡${mon} necesita recargarse!`,

    turn: (number: number) => `Turno ${number}`,
    playerWon: '¡Has ganado el combate!',
    rivalWon: (trainer: string) => `¡${trainer} ha ganado el combate!`,
    tie: '¡El combate ha terminado en empate!',

    confused: (mon: string) => `¡${mon} está confuso!`,
    confusionEnded: (mon: string) => `¡${mon} ya no está confuso!`,
    confusionActive: (mon: string) => `¡${mon} sigue confuso!`,
    substituteCreated: (mon: string) => `¡${mon} ha creado un sustituto!`,
    substituteTookHit: (mon: string) => `¡El sustituto de ${mon} ha absorbido el daño!`,
    substituteFaded: (mon: string) => `¡El sustituto de ${mon} se ha desvanecido!`,
    effectStarted: (mon: string, effect: string) => `¡${mon} se ve afectado por ${effect}!`,
    effectEnded: (mon: string, effect: string) => `¡${mon} ya no se ve afectado por ${effect}!`,
    effectActivated: (mon: string, effect: string) => `¡${effect} de ${mon} se ha activado!`,
    protectedItself: (mon: string) => `¡${mon} se ha protegido!`,
    protectedBy: (mon: string, move: string) => `¡${mon} se ha protegido con ${move}!`,
    preparing: (mon: string, move: string) => `¡${mon} se prepara para usar ${move}!`,
    bracing: (mon: string) => `¡${mon} se concentra!`,
    destinyBond: (mon: string) => `¡${mon} quiere llevarse a su rival consigo!`,
    sideEffectStarted: (effect: string, team: string) => `¡${effect} afecta a ${team}!`,
    sideEffectEnded: (effect: string, team: string) => `¡El efecto de ${effect} sobre ${team} ha terminado!`,
    fieldEffectStarted: (effect: string) => `¡${effect} afecta a todo el campo!`,
    fieldEffectEnded: (effect: string) => `¡El efecto de ${effect} sobre el campo ha terminado!`,
    transformed: (mon: string, target: string) => `¡${mon} se ha transformado en ${target}!`,
    formChanged: (mon: string) => `¡${mon} ha cambiado de forma!`,

    damageSources: DAMAGE_SOURCES,
    damageFromItem: (mon: string, item: string) => `¡${mon} ha perdido PS por ${item}!`,
    damageFromAbility: (mon: string, ability: string) => `¡${mon} ha perdido PS por ${ability}!`,
    healed: (mon: string) => `¡${mon} ha recuperado PS!`,
    healedByItem: (mon: string, item: string) => `¡${mon} ha recuperado PS con ${item}!`,
    healedByAbility: (mon: string, ability: string) => `¡${mon} ha recuperado PS gracias a ${ability}!`,
    drained: (mon: string) => `¡Se han drenado PS a ${mon}!`,
    wishCameTrue: (mon: string) => `¡El deseo se ha cumplido para ${mon}!`,
  },
} as const
