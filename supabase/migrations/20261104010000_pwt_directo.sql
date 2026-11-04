-- Daily PWT · Ver en directo el oficial de un amigo (decisiones de Jose, 04/11/2026; RF-111c, DEC-80). Un amigo pide verlo
-- (`request_live`); quien juega lo acepta o lo rechaza durante su combate (`live_inbox`, `answer_live_request`) y, si acepta, el amigo
-- lee el combate en curso (`live_battle`): semilla, IA, inicial y decisiones, para jugarlo en su motor igual (la IA es determinista). Al
-- terminar, las decisiones finales se guardan en `live_endings` (el estado del combate se borra y el último turno no se guarda turno a
-- turno). Todo vale solo para el día del reto en curso. Se puede volver a ejecutar entera.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Una solicitud por espectador, jugador y día: `pending` hasta que quien juega contesta.
create table if not exists pwt.live_requests (
  viewer uuid not null references auth.users (id) on delete cascade,
  player uuid not null references auth.users (id) on delete cascade,
  date date not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (viewer, player, date)
);
create index if not exists live_requests_player on pwt.live_requests (player, date);
alter table pwt.live_requests enable row level security;

-- Cómo acabó un oficial que alguien tenía permiso para ver: lo que necesita su motor para llegar al final.
create table if not exists pwt.live_endings (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  seed text not null,
  ai text not null,
  lead_index integer not null,
  decisions jsonb not null,
  end_reason text not null,
  primary key (user_id, date)
);
alter table pwt.live_endings enable row level security;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Internas
-- ---------------------------------------------------------------------------------------------------------------------------------

-- ¿Está jugando ahora su oficial de hoy?
create or replace function pwt.is_playing(p_user uuid) returns boolean
language sql stable set search_path = pwt, pg_temp
as $$ select exists (select 1 from pwt.day_results where user_id = p_user and date = pwt.madrid_today() and status = 'inProgress') $$;

-- Un amigo con cuenta por su nickname (quien llama, con cuenta), o error.
create or replace function pwt.member_by_nickname(p_nickname text) returns uuid
language plpgsql stable set search_path = pwt, pg_temp
as $$
declare
  found_id uuid;
begin
  select id into found_id from pwt.profiles where lower(nickname) = lower(p_nickname) and registered;
  if found_id is null then raise exception 'not_found'; end if;
  return found_id;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- API
-- ---------------------------------------------------------------------------------------------------------------------------------

-- La lista de amigos dice ahora quién está jugando su oficial y cómo va la solicitud de verlo (null si no se ha pedido hoy).
drop function if exists pwt.list_friends();
create function pwt.list_friends()
returns table (nickname text, relation text, playing boolean, live text)
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select p.nickname,
         case when f.status = 'accepted' then 'friend' when f.requester = auth.uid() then 'outgoing' else 'incoming' end as relation,
         f.status = 'accepted' and pwt.is_playing(p.id) as playing,
         case when f.status = 'accepted' then
           (select r.status from pwt.live_requests r where r.viewer = auth.uid() and r.player = p.id and r.date = pwt.madrid_today())
         end as live
  from pwt.friendships f
  join pwt.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where pwt.require_member() is not null and (f.requester = auth.uid() or f.addressee = auth.uid())
  order by relation, lower(p.nickname)
$$;

-- Pedir ver en directo a un amigo que está jugando. Si ya la había aceptado, sigue aceptada; si la rechazó, se puede volver a pedir.
create or replace function pwt.request_live(p_nickname text) returns text
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_member();
  other uuid := pwt.friend_of_caller(p_nickname);
  current_status text;
begin
  if not pwt.is_playing(other) then raise exception 'not_playing'; end if;
  insert into pwt.live_requests (viewer, player, date) values (uid, other, pwt.madrid_today())
  on conflict (viewer, player, date) do update set status = case when live_requests.status = 'accepted' then 'accepted' else 'pending' end,
    created_at = case when live_requests.status = 'accepted' then live_requests.created_at else now() end
  returning status into current_status;
  return current_status;
