-- Daily PWT · F4: cuentas, rachas y rankings (REQUISITOS-F4, DEC-63).
-- Todo vive en el esquema `pwt` del proyecto de Supabase compartido con claude-test y pokemon-heardle.
-- El cliente no lee ni escribe tablas: solo llama a las funciones de abajo (`security definer`), que comprueban quién llama y qué
-- escribe. Las tablas tienen RLS activado y ninguna política, así que la clave `anon` no las abre.
-- Se puede volver a ejecutar entera: crea lo que falte y redefine las funciones.

create schema if not exists pwt;
grant usage on schema pwt to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Un perfil por jugador, con cuenta o sin ella (sesión anónima): RF-94, RF-95, RF-112.
create table if not exists pwt.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- RF-95: de 3 a 16 letras sin tilde, números y `_`. Único entre todos sin distinguir mayúsculas (índice de abajo); se guarda tal como se
  -- escribió. `null`: nombre de un jugador sin cuenta liberado por inactividad (RF-113); recibe otro al volver.
  nickname text constraint profiles_nickname_format check (nickname ~ '^[A-Za-z0-9_]{3,16}$'),
  -- Con cuenta de Google (tick de verificado en los rankings, amigos). Pasa a `true` al enlazar Google y no vuelve atrás.
  registered boolean not null default false,
  -- Último oficial empezado (o alta del perfil): a los 30 días sin jugar se libera el nombre de quien no tiene cuenta (RF-113).
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_nickname_key on pwt.profiles (lower(nickname));

-- Un oficial por usuario y día del reto (RF-79, RF-98). También los de las sesiones anónimas (RF-104b): cuentan para la media del día.
create table if not exists pwt.day_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  challenge_number integer not null,
  trainer_id text not null,
  variant_id text not null,
  data_version text not null,
  status text not null check (status in ('inProgress', 'won', 'lost', 'void')),
  started_at timestamptz not null,
  finished_at timestamptz,
  turns integer,
  survivors integer,
  player_fainted boolean[],
  rival_fainted integer,
  end_reason text,
  void_reason text,
  -- Subido del historial del navegador al iniciar sesión (RF-97): cuenta para racha y estadísticas, no para puntos ni para la media.
  imported boolean not null default false,
  -- Resultado coherente con el último estado guardado (RF-101). Solo los validados puntúan y entran en la media del día.
  validated boolean not null default false,
  primary key (user_id, date)
);
create index if not exists day_results_date on pwt.day_results (date);

-- Estado del oficial en curso (RF-100, RF-102): se guarda tras cada turno y se borra al terminar.
create table if not exists pwt.battle_states (
  user_id uuid not null,
  date date not null,
  seed text not null,
  ai text not null,
  lead_index integer not null,
  player_size integer not null,
  rival_size integer not null,
  decisions jsonb not null default '[]'::jsonb,
  turn integer not null default 0,
  player_remaining integer not null,
  rival_remaining integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  foreign key (user_id, date) references pwt.day_results (user_id, date) on delete cascade
);

-- Multiplicador fijado al cerrar el día (RF-104, RF-105). Mientras un día no tiene fila, su multiplicador es provisional.
create table if not exists pwt.day_difficulty (
  date date primary key,
  players integer not null,
  average numeric not null,
  multiplier numeric not null,
  closed_at timestamptz not null default now()
);

-- Amistades (RF-110): una fila por pareja, sea cual sea la dirección; `pending` hasta que el destinatario acepta.
create table if not exists pwt.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair_key on pwt.friendships (least(requester, addressee), greatest(requester, addressee));

alter table pwt.profiles enable row level security;
alter table pwt.day_results enable row level security;
alter table pwt.battle_states enable row level security;
alter table pwt.day_difficulty enable row level security;
alter table pwt.friendships enable row level security;
revoke all on all tables in schema pwt from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Utilidades internas
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Día del reto en curso: cambia a medianoche de Madrid, con su horario de verano (RF-105).
create or replace function pwt.madrid_today() returns date
language sql stable set search_path = pwt, pg_temp
as $$ select (now() at time zone 'Europe/Madrid')::date $$;

-- Usuario de la sesión (con Google o anónima). Sin sesión, error.
create or replace function pwt.require_user() returns uuid
language plpgsql stable set search_path = pwt, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return auth.uid();
end $$;

