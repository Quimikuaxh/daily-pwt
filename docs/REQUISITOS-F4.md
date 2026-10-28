# Daily PWT · Requisitos de F4: cuentas, rachas y rankings

Base: [PRD](PRD.md) §0, «Cuentas, rachas y rankings» (decisiones de Jose del 27/10/2026). Diseño propuesto: [ARQUITECTURA.md](ARQUITECTURA.md), DEC-63. Rama: `feature/cuentas`. **Estado: en desarrollo.**

## 1. Alcance

| Tema | En F4 |
|---|---|
| Login | Opcional, con Google. Sin sesión, el juego sigue como hoy (historial en local), pero su oficial también cuenta para la dificultad del día (RF-104b) |
| Perfil | Nickname único entre todos los jugadores (con o sin cuenta), cambiable sin límite; también sin cuenta (RF-112) |
| Rachas | Con sesión, el historial y las rachas viven en la cuenta (el historial local se sube al entrar) |
| Rankings | Puntos del mes y racha actual, global y entre amigos; los jugadores sin cuenta también aparecen (RF-112) |
| Amigos | Búsqueda por nickname, solicitud y aceptación; solo entre jugadores con cuenta |
| Validación | Estado del combate oficial en la base de datos en cada turno; se borra al terminar |
| Fuera de F4 | Logros (PRD §0, «Logros»), modo PWT |

## 2. Requisitos funcionales

### Login y perfil
- RF-93 El login es opcional: icono **Cuenta** en la cabecera (Hoy y Resultado), delante de Estadísticas, Ayuda y Ajustes, que abre la ventana «Cuenta»: nickname, «Iniciar sesión con Google» o «Cerrar sesión» (decisión de Jose, 28/10/2026; *descartado:* una sección dentro de Ajustes y un botón «Iniciar sesión» suelto en la cabecera). Sin sesión no cambia nada de lo que hay; jugar nunca exige cuenta. Si el servicio no responde, se juega en local y se avisa en español.
- RF-94 Todo jugador recibe un perfil con un nickname por defecto libre (`entrenador_` + 5 cifras) **al entrar en la web**, tenga cuenta o no (decisión de Jose, 27/10/2026; antes, solo al iniciar sesión y con 4 cifras: con un nombre por visitante, 10.000 se agotarían). Se puede cambiar al momento. Al iniciar sesión con Google, quien ya tenía nickname sin cuenta lo conserva.
- RF-95 Nickname: de 3 a 16 caracteres, solo letras sin tilde, números y `_`. Único entre **todos** los jugadores, con o sin cuenta, sin distinguir mayúsculas (`Jose` y `jose` son el mismo); se muestra tal como se escribió. Se puede cambiar cuantas veces se quiera, con o sin cuenta; si está cogido (por quien sea), se avisa y no cambia: nadie puede quitarle el nombre a otro. El nickname anterior queda libre al instante.
- RF-96 Cerrar sesión vuelve al modo local. Lo que haya en el navegador no se borra.

### Historial y rachas en la cuenta
- RF-97 Al iniciar sesión, los días jugados en ese navegador que no estén en la cuenta se suben a ella (una vez; si la cuenta ya tiene ese día, manda la cuenta). Marcados como «importados».
- RF-98 Con sesión, el oficial del día se registra en la cuenta al empezarlo (RF-79 sigue valiendo: uno por día y por cuenta, también entre dispositivos). Si la cuenta ya tiene el oficial de hoy, en otro dispositivo se ve su estado y no se ofrece otro.
- RF-99 Rachas y estadísticas se calculan igual que ahora (PRD §0, «Estadísticas y compartir»: racha de victorias; perder o no jugar la pone a 0), pero sobre el historial de la cuenta.

### Validación del combate oficial
- RF-100 Con sesión, tras cada turno del oficial el cliente guarda en la base de datos el estado del combate (número de turno, decisiones hasta ese turno y el resumen de PS y debilitados de los dos lados). Solo se puede escribir el estado del oficial propio de un día empezado y no terminado, y el turno solo avanza.
- RF-101 Al terminar el oficial se envía el resultado; el servidor solo lo acepta si es coherente con el último estado guardado (supervivientes y turno) y entonces borra el estado. Un resultado sin estados o incoherente no puntúa.
- RF-102 Con sesión, reanudar (RF-82) también funciona en otro dispositivo a partir del estado guardado.