end $$;

-- Para quien juega: solicitudes por contestar de hoy y cuántos le están viendo (con la solicitud aceptada).
create or replace function pwt.live_inbox() returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select jsonb_build_object(
    'pending', coalesce((select jsonb_agg(p.nickname order by r.created_at) from pwt.live_requests r join pwt.profiles p on p.id = r.viewer
                         where r.player = pwt.require_member() and r.date = pwt.madrid_today() and r.status = 'pending'), '[]'::jsonb),
    'watching', (select count(*) from pwt.live_requests r where r.player = auth.uid() and r.date = pwt.madrid_today() and r.status = 'accepted'))
$$;

create or replace function pwt.answer_live_request(p_nickname text, p_accept boolean) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_member();
  other uuid := pwt.member_by_nickname(p_nickname);
begin
  update pwt.live_requests set status = case when p_accept then 'accepted' else 'rejected' end, answered_at = now()
  where viewer = other and player = uid and date = pwt.madrid_today() and status = 'pending';
  if not found then raise exception 'request_not_found'; end if;
end $$;

-- El combate de un amigo que ha aceptado: en curso (`live`, con lo guardado hasta el último turno), terminado (`ended`, con las
-- decisiones finales y el motivo) o anulado (`void`).
create or replace function pwt.live_battle(p_nickname text) returns jsonb
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_member();
  other uuid := pwt.friend_of_caller(p_nickname);
  today date := pwt.madrid_today();
  day pwt.day_results;
  state pwt.battle_states;
  ending pwt.live_endings;
begin
  if not exists (select 1 from pwt.live_requests where viewer = uid and player = other and date = today and status = 'accepted') then
    raise exception 'live_not_allowed';
  end if;
  select * into day from pwt.day_results where user_id = other and date = today;
  if day is null then raise exception 'not_playing'; end if;
  if day.status = 'inProgress' then
    select * into state from pwt.battle_states where user_id = other and date = today;
    return jsonb_build_object('state', 'live', 'date', today, 'seed', state.seed, 'ai', state.ai, 'leadIndex', state.lead_index,
                              'decisions', state.decisions, 'turn', state.turn);
  end if;
  select * into ending from pwt.live_endings where user_id = other and date = today;
  if day.status = 'void' or ending is null then return jsonb_build_object('state', 'void', 'date', today); end if;
  return jsonb_build_object('state', 'ended', 'date', today, 'seed', ending.seed, 'ai', ending.ai, 'leadIndex', ending.lead_index,
                            'decisions', ending.decisions, 'reason', ending.end_reason);
end $$;

-- Como en `20261029010000_pwt_oficial_caducado.sql`; además, si alguien tiene permiso para verlo en directo, guarda cómo acabó.
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
  if p_date < pwt.madrid_today() then raise exception 'day_closed'; end if;
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
  -- Directo (RF-111c): solo con un estado coherente, para que el motor del espectador llegue al mismo final.
  if coalesce(coherent, false) and exists (select 1 from pwt.live_requests where player = uid and date = p_date and status = 'accepted') then
    insert into pwt.live_endings (user_id, date, seed, ai, lead_index, decisions, end_reason)
    values (uid, p_date, state.seed, state.ai, state.lead_index, p_decisions, p_reason)
    on conflict (user_id, date) do update set decisions = excluded.decisions, end_reason = excluded.end_reason;
  end if;
  delete from pwt.battle_states where user_id = uid and date = p_date;
  return jsonb_build_object('validated', coalesce(coherent, false));
end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------------------------------------------------------------

revoke all on function pwt.is_playing(uuid), pwt.member_by_nickname(text), pwt.list_friends(), pwt.request_live(text), pwt.live_inbox(),
  pwt.answer_live_request(text, boolean), pwt.live_battle(text)
from public, anon, authenticated;
grant execute on function pwt.list_friends(), pwt.request_live(text), pwt.live_inbox(), pwt.answer_live_request(text, boolean),
  pwt.live_battle(text)
to authenticated;
