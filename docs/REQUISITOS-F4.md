# Daily PWT · Requisitos de F4: cuentas, rachas y rankings

Base: [PRD](PRD.md) §0, «Cuentas, rachas y rankings» (decisiones de Jose del 27/10/2026). Diseño propuesto: [ARQUITECTURA.md](ARQUITECTURA.md), DEC-63. Rama: `feature/cuentas`. **Estado: descripción; sin desarrollo empezado.**

## 1. Alcance

| Tema | En F4 |
|---|---|
| Login | Opcional, con Google. Sin sesión, el juego sigue exactamente como hoy (todo en local) |
| Perfil | Nickname único, cambiable sin límite |
| Rachas | Con sesión, el historial y las rachas viven en la cuenta (el historial local se sube al entrar) |
| Rankings | Puntos del mes y racha actual, global y entre amigos |
| Amigos | Búsqueda por nickname, solicitud y aceptación |
| Validación | Estado del combate oficial en la base de datos en cada turno; se borra al terminar |
| Fuera de F4 | Logros (PRD §0, «Logros»), modo PWT |

## 2. Requisitos funcionales

### Login y perfil
- RF-93 El login es opcional: «Iniciar sesión con Google» (en Ajustes y en la cabecera de Hoy). Sin sesión no cambia nada de lo que hay; jugar nunca exige cuenta. Si el servicio no responde, se juega en local y se avisa en español.
- RF-94 Al iniciar sesión por primera vez se crea el perfil con un nickname provisional libre (`entrenador_` + 4 cifras) que el jugador puede cambiar al momento.
- RF-95 Nickname: de 3 a 16 caracteres, solo letras sin tilde, números y `_`. Único sin distinguir mayúsculas (`Jose` y `jose` son el mismo); se muestra tal como se escribió. Se puede cambiar cuantas veces se quiera; si está cogido, se avisa y no cambia. El nickname anterior queda libre al instante.
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
- RF-105 El día se cierra a medianoche de Madrid (el mismo momento que el cambio de reto). Al cerrar se calcula y se fija el multiplicador; hasta entonces los puntos de ese día se muestran como provisionales. Un oficial empezado el día N y terminado tras medianoche cuenta para N (RF-80) y entra en el cálculo si llega antes del cierre de N (ver «Por definir»).

### Rankings
- RF-106 Ranking de **puntos del mes**: suma de los puntos de los días del mes natural (hora de Madrid). Se reinicia el día 1. Se pueden ver los meses anteriores.
- RF-107 Ranking de **racha actual**: racha de victorias viva de cada jugador en este momento (no es mensual).
- RF-108 Los dos rankings tienen vista **global** y vista **amigos** (el jugador y sus amigos aceptados). Se muestra la posición propia aunque no esté en el top.
- RF-109 Sin sesión, los rankings se pueden ver pero no se aparece en ellos; se invita a iniciar sesión.

### Amigos
- RF-110 Buscar por nickname (sin distinguir mayúsculas) y enviar solicitud. El otro la acepta o la rechaza; hasta aceptarla no hay amistad. Se puede cancelar una solicitud enviada y quitar a un amigo (desaparece para los dos).
- RF-111 Pestaña de solicitudes recibidas, con aviso en la cabecera si hay alguna pendiente.

## 3. Por definir (preguntar a Jose antes de desarrollar)
- Días importados (RF-97): propuesta, cuentan para racha y estadísticas, pero no para puntos ni para la media del día (no tienen estados validados).
- Oficial terminado después del cierre (RF-105): propuesta, puntúa con el multiplicador ya fijado, sin cambiarlo.
- Desempate en los rankings: propuesta, quien llegó antes a esa cifra.
- Mínimo de jugadores para el multiplicador (con 1 o 2 jugadores la media es muy volátil): propuesta, ninguno.
- Dónde van los rankings y los amigos en la interfaz (pantalla nueva desde un icono de la cabecera, como Estadísticas).

## 4. Lo que hace Jose
- Crear el proyecto de Supabase (región UE) y pasar la URL y la clave pública `anon`.
- Crear en Google Cloud el cliente OAuth (pantalla de consentimiento y orígenes autorizados) y activarlo en Supabase, «Authentication → Providers → Google».
- Añadir en Supabase las URL de redirección: `https://quimikuaxh.github.io/daily-pwt/` y la de desarrollo (`http://localhost:5173/`).
- Guardar la URL y la clave `anon` como secretos del repositorio para el despliegue.