### Puntos y dificultad
- RF-103 Puntos de un día = Pokémon del jugador sin debilitar al acabar el oficial × multiplicador del día. Perder o rendirse da 0 (no quedan supervivientes que cuenten). Un `void` (RF-83) da 0. Las prácticas no cuentan.
- RF-104 Multiplicador del día = 1 + (6 − media) / 6, con media = media de supervivientes de todos los oficiales terminados y validados de ese día (las derrotas cuentan como 0). Va de ×1 (todos acaban con 6) a ×2 (media 0).
- RF-104b Los oficiales de quien juega **sin cuenta** cuentan igual que los de cuenta (decisiones de Jose, 27/10/2026): entran en la media del día, dan puntos y salen en los rankings (RF-112), con la misma validación por estados (RF-100, RF-101) bajo una sesión anónima del navegador que el jugador no ve. Si el servicio no responde, se juega igual y ese oficial no cuenta. Al iniciar sesión con Google (un solo paso, decisión de Jose del 28/10/2026), los oficiales de ese navegador pasan a la cuenta, con sus puntos, salvo los días que la cuenta ya tenga, que se quedan como otro jugador sin cuenta; si la cuenta es nueva, se queda también con el nickname del navegador.
- RF-105 El día se cierra a medianoche de Madrid, el mismo momento en que cambia el reto para todos (RF-01). Al cerrar se calcula y se fija el multiplicador. **Los puntos solo se muestran cuando son definitivos** (decisión de Jose, 28/10/2026): hasta el cierre, el día no suma en «Yo» ni en los rankings, y «Yo» enseña en su lugar los Pokémon en pie del oficial de hoy (`4/6`) y que los puntos se calculan a medianoche. *Descartado:* enseñar puntos provisionales con la media del momento. Un oficial empezado el día N y terminado tras medianoche cuenta para N (RF-80) y puntúa con el multiplicador ya fijado.

### Rankings
- RF-106 Ranking de **puntos del mes**: suma de los puntos de los días del mes natural (hora de Madrid). Se reinicia el día 1. Se pueden ver los meses anteriores.
- RF-107 Ranking de **racha actual**: racha de victorias viva de cada jugador en este momento (no es mensual).
- RF-108 Los dos rankings tienen vista **global** y vista **amigos** (el jugador y sus amigos aceptados). Se muestra la posición propia aunque no esté en el top.
- RF-109 Sin cuenta se aparece en los rankings globales (RF-112), pero no hay vista de amigos; se invita a iniciar sesión.

### Jugadores sin cuenta (decisiones de Jose, 27/10/2026)
- RF-112 Quien juega sin cuenta tiene nickname (RF-94, RF-95), puntos y racha en el servidor (la de los oficiales jugados con ese navegador) y aparece en los dos rankings globales. En los rankings, los jugadores con cuenta llevan un **tick de verificado**; los que no tienen cuenta, nada.
- RF-113 El nickname de un jugador sin cuenta queda libre tras **30 días sin jugar un oficial** (contando desde el último oficial o, si no ha jugado ninguno, desde que recibió el nombre). Si vuelve, recibe otro por defecto. En los rankings de meses pasados sus puntos siguen, sin nombre. *Descartado:* no liberarlos nunca (los navegadores abandonados retendrían nombres para siempre) y que alguien con cuenta pudiera quitarle el nombre a uno sin cuenta.

### Amigos
- RF-110 Solo entre jugadores con cuenta: los que no tienen no salen en la búsqueda ni pueden enviar ni recibir solicitudes. Buscar por nickname (sin distinguir mayúsculas) y enviar solicitud. El otro la acepta o la rechaza; hasta aceptarla no hay amistad. Se puede cancelar una solicitud enviada y quitar a un amigo (desaparece para los dos).
- RF-111 Pestaña de solicitudes recibidas, con aviso en la cabecera si hay alguna pendiente.

## 3. Decisiones de Jose (27/10/2026)
- Días importados (RF-97): cuentan para racha y estadísticas, pero no para puntos ni para la media del día (no tienen estados validados).
- Oficial terminado después del cierre (RF-105): puntúa con el multiplicador ya fijado, sin cambiarlo.
- Desempate en los rankings: empate compartido, misma posición para los empatados (ranking de competición: 1, 1, 3). *Descartado:* quien llegó antes a esa cifra y más días jugados.
- Mínimo de jugadores para el multiplicador: ninguno; se aplica aunque juegue una sola persona.
- Interfaz: rankings y amigos (con las solicitudes) van **dentro de la pantalla de Estadísticas**, como pestañas. *Descartado:* una pantalla nueva desde otro icono de la cabecera y dos pantallas separadas.

## 4. Lo que hace Jose
- Usar el proyecto de Supabase de claude-test (DEC-63): pasar su URL y la clave pública `anon`, publicar el esquema `pwt` en «Project Settings → API → Exposed schemas», activar «Allow anonymous sign-ins», «Enable manual linking» (ya no hace falta desde el 28/10/2026: el traspaso de la sesión anónima no usa `linkIdentity`; puede quedarse activado) y la extensión `pg_cron`; después, ejecutar la migración `supabase/migrations/*.sql` en el editor SQL.
- Crear en Google Cloud el cliente OAuth (pantalla de consentimiento y orígenes autorizados) y activarlo en Supabase, «Authentication → Providers → Google».
- Añadir en Supabase las URL de redirección: `https://quimikuaxh.github.io/daily-pwt/` y la de desarrollo (`http://localhost:5173/`).
- Guardar la URL y la clave `anon` como secretos del repositorio para el despliegue.