-- Usuario con cuenta (no anónimo). Las sesiones anónimas solo juegan para la media del día (RF-104b).
create or replace function pwt.require_registered() returns uuid
language plpgsql stable set search_path = pwt, pg_temp
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'not_registered'; end if;
  return auth.uid();
end $$;

-- Usuario con perfil (con cuenta o sin ella).
create or replace function pwt.require_profile() returns uuid
language plpgsql stable set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
begin
  if not exists (select 1 from pwt.profiles where id = uid and nickname is not null) then raise exception 'no_profile'; end if;
  return uid;
end $$;

-- Usuario con cuenta y perfil: lo que hace falta para amigos (RF-110, solo entre jugadores con cuenta).
create or replace function pwt.require_member() returns uuid
language plpgsql stable set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_registered();
begin
  if not exists (select 1 from pwt.profiles where id = uid and registered and nickname is not null) then raise exception 'no_profile'; end if;
  return uid;
end $$;

-- Nickname por defecto libre: `entrenador_` + 5 cifras (RF-94).
create or replace function pwt.default_nickname() returns text
language plpgsql volatile set search_path = pwt, pg_temp
as $$
declare
  candidate text;
begin
  for attempt in 1..200 loop
    candidate := 'entrenador_' || lpad((floor(random() * 100000))::integer::text, 5, '0');
    if not exists (select 1 from pwt.profiles where lower(nickname) = candidate) then return candidate; end if;
  end loop;
  raise exception 'nickname_unavailable';
end $$;

-- Supervivientes que cuentan: los de una victoria. Perder o rendirse da 0 (RF-103), aunque al rendirse quedaran Pokémon en pie.
create or replace function pwt.day_score(p_status text, p_survivors integer) returns integer
language sql immutable
as $$ select case when p_status = 'won' then coalesce(p_survivors, 0) else 0 end $$;

-- RF-104: 1 + (6 − media) / 6, de ×1 (todos acaban con 6) a ×2 (media 0).
create or replace function pwt.multiplier_of(p_average numeric) returns numeric
language sql immutable
as $$ select round(1 + (6 - coalesce(p_average, 6)) / 6, 4) $$;

-- `p_decisions` empieza por `p_prefix` (los dos, arrays JSON).
create or replace function pwt.extends_decisions(p_decisions jsonb, p_prefix jsonb) returns boolean
language sql immutable
as $$
  select jsonb_typeof(p_decisions) = 'array'
    and jsonb_array_length(p_decisions) >= jsonb_array_length(p_prefix)
    and coalesce((select jsonb_agg(item order by position) from jsonb_array_elements(p_decisions) with ordinality as t(item, position)
                  where position <= jsonb_array_length(p_prefix)), '[]'::jsonb) = p_prefix
$$;

-- Amigos aceptados de un usuario.
create or replace function pwt.friend_ids(p_user uuid) returns setof uuid
language sql stable set search_path = pwt, pg_temp
as $$
  select case when requester = p_user then addressee else requester end
  from pwt.friendships
  where status = 'accepted' and (requester = p_user or addressee = p_user)
$$;

-- Puntos de cada oficial validado entre dos fechas (RF-103 a RF-105). El multiplicador es el fijado al cierre o, si el día sigue
-- abierto, el de la media que hay ahora (provisional). Un oficial terminado tras el cierre puntúa con el multiplicador ya fijado.
create or replace function pwt.day_points(p_from date, p_to date)
returns table (user_id uuid, date date, points numeric, provisional boolean)
language sql stable set search_path = pwt, pg_temp
as $$
  with live as (
    select r.date, avg(pwt.day_score(r.status, r.survivors)) as average
    from pwt.day_results r
    where r.date between p_from and p_to and r.validated and r.status in ('won', 'lost')
    group by r.date
  ), multipliers as (
    select l.date, coalesce(d.multiplier, pwt.multiplier_of(l.average)) as multiplier, d.date is null as provisional
    from live l left join pwt.day_difficulty d on d.date = l.date
  )
  select r.user_id, r.date, round(pwt.day_score(r.status, r.survivors) * m.multiplier, 2), m.provisional
  from pwt.day_results r join multipliers m on m.date = r.date
  where r.validated and r.status in ('won', 'lost')
$$;

