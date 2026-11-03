-- Daily PWT · Aviso por Discord (RF-115 a RF-119, DEC-77): un mensaje privado a la hora que elige el jugador si aún no ha jugado el oficial
-- del día. Solo con cuenta. El cliente vincula, cambia la hora y desvincula con las funciones de abajo; la Edge Function `pwt-discord`
-- (con la clave `service_role`) termina la vinculación y manda los avisos, que pide `pg_cron` cada 15 minutos. Se puede volver a ejecutar
-- entera.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Una cuenta de Discord por jugador y un jugador por cuenta de Discord (vincularla en otro jugador la quita del anterior).
create table if not exists pwt.discord_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  -- Nombre que se enseña en Cuenta («Conectado como …»).
  discord_name text not null,
  enabled boolean not null default true,
  -- Hora del aviso en minutos desde la medianoche de `time_zone`, de media en media hora (RF-116). Por defecto, las 20:00.
  remind_minute integer not null default 1200 constraint discord_links_minute check (remind_minute between 0 and 1410 and remind_minute % 30 = 0),
  -- Zona del dispositivo con que se eligió la hora (IANA, p. ej. `Europe/Madrid`).
  time_zone text not null,
  -- Último aviso enviado: como mucho uno cada 20 horas, aunque la tarea se retrase o cambie la hora (RF-117).
  last_sent_at timestamptz,
  -- El último mensaje no llegó (privados cerrados o fuera del servidor): Cuenta lo avisa (RF-118).
  failed boolean not null default false,
  linked_at timestamptz not null default now()
);
alter table pwt.discord_links enable row level security;

-- Vinculaciones en curso: el `state` del OAuth de Discord, que dice a qué jugador va la cuenta de Discord que vuelve. Caduca a los 10 min.
create table if not exists pwt.discord_link_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  time_zone text not null,
  expires_at timestamptz not null
);
alter table pwt.discord_link_states enable row level security;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------------------------------------------------------------

create or replace function pwt.valid_time_zone(p_time_zone text) returns boolean
language sql stable set search_path = pwt, pg_temp
as $$ select p_time_zone is not null and exists (select 1 from pg_timezone_names where name = p_time_zone) $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Funciones del cliente (con cuenta)
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Empieza la vinculación: devuelve el `state` que la Edge Function lleva a Discord y comprueba a la vuelta.
create or replace function pwt.discord_link_start(p_time_zone text) returns text
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_registered();
  new_state text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not pwt.valid_time_zone(p_time_zone) then raise exception 'invalid_time_zone'; end if;
  delete from pwt.discord_link_states where user_id = uid or expires_at < now();
  insert into pwt.discord_link_states (state, user_id, time_zone, expires_at) values (new_state, uid, p_time_zone, now() + interval '10 minutes');
  return new_state;
end $$;

-- Aviso del jugador, o `null` si no ha vinculado Discord.
create or replace function pwt.discord_reminder() returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select jsonb_build_object('name', discord_name, 'enabled', enabled, 'minute', remind_minute, 'timeZone', time_zone, 'failed', failed)
  from pwt.discord_links where user_id = pwt.require_registered()
$$;

-- Activar o desactivar el aviso y cambiar su hora (con la zona del dispositivo desde el que se cambia).
create or replace function pwt.set_discord_reminder(p_enabled boolean, p_minute integer, p_time_zone text) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_registered();
begin
  if p_enabled is null or p_minute is null or p_minute not between 0 and 1410 or p_minute % 30 <> 0 then raise exception 'invalid_reminder'; end if;
  if not pwt.valid_time_zone(p_time_zone) then raise exception 'invalid_time_zone'; end if;
  update pwt.discord_links set enabled = p_enabled, remind_minute = p_minute, time_zone = p_time_zone where user_id = uid;
  if not found then raise exception 'not_linked'; end if;
end $$;

