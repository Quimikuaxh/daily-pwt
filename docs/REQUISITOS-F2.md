# Daily PWT · Requisitos de F2

Base: [PRD](PRD.md) (la §0 manda). Datos: [F2-DATOS.md](F2-DATOS.md). Arquitectura: [ARQUITECTURA.md](ARQUITECTURA.md) (DEC-37..39, DEC-43).

## 1. Alcance

F2 carga el roster completo (PRD §7.3, 53 entrenadores), valida los datos en CI y deja todos los sprites en el repositorio.

| PRD | En F2 | Estado |
|---|---|---|
| §7 Roster | 46 líderes y 7 campeones, 99 variantes (Kanto 8, Johto 8, Hoenn 9, Sinnoh 8, Teselia 13, Mundial 46, Campeones 7), 594 sets verificados con ≥ 2 fuentes; `rosterSchedule` con los 53 en la entrada base | Hecho |
| §6 Pool del jugador | Sets de los 53 rivales (varios por especie) más Smogon | Hecho |
| §8.3 Validación | `npm run validate:data` y `.github/workflows/ci.yml` | Hecho |
| §10.7 Sprites | Entrenadores N2/B2 (`.gif` y `-mini.png`) y especies nuevas (frente y espalda) | Hecho (ver README) |
| §6 Equilibrio del equipo del jugador | Suma de estadísticas base >= 3060 y <= 2 Pokémon por tipo (antes 2800 y 3; cambios del 23/10/2026) (RF-13b, RF-13c; DEC-41) | Hecho |
| §4.3 y §11 Oficial único, reanudar y práctica (adelantado de F3, PRD §0) | RF-79 a RF-86; DEC-43 | Hecho |
| §9 IA / §14.19 Calibración | Calibrar la dificultad con el roster completo | Pendiente (PENDIENTE.md) |
| Calendario | Fijar `LAUNCH_DATE` | Pendiente: la fija Jose al final |

## 1b. Requisitos funcionales del combate oficial (PRD §4.3, §10.1, §10.2, §11)

- RF-79 Un combate oficial por día. El día es el del reto, no el de la hora actual. Queda registrado al empezarlo; salir, recargar o rendirse no dan otro intento. Dos pestañas no abren dos oficiales.
- RF-80 Rendirse en el oficial es derrota. Un oficial terminado el día N cuenta para N (también si el resultado se ve pasada la medianoche); Hoy muestra el reto nuevo con su oficial libre.
- RF-80b (decisión de Jose, 28/10/2026; sustituye a reanudar el oficial de un día anterior) A medianoche de Madrid, un oficial sin terminar **cuenta como derrota** del día N (como rendirse: 0 puntos, corta la racha), con los turnos y los Pokémon en pie de su último estado. Si se está en su combate, se vuelve a Hoy con el aviso y el reto nuevo; si se abre la web otro día, se cierra y se avisa igual. Las prácticas siguen con su reto. Con cuenta o sesión anónima, lo cierra también el servidor (`close_days`) y desde ese momento el día no admite turnos ni resultado. *Por qué:* era un reto de todo un día, y así nadie juega el de ayer sabiendo cómo le fue al resto, que ya ha cerrado su día en los rankings. *Descartado:* seguir permitiéndolo, y anularlo con un aviso (sin victoria ni derrota).
- RF-81 Hoy tiene dos botones: «Combate oficial» (estado: Jugar con inicial elegido, Reanudar sin pedir inicial, o el resultado deshabilitado con victoria/derrota, turnos y supervivientes; «Anulado» si no se pudo reanudar) y «Práctica».
- RF-82 Reanudar: recargar o salir y volver a Hoy retoma el oficial en el mismo turno, con el mismo estado, los mismos PS y el mismo Registro, sin repetir la intro y sin animaciones largas. Un oficial sin terminar de un día anterior se ofrece reanudar aparte.
- RF-83 Si no se puede reanudar (datos distintos, guardado corrupto, el motor no reproduce el estado) se avisa en español, el oficial queda `void` (gastado, sin victoria ni derrota) y no hay otro intento.
- RF-84 Prácticas ilimitadas con el mismo reto, antes y después del oficial; no cambian ningún dato guardado ni se reanudan. Etiqueta «OFICIAL» o «PRÁCTICA» visible en combate; los diálogos de salir y rendirse describen las consecuencias de cada modo.
- RF-85 Persistencia local versionada (`daily-pwt:v1`) con historial por día detrás de la interfaz `GameStore`; tolera almacenamiento bloqueado, cuota llena, JSON corrupto y otra versión del esquema; sin almacenamiento el sitio funciona y avisa de que no se guardará.
- RF-86 Estadísticas, rachas, compartir, Ayuda y Ajustes siguen en F3; el almacenamiento solo deja preparado el historial.