-- Racha de victorias viva de cada usuario (RF-107; mismo criterio que `computeStats`): días seguidos ganados que acaban hoy o, si hoy
-- no tiene el oficial terminado, ayer. Perder, anular o no jugar la corta. Los días importados cuentan.
create or replace function pwt.current_streaks()
returns table (user_id uuid, streak integer)
language sql stable set search_path = pwt, pg_temp
as $$
  with anchors as (
    select r.user_id,
           case when bool_or(r.date = pwt.madrid_today() and r.status <> 'inProgress') then pwt.madrid_today() else pwt.madrid_today() - 1 end as anchor
    from pwt.day_results r
    group by r.user_id
  ), islands as (
    select r.user_id, r.date, r.date - (row_number() over (partition by r.user_id order by r.date))::integer as island
    from pwt.day_results r
    where r.status = 'won'
  )
  select i.user_id, count(*)::integer
  from islands i join anchors a on a.user_id = i.user_id
  where i.island = (select i2.island from islands i2 where i2.user_id = i.user_id and i2.date = a.anchor)
    and i.date <= a.anchor
  group by i.user_id
$$;

-- Un día del historial con el formato de `DayRecord` del cliente (`battle` solo mientras está en curso).
create or replace function pwt.day_json(p_user uuid, p_date date) returns jsonb
language sql stable set search_path = pwt, pg_temp
as $$
  select jsonb_build_object(
    'date', r.date, 'challengeNumber', r.challenge_number, 'trainerId', r.trainer_id, 'variantId', r.variant_id,
    'dataVersion', r.data_version, 'status', r.status, 'startedAt', r.started_at, 'finishedAt', r.finished_at, 'turns', r.turns,
    'survivors', r.survivors, 'playerFainted', to_jsonb(r.player_fainted), 'rivalFainted', r.rival_fainted, 'endReason', r.end_reason,
    'voidReason', r.void_reason, 'imported', r.imported, 'validated', r.validated,
    'battle', case when s.user_id is null then null else jsonb_build_object(
      'seed', s.seed, 'ai', s.ai, 'leadIndex', s.lead_index, 'decisions', s.decisions,
      'checkpoint', case when jsonb_array_length(s.decisions) = 0 then null else jsonb_build_object(
        'decisions', jsonb_array_length(s.decisions), 'turn', s.turn, 'playerRemaining', s.player_remaining, 'rivalRemaining', s.rival_remaining) end) end)
  from pwt.day_results r
  left join pwt.battle_states s on s.user_id = r.user_id and s.date = r.date
  where r.user_id = p_user and r.date = p_date
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Perfil (RF-94, RF-95)
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Perfil del jugador, con cuenta o sin ella (RF-94): la primera vez, o si su nombre se liberó (RF-113), le da uno por defecto libre. Con
-- sesión de Google marca el perfil como registrado (también el de una sesión anónima recién enlazada, que conserva su nombre).
create or replace function pwt.ensure_profile() returns jsonb
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
  is_registered boolean := not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  profile pwt.profiles%rowtype;
begin
  for attempt in 1..20 loop
    begin
      select * into profile from pwt.profiles where id = uid for update;
      if found and profile.nickname is not null then
        if is_registered and not profile.registered then update pwt.profiles set registered = true where id = uid; end if;
        return jsonb_build_object('nickname', profile.nickname, 'created', false, 'registered', profile.registered or is_registered);
      end if;
      if found then
        update pwt.profiles set nickname = pwt.default_nickname(), registered = registered or is_registered, last_active_at = now()
        where id = uid returning * into profile;
      else
        insert into pwt.profiles (id, nickname, registered) values (uid, pwt.default_nickname(), is_registered) returning * into profile;
      end if;
      return jsonb_build_object('nickname', profile.nickname, 'created', true, 'registered', profile.registered);
    exception when unique_violation then
      -- Otro jugador cogió ese nombre a la vez, o el perfil se creó a la vez desde otra pestaña: se vuelve a mirar.
      null;
    end;
  end loop;
  raise exception 'nickname_unavailable';
end $$;

-- RF-113: libera los nombres de los jugadores sin cuenta que llevan 30 días sin empezar un oficial. Lo lanza `pg_cron` a diario.
create or replace function pwt.release_idle_nicknames() returns integer
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  released integer;
begin
  update pwt.profiles set nickname = null
  where not registered and nickname is not null and last_active_at < now() - interval '30 days';
  get diagnostics released = row_count;
  return released;
end $$;

