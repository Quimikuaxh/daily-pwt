# Torre Batalla

## Juego

- Sortea seis líderes distintos del PWT y un campeón al empezar. Coloca al campeón en el séptimo puesto.
- Sortea un equipo de seis Pokémon para toda la serie. Permite arrastrar las fichas entre puestos antes del primer combate en la pantalla de seis fichas del equipo del daily. Mantén el arrastre desactivado en todas las pantallas de equipo abiertas durante un combate. Ofrece Mover y Datos para teclado y toque. Datos muestra los movimientos y objetos asignados en modo de consulta. Fija el orden al empezar el primer combate.
- Usa la IA del reto diario en los siete combates.
- Inicia cada combate con los PS, PP y objetos del equipo restaurados y sin estados alterados.
- Tras las seis primeras victorias, muestra el siguiente rival y permite volver a Hoy dejando la partida guardada. La séptima victoria completa la serie. Una derrota cierra la serie y la siguiente se sortea de nuevo.
- Al completar la serie, muestra la pantalla de victoria (maqueta en `docs/maquetas/torre/victoria.png`): arriba, el escenario del PWT con la banda «¡Torre Batalla superada!», los seis líderes al fondo en el orden en que cayeron y el campeón delante; abajo, el equipo en las placas de la pantalla de equipo. Nueva serie sortea otra; Volver a Hoy la deja guardada. Una derrota sigue mostrando la tarjeta de fin de serie.
- Conserva tanto la pausa entre rondas como las decisiones del combate en curso. Usa el navegador como invitado y la cuenta con sesión iniciada, como en los lockes. La Torre tiene su propia partida guardada.

## Integración

- Resuelve los sets del PWT con el generador del daily. Usa semillas independientes para el sorteo de entrenadores, las variantes, el equipo del jugador y cada combate. Fija los sets resueltos en la partida guardada para que un cambio de catálogo deje intacta una serie en curso.
- Monta un motor nuevo para cada ronda con los sets originales y las decisiones de esa ronda. Así se restauran los recursos sin copiar estado interno del combate anterior.
- Reutiliza las reglas del diario para generar un equipo válido tomando el primer rival como referencia. El resto de rivales usa el equipo ya sorteado.
- Reutiliza la interfaz de combate del daily y su reanudación por decisiones. Guarda el avance de ronda y la limpieza de esas decisiones en una sola operación.
- Aísla el registro de la Torre del registro de campaña. Aplica las mismas revisiones, recibos de reintentos y comprobaciones de propietario en el guardado por cuenta.

## Guardado por cuenta

La migración `20261117000000_pwt_tower.sql` añade `pwt.tower_runs`, sus recibos y las RPC `get_tower` y `save_tower`. Las RPC deducen el propietario de la sesión y no se pueden ejecutar como invitado. El registro local y el de la cuenta usan claves propias. Antes de publicar la pantalla para cuentas, aplica la migración en el proyecto de destino. Usa `npm test -- supabase/tower.test.ts src/storage/towerStore.test.ts` para verificar el contrato.
