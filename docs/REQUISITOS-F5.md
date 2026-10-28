# Daily PWT · Requisitos de F5: historial y repeticiones

Base: petición de Jose del 28/10/2026. Rama: `feature/historial-repeticiones` (desde `main`, tras el despliegue de F4). Depende de F4 (cuentas, sesión anónima y esquema `pwt` de Supabase). **Estado: desarrollado (28/10/2026); falta aplicar la migración en Supabase y desplegar.** Decisiones de Jose en §3.

## 1. Alcance

| Tema | En F5 |
|---|---|
| Historial | Los últimos 20 combates oficiales del jugador, con su resultado y su repetición. Al pasar de 20, el más antiguo se borra de la base de datos |
| Repetición | El combate tal como se jugó, con la misma pantalla de combate y sin poder interactuar; turnos uno detrás de otro, con botones para ir al principio, retroceder, avanzar e ir al final |
| Compartir | Desde el historial se genera un enlace a la repetición. Las compartidas no aparecen en el historial: solo se llega a ellas por el enlace. Cada jugador tiene como máximo 20; al compartir la 21.ª se borra la más antigua |
| Quién | Todos los jugadores con sesión, con cuenta o sin ella (como en los rankings); sin cuenta, el historial es el de la sesión anónima de ese navegador |
| Fuera de F5 | Repeticiones de días anteriores a F5 (no hay datos guardados para reconstruirlas) y de las prácticas |

## 2. Requisitos funcionales

### Grabación
- RF-120 Al terminar un combate oficial se guarda su repetición: los equipos del principio y, por turno, las acciones (movimiento, cambio, uso de objeto, rendición) y lo que cambia (PS, debilitados, estados, cambios de estadísticas, clima, efectividad, críticos, fallos). Es un JSON compacto de eventos; no se guarda el registro del simulador ni la semilla para volver a simular (DEC-67).
- RF-121 La repetición no depende de volver a ejecutar el simulador: se ve igual aunque cambien los datos del juego o la versión de `@pkmn/sim`.
- RF-122 Tamaño orientativo (medido el 28/10/2026 con 20 combates completos), guardando también el estado tras cada paso para poder saltar de turno: unos 3,3 KB de media y 5 KB como máximo comprimido (DEC-67).
- RF-123 Solo los combates oficiales tienen repetición; las prácticas no. Un combate anulado (`void`) no tiene repetición. Un oficial jugado sin conexión tampoco (como no cuenta para la media, RF-104b).

### Historial
- RF-124 En pantallas anchas, icono **Historial** propio en la cabecera; en el móvil (≤ 640 px), sin icono: se abre desde la ventana Cuenta (no caben cinco iconos junto al logo, el número de reto y la cuenta atrás). La ventana Historial lista los últimos 20 oficiales terminados del jugador, del más reciente al más antiguo: número de reto, fecha, rival, resultado (victoria o derrota, turnos, Pokémon en pie) y botones «Ver repetición» y «Compartir».
- RF-125 Al guardar el oficial número 21 se borra de la base de datos la repetición del más antiguo. El resultado del día (`day_results`) no se borra: las estadísticas, las rachas y los puntos siguen igual.
- RF-126 El historial se lee de la base de datos: el mismo en todos los dispositivos de una cuenta.

### Repetición
- RF-127 Se ve en la pantalla de combate, con sus sprites, cajas de PS, mensajes y animaciones, sin menú de combate ni botones de acción (rendirse, cambiar, velocidad de turnos del jugador).
- RF-128 Controles: «Al principio», «Turno anterior», «Reproducir / Pausa» (avanza turno a turno solo; en el centro), «Turno siguiente», «Al final», con iconos centrados en sus botones, y el turno que se está viendo: «Inicio» antes del primero y «Turno 7 de 23» mientras y después de verse el 7 (decisiones de Jose, 28/10/2026). Pulsar «Turno siguiente» mientras se reproduce un turno lo termina al instante (antes había que esperar a que acabara). Al avanzar un turno se reproducen sus mensajes y animaciones; al retroceder o saltar, se pinta el estado de ese turno sin animación.
- RF-129 La velocidad del combate de Ajustes (x1, x2, x4) se aplica a las animaciones de la repetición.
- RF-130 Al final se ve el resultado y un botón para volver (al historial, o a Hoy si se llegó por enlace).
- RF-135 La pantalla de victoria o derrota de un oficial tiene «Ver repetición» (abre el visor con ese combate, también sin conexión) y, con sesión, «Compartir» (copia el enlace, como en el historial) (decisión de Jose, 28/10/2026).

### Compartir
- RF-131 «Compartir» (también en el oficial de hoy: la repetición se ve al momento, aunque enseñe el reto del día) crea una copia permanente de la repetición con un identificador corto y aleatorio, y da un enlace `https://quimikuaxh.github.io/daily-pwt/?replay=<id>` para copiar (como «Copiar» de Estadísticas). Volver a compartir el mismo combate da el mismo enlace.
- RF-132 El enlace se abre sin sesión: cualquiera puede ver la repetición. Se muestra el nickname del jugador en el momento de compartir, el número de reto, la fecha y el rival.
- RF-133 Cada jugador tiene como máximo 20 repeticiones compartidas: al compartir la 21.ª se borra la más antigua (por orden de compartir). Fuera de eso no se borran solas (tampoco al salir el combate del historial ni al liberarse el nombre, RF-113) y no aparecen en el historial. Quien la compartió puede borrarla: al abrir el enlace con su sesión sale «Borrar enlace» y, mientras el combate siga en el historial, ahí sale «Dejar de compartir». Borrada, el enlace muestra el aviso de RF-134.
- RF-134 Un enlace inexistente muestra un aviso en español y un botón para ir a Hoy.

## 3. Decisiones de Jose (28/10/2026)
- Historial: icono propio en la cabecera en pantallas anchas; en el móvil, desde la ventana Cuenta (RF-124). *Descartado:* pestaña dentro de Estadísticas.
- Jugadores sin cuenta: también tienen historial y pueden compartir.
- Compartir el oficial de hoy: se puede, y se ve al momento. *Descartado:* esperar a medianoche y no dejar compartir el de hoy.
- Visor: con «Reproducir / Pausa» además de los botones (RF-128).
- Las compartidas se pueden borrar por quien las compartió, desde la propia repetición (RF-133). *Descartado:* una lista «Mis compartidas».
- Prácticas: sin historial ni repetición.

- Compartidas: sin límite total; como máximo 20 por jugador, y la 21.ª borra la más antigua (RF-133). Espacio el 28/10/2026: la base de datos usa 18 MB de 500 (el audio del Heardle va en Storage, con su propio límite de 1 GB); con 3,3 KB por repetición, el historial de 1000 jugadores ocupa unos 66 MB. *Descartado:* compartidas permanentes sin límite por jugador.