## 1c. Requisitos funcionales del sonido (F3, PRD §0 «Sonido» y «Fuentes y temas del sonido»; DEC-56, DEC-57)

- RF-87 Nada suena hasta la primera interacción con la página (toque, clic o tecla); lo que se pidió antes (la música de un combate reanudado) empieza entonces.
- RF-88 Música solo en combate: el tema del rival (`gym-<región>` los líderes, `champion-<región>` los campeones; Mirto, el de Iris) en bucle desde el iris de la intro, o desde el principio al reanudar un oficial; se funde al terminar el combate o al salir. La velocidad del combate no la cambia.
- RF-89 En Resultado, «Winning in the PWT!» una vez si se gana; nada si se pierde o se rinde. Se corta al salir de Resultado.
- RF-90 Efectos: golpe neutro, supereficaz o poco eficaz al bajar la barra por un movimiento (uno por golpe en los múltiples), lanzar y abrir la Poké Ball en la intro y en los cambios, y el pitido de vida baja en bucle mientras el Pokémon activo del jugador tiene la barra en rojo (nunca por el rival; se corta al curarse, al cambiarlo, al debilitarse y al terminar; cambio de requisito del 23/10/2026), y debilitado al caer el sprite; los botones del menú de batalla (pantalla táctil, equipo y datos) suenan a «elegir», y los de volver o cerrar, a «cancelar», cada estado (quemado, envenenado, paralizado, dormido, congelado, confuso) suena con su mensaje y su animación, y también comerse una baya y subir o bajar una característica (decisiones de Jose; las tres últimas, cambio de requisito del 23/10/2026). Nunca al reproducir un combate guardado.
- RF-91 Ajustes: Activado/Silenciado y un deslizador de volumen (0-100 %, 70 por defecto) que valen para música y efectos, se aplican al instante y se guardan en el navegador; también se cambian en combate con el botón Sonido (decisión de Jose); los ajustes guardados antes de existir se leen activado y a 70.
- RF-92 Cada combate descarga solo la pista de su rival y los efectos, nunca toda la música; sin Web Audio, o si falla una descarga, el juego sigue mudo y sin errores.

## 2. Criterios de aceptación (PRD §14)

- 12: los 53 entrenadores tienen ≥ 1 variante y los líderes ≥ 2 (regional y Mundial). Los 46 líderes tienen exactamente 2 (el Supertorneo Tipo repite el Mundial y se deduplica); ninguno tiene una sola. Comprobado por `validate:data` y UT-27.
- 9 y 10: legalidad y sprites, por `validate:data` (UT-28, UT-34, UT-60).
- 7: recargar a mitad del oficial lo reanuda en el mismo turno y con el mismo estado (E2E-52, E2E-53; UT `useBattle.replay`, `App.official`). RF-82.
- 8: tras terminar el oficial el botón queda deshabilitado con el resultado, también tras recargar (E2E-54). RF-79, RF-81.
- 9: rendirse es derrota (E2E-54, `App.official`). RF-80.
- 10: las prácticas no cambian ningún dato guardado (E2E-54, E2E-55). RF-84.
- 17 (parte de reanudar): la intro no se repite al reanudar (E2E-52).