-- Cambia el nickname cuantas veces se quiera, con o sin cuenta; si está cogido por quien sea, no cambia (RF-95).
create or replace function pwt.set_nickname(p_nickname text) returns text
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_profile();
begin
  if p_nickname is null or p_nickname !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'invalid_nickname'; end if;
  update pwt.profiles set nickname = p_nickname where id = uid;
  return p_nickname;
exception when unique_violation then
  raise exception 'nickname_taken';
end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Oficial del día (RF-98, RF-100, RF-101)
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Registra el oficial de hoy al empezarlo. Si la cuenta ya lo tiene (otro dispositivo), no crea otro y devuelve el que hay.
create or replace function pwt.start_official(
  p_date date, p_challenge_number integer, p_trainer_id text, p_variant_id text, p_data_version text,
  p_seed text, p_ai text, p_lead_index integer, p_player_size integer, p_rival_size integer
) returns jsonb
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
begin
  if p_date is distinct from pwt.madrid_today() then raise exception 'wrong_date'; end if;
  if p_player_size not between 1 and 6 or p_rival_size not between 1 and 6 or p_lead_index not between 0 and p_player_size - 1
     or p_ai not in ('heuristic', 'trivial') or coalesce(p_seed, '') = '' then
    raise exception 'invalid_battle';
  end if;
  insert into pwt.day_results (user_id, date, challenge_number, trainer_id, variant_id, data_version, status, started_at)
  values (uid, p_date, p_challenge_number, p_trainer_id, p_variant_id, p_data_version, 'inProgress', now())
  on conflict (user_id, date) do nothing;
  if not found then
    return jsonb_build_object('created', false, 'day', pwt.day_json(uid, p_date));
  end if;
  insert into pwt.battle_states (user_id, date, seed, ai, lead_index, player_size, rival_size, player_remaining, rival_remaining)
  values (uid, p_date, p_seed, p_ai, p_lead_index, p_player_size, p_rival_size, p_player_size, p_rival_size);
  update pwt.profiles set last_active_at = now() where id = uid;
  return jsonb_build_object('created', true, 'day', pwt.day_json(uid, p_date));
end $$;

-- Estado tras un turno (RF-100): solo del oficial propio en curso; las decisiones solo crecen (y empiezan por las ya guardadas), el turno
-- no retrocede y los Pokémon en pie no aumentan.
create or replace function pwt.save_turn(
  p_date date, p_decisions jsonb, p_turn integer, p_player_remaining integer, p_rival_remaining integer
) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
  state pwt.battle_states%rowtype;
begin
  select * into state from pwt.battle_states where user_id = uid and date = p_date for update;
  if not found then raise exception 'no_battle'; end if;
  if jsonb_typeof(p_decisions) is distinct from 'array' or jsonb_array_length(p_decisions) <= jsonb_array_length(state.decisions) then
    raise exception 'stale_turn';
  end if;
  if not pwt.extends_decisions(p_decisions, state.decisions) then raise exception 'decisions_mismatch'; end if;
  if p_turn < state.turn or p_player_remaining not between 0 and state.player_remaining
     or p_rival_remaining not between 0 and state.rival_remaining then
    raise exception 'incoherent_state';
  end if;
  update pwt.battle_states
  set decisions = p_decisions, turn = p_turn, player_remaining = p_player_remaining, rival_remaining = p_rival_remaining, updated_at = now()
  where user_id = uid and date = p_date;
end $$;

