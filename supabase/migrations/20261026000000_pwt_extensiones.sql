-- Daily PWT · Extensiones que usan las migraciones siguientes. En producción se activaron desde el panel (README, «Cuentas y rankings»);
-- esta migración las activa en el Supabase local (`npx supabase start`). Donde no existen (PGlite de los tests), no hace nada.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
end $$;