create or replace function pwt.discord_unlink() returns void
language sql volatile security definer set search_path = pwt, pg_temp
as $$ delete from pwt.discord_links where user_id = pwt.require_registered() $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Funciones de la Edge Function (`service_role`)
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Termina la vinculación con el `state` de `discord_link_start` (una sola vez y antes de que caduque). Devuelve el jugador.
create or replace function pwt.discord_link_finish(p_state text, p_discord_id text, p_discord_name text) returns uuid
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  pending pwt.discord_link_states;
begin
  delete from pwt.discord_link_states where state = p_state returning * into pending;
  if pending is null or pending.expires_at < now() then raise exception 'invalid_state'; end if;
  if coalesce(p_discord_id, '') !~ '^[0-9]{1,20}$' or coalesce(p_discord_name, '') = '' then raise exception 'invalid_discord_user'; end if;
  delete from pwt.discord_links where discord_id = p_discord_id and user_id <> pending.user_id;
  insert into pwt.discord_links (user_id, discord_id, discord_name, time_zone)
  values (pending.user_id, p_discord_id, left(p_discord_name, 32), pending.time_zone)
  on conflict (user_id) do update set discord_id = excluded.discord_id, discord_name = excluded.discord_name, failed = false, linked_at = now();
  return pending.user_id;
end $$;

-- Avisos que tocan ahora (RF-117): activos, con la hora elegida en la última hora de su zona, sin aviso en las últimas 20 horas y sin el
-- oficial de hoy (Madrid) empezado. Los marca como enviados al darlos, así que dos llamadas seguidas no avisan dos veces.
create or replace function pwt.discord_due_reminders() returns table (user_id uuid, discord_id text)
language sql volatile security definer set search_path = pwt, pg_temp
as $$
  with due as (
    select l.user_id from pwt.discord_links l
    where l.enabled
      and (l.last_sent_at is null or l.last_sent_at < now() - interval '20 hours')
      and (((extract(hour from now() at time zone l.time_zone) * 60 + extract(minute from now() at time zone l.time_zone))::integer
            - l.remind_minute + 1440) % 1440) < 60
      and not exists (select 1 from pwt.day_results r where r.user_id = l.user_id and r.date = pwt.madrid_today())
    for update of l skip locked
  )
  update pwt.discord_links l set last_sent_at = now() from due where l.user_id = due.user_id
  returning l.user_id, l.discord_id
$$;

-- Si el mensaje llegó o no (RF-118).
create or replace function pwt.discord_report(p_user_id uuid, p_delivered boolean) returns void
language sql volatile security definer set search_path = pwt, pg_temp
as $$ update pwt.discord_links set failed = not p_delivered where user_id = p_user_id $$;

-- Lo que llama `pg_cron`: avisa a la Edge Function con la URL y el secreto guardados en Vault (README, «Aviso por Discord»). Sin `pg_net`
-- o sin los secretos, no hace nada.
create or replace function pwt.discord_ping() returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  target text;
  secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') or to_regclass('vault.decrypted_secrets') is null then return; end if;
  execute $q$select (select decrypted_secret from vault.decrypted_secrets where name = 'pwt_discord_url'),
                    (select decrypted_secret from vault.decrypted_secrets where name = 'pwt_discord_cron_secret')$q$ into target, secret;
  if target is null or secret is null then return; end if;
  execute 'select net.http_post(url := $1, headers := $2, body := ''{}''::jsonb)'
    using target, jsonb_build_object('Content-Type', 'application/json', 'x-pwt-cron', secret);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Permisos y tarea
-- ---------------------------------------------------------------------------------------------------------------------------------

revoke all on function
  pwt.valid_time_zone(text), pwt.discord_link_start(text), pwt.discord_reminder(), pwt.set_discord_reminder(boolean, integer, text),
  pwt.discord_unlink(), pwt.discord_link_finish(text, text, text), pwt.discord_due_reminders(), pwt.discord_report(uuid, boolean),
  pwt.discord_ping()
from public, anon, authenticated;
grant execute on function pwt.discord_link_start(text), pwt.discord_reminder(), pwt.set_discord_reminder(boolean, integer, text), pwt.discord_unlink()
to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema pwt to service_role;
    grant execute on function pwt.discord_link_finish(text, text, text), pwt.discord_due_reminders(), pwt.discord_report(uuid, boolean)
    to service_role;
  end if;
end $$;

-- Cada 15 minutos (necesita pg_cron; si no está, se omite).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pwt-discord-reminders', '*/15 * * * *', 'select pwt.discord_ping()');
  end if;
end $$;
