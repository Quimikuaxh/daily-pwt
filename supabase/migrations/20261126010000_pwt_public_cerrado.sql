-- El esquema `public` del proyecto Supabase compartido (DEC-63) es de las otras apps: claude-test entra por conexión directa a Postgres
-- como propietario y pokemon-heardle con `service_role`; daily-pwt vive en `pwt`. Ninguna usa la clave pública (`anon`/`authenticated`)
-- sobre `public`, pero Supabase les concede todo por defecto (también a las tablas nuevas). Con RLS sin políticas eso no deja leer nada;
-- sin RLS (una tabla nueva o una que la pierde) la abriría entera, incluido `TRUNCATE`, a cualquiera con la clave publicada en la web.
-- Se quitan los permisos existentes y los que se darían por defecto a lo que cree `postgres`. Idempotente.
--
-- Límite: los permisos por defecto de lo que cree `supabase_admin` no los puede cambiar `postgres` (no es miembro); ese rol es interno de
-- Supabase y no lo usan las migraciones ni el panel de tablas.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