-- Resultado del oficial (RF-101). Se guarda siempre (cuenta para racha), pero solo puntúa si es coherente con el último estado: hay
-- estados guardados, las decisiones siguen a las guardadas, el combate acaba en ese turno o en el siguiente, no revive nadie y gana
-- quien debilita a todo el equipo contrario. El estado se borra.
create or replace function pwt.finish_official(
  p_date date, p_result text, p_reason text, p_turns integer, p_survivors integer, p_player_fainted boolean[], p_rival_fainted integer,
  p_decisions jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
  state pwt.battle_states%rowtype;
  coherent boolean;
begin
  if p_result not in ('win', 'loss') or p_reason not in ('faint', 'forfeit', 'turnLimit', 'tie') then raise exception 'invalid_result'; end if;
  perform 1 from pwt.day_results where user_id = uid and date = p_date and status = 'inProgress' for update;
  if not found then raise exception 'not_in_progress'; end if;
  select * into state from pwt.battle_states where user_id = uid and date = p_date;
  coherent := found
    and jsonb_array_length(state.decisions) > 0
    and pwt.extends_decisions(p_decisions, state.decisions)
    and p_turns between state.turn and state.turn + 1
    and p_survivors between 0 and state.player_remaining
    and coalesce(cardinality(p_player_fainted), -1) = state.player_size
    and p_survivors = (select count(*) from unnest(p_player_fainted) as fainted where not fainted)
    and p_rival_fainted between state.rival_size - state.rival_remaining and state.rival_size
    and (p_result = 'win') = (p_rival_fainted = state.rival_size and p_survivors > 0)
    and (p_result = 'win' or p_survivors = 0 or p_reason in ('forfeit', 'turnLimit'));
  update pwt.day_results
  set status = case when p_result = 'win' then 'won' else 'lost' end, finished_at = now(), turns = p_turns, survivors = p_survivors,
      player_fainted = p_player_fainted, rival_fainted = p_rival_fainted, end_reason = p_reason, validated = coalesce(coherent, false)
  where user_id = uid and date = p_date;
  delete from pwt.battle_states where user_id = uid and date = p_date;
  return jsonb_build_object('validated', coalesce(coherent, false));
end $$;

-- Oficial que no se pudo reanudar (RF-83): gasta el día, 0 puntos y fuera de la media.
create or replace function pwt.void_official(p_date date, p_reason text) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
begin
  update pwt.day_results set status = 'void', void_reason = p_reason, finished_at = now(), validated = false
  where user_id = uid and date = p_date and status = 'inProgress';
  if not found then raise exception 'not_in_progress'; end if;
  delete from pwt.battle_states where user_id = uid and date = p_date;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Historial de la cuenta (RF-97, RF-99)
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Sube los días terminados del navegador que la cuenta no tenga (si ya lo tiene, manda la cuenta). Quedan como importados.
create or replace function pwt.import_days(p_days jsonb) returns integer
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_registered();
  inserted integer;
begin
  if jsonb_typeof(p_days) is distinct from 'array' or jsonb_array_length(p_days) > 2000 then raise exception 'invalid_days'; end if;
  insert into pwt.day_results (user_id, date, challenge_number, trainer_id, variant_id, data_version, status, started_at, finished_at, turns,
                               survivors, player_fainted, rival_fainted, end_reason, void_reason, imported, validated)
  select uid, d.date, d."challengeNumber", d."trainerId", d."variantId", d."dataVersion", d.status, d."startedAt", d."finishedAt", d.turns,
         d.survivors, d."playerFainted", d."rivalFainted", d."endReason", d."voidReason", true, false
  from jsonb_to_recordset(p_days) as d(date date, "challengeNumber" integer, "trainerId" text, "variantId" text, "dataVersion" text,
       status text, "startedAt" timestamptz, "finishedAt" timestamptz, turns integer, survivors integer, "playerFainted" boolean[],
       "rivalFainted" integer, "endReason" text, "voidReason" text)
  where d.date is not null and d.date <= pwt.madrid_today() and d.status in ('won', 'lost', 'void')
    and d."challengeNumber" is not null and d."trainerId" is not null and d."variantId" is not null and d."dataVersion" is not null
    and d."startedAt" is not null
  on conflict (user_id, date) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end $$;

-- Todo el historial de la cuenta (también el oficial en curso, con lo necesario para reanudarlo en otro dispositivo, RF-102).
create or replace function pwt.my_days() returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select coalesce(jsonb_agg(pwt.day_json(r.user_id, r.date) order by r.date), '[]'::jsonb)
  from pwt.day_results r
  where r.user_id = pwt.require_user()
$$;

-- Perfil y puntos del jugador (con cuenta o sin ella): nickname, puntos por día (con su multiplicador provisional o fijado) y solicitudes
-- de amistad pendientes.
create or replace function pwt.my_summary() returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select jsonb_build_object(
    'nickname', (select nickname from pwt.profiles where id = pwt.require_user()),
    'registered', coalesce((select registered from pwt.profiles where id = auth.uid()), false),
    'points', coalesce((select jsonb_agg(jsonb_build_object('date', p.date, 'points', p.points, 'provisional', p.provisional) order by p.date)
                        from pwt.day_points('-infinity', 'infinity') p where p.user_id = auth.uid()), '[]'::jsonb),
    'incomingRequests', (select count(*) from pwt.friendships where addressee = auth.uid() and status = 'pending'))
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Cierre del día (RF-105): lo lanza `pg_cron` cada hora
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Fija el multiplicador de los días cuya medianoche de Madrid ya pasó y aún no estaban cerrados. Devuelve cuántos ha cerrado.
create or replace function pwt.close_days() returns integer
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  closed integer;
begin
  insert into pwt.day_difficulty (date, players, average, multiplier)
  select r.date, count(*), round(avg(pwt.day_score(r.status, r.survivors)), 4), pwt.multiplier_of(avg(pwt.day_score(r.status, r.survivors)))
  from pwt.day_results r
  where r.date < pwt.madrid_today() and r.validated and r.status in ('won', 'lost')
    and not exists (select 1 from pwt.day_difficulty d where d.date = r.date)
  group by r.date;
  get diagnostics closed = row_count;
  return closed;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Rankings (RF-106 a RF-109, RF-112): todos los jugadores con perfil, con cuenta (`verified`) o sin ella. Un nombre liberado (RF-113)
-- sale como `null`.
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Los `p_limit` primeros y, si no está entre ellos, el propio jugador. Empate compartido: misma posición (1, 1, 3).
-- `p_scope`: 'global' o 'friends' (el jugador y sus amigos aceptados).
create or replace function pwt.points_ranking(p_month date, p_scope text, p_limit integer default 50)
returns table (rank integer, nickname text, verified boolean, points numeric, provisional boolean, me boolean)
language sql stable security definer set search_path = pwt, pg_temp
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as first_day, (date_trunc('month', p_month) + interval '1 month - 1 day')::date as last_day
  ), totals as (
    select p.user_id, sum(p.points) as points, bool_or(p.provisional) as provisional
    from bounds b, pwt.day_points(b.first_day, b.last_day) p
    where p.date between b.first_day and b.last_day
    group by p.user_id
  ), ranked as (
    select (rank() over (order by t.points desc))::integer as rank, pr.nickname, pr.registered as verified, t.points, t.provisional,
           pr.id = auth.uid() as me
    from totals t join pwt.profiles pr on pr.id = t.user_id
    where p_scope = 'global' or pr.id = auth.uid() or pr.id in (select pwt.friend_ids(auth.uid()))
  )
  select * from ranked where rank <= p_limit or me order by rank, nickname nulls last
