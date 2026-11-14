# Guardado de campaña por cuenta

Usa `account.campaign` para el modo de campaña. Requiere una cuenta iniciada; las sesiones anónimas no acceden. El diario conserva su almacén, sus RPC y su cola. El prototipo `LocalCampaignStore` sigue usando `daily-pwt:nuzlocke:v1` y no se importa automáticamente en una cuenta.

## Integración en D7

1. Suscríbete a `account.campaign.subscribe` y lee `getState()` (compatible con `useSyncExternalStore`). Llama a `load()` al abrir el modo, después de iniciar sesión. El diario no consulta campañas.
2. Espera `status: 'ready'`. Obtén una copia del registro mediante `read()`. Si es `null`, todavía no hay campaña. Persiste el resultado de cada operación pura de preparación con `await write(state, battle, expectedRevision)`, usando la revisión leída o 0 para crear. Guarda la oferta antes de mostrarla, la elección antes de permitir la siguiente y las modificaciones de equipo, movimientos y evoluciones antes de combatir.
3. Para combatir, crea `account.campaign.createSession(createCampaignWorkerClient())`. Suscríbete antes de llamar a `prepare`, `resume`, `choose`, `forfeit` o `finish`. Usa el contrato de D1 documentado en DEC-85/86: la sesión persiste alineación, preparación, decisiones y checkpoints; no guardes esas mismas transiciones desde la pantalla.
4. Espera las promesas de `prepare`, `choose` y `forfeit` y captura sus errores. Su resolución permite el envío al worker; el evento `campaign-prepared`, `campaign-resumed`, `campaign-update` o `campaign-finished` confirma también la persistencia de la respuesta. Espera ese evento antes de permitir otra acción. `resume` y `finish` notifican el resultado por eventos.
5. Al salir del combate llama a `session.stop()`. Cerrar sesión o cambiar de cuenta termina automáticamente los clientes registrados e invalida respuestas pendientes; `read()` pasa a `null`. No borres las cachés ni el historial al hacerlo.

`getState()` expone `status`, `record`, `message` y `persistent`. `record` incluye la intención pendiente cuando exista, aunque aún no esté confirmada por el servidor. `ready` permite una escritura nueva; en `saving`, una escritura sobre el último cambio conocido (`read()`) va a la cola (`next`, una sola plaza: la última) y sale al confirmarse la que está en vuelo (DEC-102); la pantalla no se bloquea mientras guarda. `loading` bloquea, y el combate solo se crea en `ready`. `error` conserva el registro incompatible o rechazado sin sobrescribirlo. `closed` requiere cuenta y carga del modo. Los textos de guardado viven en `src/i18n/esCampaign.ts`.

## Conflicto y recuperación

Aplica la decisión de Jose del **11/11/2026**, PRD §0 y DEC-90: en `conflict`, muestra `esCampaign.conflict` y el botón `esCampaign.reload` (**«Recargar campaña»**). No llames a `reload()` automáticamente ni ofrezcas sobrescribir el remoto. Invócalo cuando el jugador confirme; los cambios locales pendientes se descartan solo después de recibir y validar el guardado remoto. Si la lectura falla o el formato no es compatible, conserva los bytes, la intención y el bloqueo. Al recuperarse, crea otra sesión y reanuda el combate del registro descargado.

En `offline`, muestra el fallo y ofrece `retry()`. Reenvía la misma intención con el mismo UUID y revisión; no generes otra operación. El worker se ha detenido: tras recuperar `ready`, crea otra sesión y reconstruye desde el registro. Un cierre de combate pendiente se recupera del mismo modo. No reenvíes un conflicto ni lo resuelvas desde `retry()`.

El journal `daily-pwt:campaign-account:v1:<userId>` conserva por cuenta el último registro confirmado, la intención pendiente, el cambio en cola (`next`) y la marca de conflicto. La revisión del servidor decide si una escritura es vigente; localStorage no es un bloqueo entre pestañas. No dependas de la caché para autorizar sobrescrituras. Si `persistent` es `false` (almacenamiento bloqueado, ausente o sin cuota), la intención puede estar solo en memoria: no garantices que sobreviva al cierre de la página. Las operaciones confirmadas siguen guardadas en Supabase.

## Migración y comprobación local

La migración aditiva es `supabase/migrations/20261111000000_pwt_campaign.sql`. Añade `pwt.campaigns`, `pwt.campaign_operations`, RLS de propietario y las RPC `get_campaign` y `save_campaign`. Mantiene una fila de campaña por cuenta; no añade rankings ni modifica los oficiales. El contrato SQL, los recibos y las alternativas descartadas están en DEC-89.

Ejecuta estos comandos solo contra la copia local:

```sh
npx supabase start
npx supabase db reset --local
npx supabase test db
npx vitest run
npx tsc -b
npm run lint
npm run build
npm run validate:data
npm run test:e2e
```

`db reset --local` borra los datos de prueba y reaplica todas las migraciones. `campaign.test.sql` prueba acceso por RPC, privilegios y RLS entre dos cuentas dentro de una transacción revertida; Vitest ejecuta ese mismo SQL sobre PGlite y prueba el cliente con los helpers de `src/test-utils/cloud.ts`. Comprueba dos pestañas y cierre de sesión en D7 cuando exista su interfaz. Si el entorno no permite Docker o abrir puertos, ejecuta SQL y E2E desde el entorno del coordinador y registra sus resultados en `PENDIENTE.md`.

Para pruebas manuales de la web, configura `.env.development.local` como indica el README y verifica que la URL sea `http://127.0.0.1:54321`. Sin ese fichero, desarrollo puede usar producción. No apliques la migración ni despliegues el cliente en producción sin autorización independiente de Jose; aplica la migración autorizada antes de publicar una interfaz que use estas RPC.
