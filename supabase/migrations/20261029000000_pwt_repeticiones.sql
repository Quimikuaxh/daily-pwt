-- Daily PWT · F5: historial y repeticiones (REQUISITOS-F5, DEC-67).
-- Cada jugador guarda la repetición de sus 20 últimos oficiales y puede compartir hasta 20 (la 21.ª borra la más antigua). Los datos
-- son la grabación comprimida (gzip en base64) que hace el cliente: el servidor no la interpreta, solo limita su tamaño.
-- Se puede volver a ejecutar entera.

-- Límites: repeticiones por jugador en el historial y compartidas, y tamaño de una grabación (la mayor medida, 5 KB; margen de sobra).
create or replace function pwt.replay_limit() returns integer language sql immutable as $$ select 20 $$;
create or replace function pwt.replay_max_bytes() returns integer language sql immutable as $$ select 65536 $$;

create table if not exists pwt.replays (
  user_id uuid not null,
  date date not null,
  data text not null,
  shared_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, date),
  foreign key (user_id, date) references pwt.day_results (user_id, date) on delete cascade on update cascade
);

create table if not exists pwt.shared_replays (
  id text primary key,
  owner uuid references auth.users (id) on delete set null,
  nickname text,
  date date not null,
  challenge_number integer not null,
  trainer_id text not null,
  data text not null,
  created_at timestamptz not null default now()
);
create index if not exists shared_replays_owner on pwt.shared_replays (owner, created_at);

alter table pwt.replays enable row level security;
alter table pwt.shared_replays enable row level security;
revoke all on pwt.replays, pwt.shared_replays from anon, authenticated;

-- Id corto y aleatorio para el enlace (10 caracteres de [a-z0-9]: ~5·10^15 combinaciones).
create or replace function pwt.new_replay_id() returns text
language plpgsql volatile set search_path = pwt, pg_temp
as $$
declare
  alphabet constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  candidate text;
begin
  loop
    candidate := (select string_agg(substr(alphabet, 1 + floor(random() * 36)::integer, 1), '') from generate_series(1, 10));
    exit when not exists (select 1 from pwt.shared_replays where id = candidate);
  end loop;
  return candidate;
end $$;

-- Guarda la repetición de un oficial propio terminado (RF-120). Al pasar de 20, borra la más antigua (RF-125); su resultado se queda.
create or replace function pwt.save_replay(p_date date, p_data text) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
begin
  if p_data is null or length(p_data) = 0 or length(p_data) > pwt.replay_max_bytes() then raise exception 'invalid_replay'; end if;
  if not exists (select 1 from pwt.day_results where user_id = uid and date = p_date and status in ('won', 'lost')) then
    raise exception 'not_finished';
  end if;
  insert into pwt.replays (user_id, date, data) values (uid, p_date, p_data)
  on conflict (user_id, date) do update set data = excluded.data;
  delete from pwt.replays
  where user_id = uid and date not in (select date from pwt.replays where user_id = uid order by date desc limit pwt.replay_limit());
end $$;

-- Historial (RF-124, RF-126): los oficiales con repetición, del más reciente al más antiguo, con su resultado y su enlace si lo tiene.
create or replace function pwt.my_history() returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', r.date, 'challengeNumber', d.challenge_number, 'trainerId', d.trainer_id, 'variantId', d.variant_id, 'status', d.status,
    'turns', d.turns, 'survivors', d.survivors, 'sharedId', r.shared_id) order by r.date desc), '[]'::jsonb)
  from pwt.replays r join pwt.day_results d on d.user_id = r.user_id and d.date = r.date
  where r.user_id = pwt.require_user()
$$;

create or replace function pwt.get_my_replay(p_date date) returns text
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  found_data text;
begin
  select data into found_data from pwt.replays where user_id = pwt.require_user() and date = p_date;
  if found_data is null then raise exception 'replay_not_found'; end if;
  return found_data;
end $$;

-- Comparte la repetición de ese día (RF-131): crea la copia permanente o devuelve la que ya hay. Al pasar de 20 compartidas, borra la
-- más antigua (RF-133).
create or replace function pwt.share_replay(p_date date) returns text
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
  replay pwt.replays%rowtype;
  day pwt.day_results%rowtype;
  new_id text;
begin
  select * into replay from pwt.replays where user_id = uid and date = p_date for update;
  if not found then raise exception 'replay_not_found'; end if;
  if replay.shared_id is not null and exists (select 1 from pwt.shared_replays where id = replay.shared_id) then return replay.shared_id; end if;
  select * into day from pwt.day_results where user_id = uid and date = p_date;
  new_id := pwt.new_replay_id();
  insert into pwt.shared_replays (id, owner, nickname, date, challenge_number, trainer_id, data)
  values (new_id, uid, (select nickname from pwt.profiles where id = uid), p_date, day.challenge_number, day.trainer_id, replay.data);
  update pwt.replays set shared_id = new_id where user_id = uid and date = p_date;
  -- Borrar la más antigua también quita su enlace del historial.
  with gone as (
    delete from pwt.shared_replays
    where owner = uid and id not in (select id from pwt.shared_replays where owner = uid order by created_at desc, id limit pwt.replay_limit())
    returning id
  )
  update pwt.replays set shared_id = null where user_id = uid and shared_id in (select id from gone);
  return new_id;
end $$;

-- Repetición compartida (RF-132): también sin sesión. `mine` dice si es de quien mira (para «Borrar enlace», RF-133).
create or replace function pwt.get_shared_replay(p_id text) returns jsonb
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  shared pwt.shared_replays%rowtype;
begin
  select * into shared from pwt.shared_replays where id = p_id;
  if not found then raise exception 'replay_not_found'; end if;
  return jsonb_build_object('id', shared.id, 'nickname', shared.nickname, 'date', shared.date, 'challengeNumber', shared.challenge_number,
    'trainerId', shared.trainer_id, 'data', shared.data, 'mine', coalesce(shared.owner = auth.uid(), false));
end $$;

create or replace function pwt.delete_shared_replay(p_id text) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
begin
  delete from pwt.shared_replays where id = p_id and owner = uid;
  if not found then raise exception 'replay_not_found'; end if;
  update pwt.replays set shared_id = null where user_id = uid and shared_id = p_id;
end $$;

revoke all on function pwt.replay_limit(), pwt.replay_max_bytes(), pwt.new_replay_id() from public, anon, authenticated;
revoke all on function pwt.save_replay(date, text), pwt.my_history(), pwt.get_my_replay(date), pwt.share_replay(date),
  pwt.get_shared_replay(text), pwt.delete_shared_replay(text) from public;
grant execute on function pwt.save_replay(date, text), pwt.my_history(), pwt.get_my_replay(date), pwt.share_replay(date),
  pwt.delete_shared_replay(text) to authenticated;
-- Un enlace compartido se abre sin sesión (RF-132).
grant execute on function pwt.get_shared_replay(text) to anon, authenticated;