$$;

create or replace function pwt.streak_ranking(p_scope text, p_limit integer default 50)
returns table (rank integer, nickname text, verified boolean, streak integer, me boolean)
language sql stable security definer set search_path = pwt, pg_temp
as $$
  with ranked as (
    select (rank() over (order by s.streak desc))::integer as rank, pr.nickname, pr.registered as verified, s.streak, pr.id = auth.uid() as me
    from pwt.current_streaks() s join pwt.profiles pr on pr.id = s.user_id
    where s.streak > 0 and pr.nickname is not null and (p_scope = 'global' or pr.id = auth.uid() or pr.id in (select pwt.friend_ids(auth.uid())))
  )
  select * from ranked where rank <= p_limit or me order by rank, nickname nulls last
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Amigos (RF-110, RF-111): solo entre jugadores con cuenta; se identifican por nickname, sin exponer los id de usuario
-- ---------------------------------------------------------------------------------------------------------------------------------

create or replace function pwt.profile_id(p_nickname text) returns uuid
language plpgsql stable set search_path = pwt, pg_temp
as $$
declare
  found_id uuid;
begin
  select id into found_id from pwt.profiles where lower(nickname) = lower(p_nickname) and registered;
  if found_id is null then raise exception 'player_not_found'; end if;
  return found_id;
end $$;

-- Jugadores cuyo nickname empieza por `p_query` (sin distinguir mayúsculas), con la relación que tienen con quien busca.
create or replace function pwt.search_players(p_query text)
returns table (nickname text, relation text)
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select p.nickname,
         case when f.status = 'accepted' then 'friend'
              when f.requester = auth.uid() then 'outgoing'
              when f.addressee = auth.uid() then 'incoming'
              else 'none' end
  from pwt.profiles p
  left join pwt.friendships f on (f.requester = auth.uid() and f.addressee = p.id) or (f.addressee = auth.uid() and f.requester = p.id)
  where pwt.require_member() is not null and p.registered and length(coalesce(p_query, '')) between 1 and 16
    and left(lower(p.nickname), length(p_query)) = lower(p_query) and p.id <> auth.uid()
  order by lower(p.nickname)
  limit 10
$$;

-- Envía una solicitud. Si el otro ya había enviado una, se acepta. Devuelve la relación resultante: 'outgoing' o 'friend'.
create or replace function pwt.send_friend_request(p_nickname text) returns text
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_member();
  target uuid := pwt.profile_id(p_nickname);
  existing pwt.friendships%rowtype;
begin
  if target = uid then raise exception 'self_request'; end if;
  select * into existing from pwt.friendships
  where (requester = uid and addressee = target) or (requester = target and addressee = uid) for update;
  if not found then
    insert into pwt.friendships (requester, addressee, status) values (uid, target, 'pending');
    return 'outgoing';
  end if;
  if existing.status = 'accepted' then return 'friend'; end if;
  if existing.requester = uid then return 'outgoing'; end if;
  update pwt.friendships set status = 'accepted' where requester = target and addressee = uid;
  return 'friend';
end $$;

create or replace function pwt.respond_friend_request(p_nickname text, p_accept boolean) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_member();
  requester_id uuid := pwt.profile_id(p_nickname);
begin
  if p_accept then
    update pwt.friendships set status = 'accepted' where requester = requester_id and addressee = uid and status = 'pending';
  else
    delete from pwt.friendships where requester = requester_id and addressee = uid and status = 'pending';
  end if;
  if not found then raise exception 'no_request'; end if;
end $$;

create or replace function pwt.cancel_friend_request(p_nickname text) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_member();
begin
  delete from pwt.friendships where requester = uid and addressee = pwt.profile_id(p_nickname) and status = 'pending';
  if not found then raise exception 'no_request'; end if;
end $$;

-- Quita la amistad para los dos.
create or replace function pwt.remove_friend(p_nickname text) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_member();
  other uuid := pwt.profile_id(p_nickname);
begin
  delete from pwt.friendships
  where status = 'accepted' and ((requester = uid and addressee = other) or (requester = other and addressee = uid));
  if not found then raise exception 'not_friends'; end if;
end $$;

-- Amigos y solicitudes del jugador: 'friend', 'incoming' (recibida) u 'outgoing' (enviada).
create or replace function pwt.list_friends()
returns table (nickname text, relation text)
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select p.nickname,
         case when f.status = 'accepted' then 'friend' when f.requester = auth.uid() then 'outgoing' else 'incoming' end as relation
  from pwt.friendships f
  join pwt.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where pwt.require_member() is not null and (f.requester = auth.uid() or f.addressee = auth.uid())
  order by relation, lower(p.nickname)
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Permisos: solo las funciones de la API, y nada más
-- ---------------------------------------------------------------------------------------------------------------------------------

revoke all on all functions in schema pwt from public, anon, authenticated;
grant execute on function
  pwt.ensure_profile(), pwt.set_nickname(text),
  pwt.start_official(date, integer, text, text, text, text, text, integer, integer, integer),
  pwt.save_turn(date, jsonb, integer, integer, integer),
  pwt.finish_official(date, text, text, integer, integer, boolean[], integer, jsonb),
  pwt.void_official(date, text),
  pwt.import_days(jsonb), pwt.my_days(), pwt.my_summary(),
  pwt.search_players(text), pwt.send_friend_request(text), pwt.respond_friend_request(text, boolean),
  pwt.cancel_friend_request(text), pwt.remove_friend(text), pwt.list_friends(),
  pwt.points_ranking(date, text, integer), pwt.streak_ranking(text, integer)
to authenticated;
-- Los rankings se pueden ver sin sesión (RF-109).
grant execute on function pwt.points_ranking(date, text, integer), pwt.streak_ranking(text, integer) to anon;
-- Las funciones `security definer` llaman a las internas como su dueño; las internas no se exponen.

-- Cierre del día cada hora, a y 5, y liberación de nombres a diario a las 4:15 UTC (necesita la extensión pg_cron activada en el proyecto; si no está, se omite).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pwt-close-days', '5 * * * *', 'select pwt.close_days()');
    perform cron.schedule('pwt-release-nicknames', '15 4 * * *', 'select pwt.release_idle_nicknames()');
  end if;
end $$;
