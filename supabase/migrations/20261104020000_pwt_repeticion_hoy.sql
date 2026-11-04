-- Daily PWT · La repetición de hoy de un amigo, para quien ya terminó su oficial de hoy (decisión de Jose, 04/11/2026; RF-111b). Antes
-- no se veía hasta el día siguiente, para no adelantar el combate a quien aún no lo ha jugado; quien ya lo ha jugado (ganado, perdido o
-- anulado, como para la práctica, RF-84) ya no tiene nada que descubrir. El historial del amigo dice cuáles se pueden ver (`watchable`).
-- Se puede volver a ejecutar entera.

-- ¿Ha terminado quien llama su oficial de hoy?
create or replace function pwt.caller_done_today() returns boolean
language sql stable set search_path = pwt, pg_temp
as $$ select exists (select 1 from pwt.day_results where user_id = auth.uid() and date = pwt.madrid_today() and status <> 'inProgress') $$;

-- Como en `20261104000000_pwt_amigo_al_dia.sql`, con `watchable` en cada combate del historial.
create or replace function pwt.friend_profile(p_nickname text) returns jsonb
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  other uuid := pwt.friend_of_caller(p_nickname);
  done boolean := pwt.caller_done_today();
begin
  return jsonb_build_object(
    'nickname', (select nickname from pwt.profiles where id = other),
    'days', coalesce((select jsonb_agg(pwt.day_json(r.user_id, r.date) - 'battle' order by r.date)
                      from pwt.day_results r where r.user_id = other and r.date <= pwt.madrid_today()), '[]'::jsonb),
    'points', coalesce((select jsonb_agg(jsonb_build_object('date', p.date, 'points', p.points, 'provisional', p.provisional) order by p.date)
                        from pwt.day_points('-infinity', pwt.madrid_today()) p where p.user_id = other), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
                           'date', r.date, 'challengeNumber', d.challenge_number, 'trainerId', d.trainer_id, 'variantId', d.variant_id,
                           'status', d.status, 'turns', d.turns, 'survivors', d.survivors, 'playerFainted', to_jsonb(d.player_fainted),
                           'sharedId', null, 'watchable', r.date < pwt.madrid_today() or done) order by r.date desc)
                         from pwt.replays r join pwt.day_results d on d.user_id = r.user_id and d.date = r.date
                         where r.user_id = other and r.date <= pwt.madrid_today()), '[]'::jsonb));
end $$;

-- Como en `20261029030000_pwt_amigo.sql`: la de hoy, solo si quien la pide ya terminó su oficial de hoy.
create or replace function pwt.get_friend_replay(p_nickname text, p_date date) returns text
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  other uuid := pwt.friend_of_caller(p_nickname);
  found_data text;
begin
  if p_date > pwt.madrid_today() or (p_date = pwt.madrid_today() and not pwt.caller_done_today()) then raise exception 'replay_not_found'; end if;
  select data into found_data from pwt.replays where user_id = other and date = p_date;
  if found_data is null then raise exception 'replay_not_found'; end if;
  return found_data;
end $$;

revoke all on function pwt.caller_done_today() from public, anon, authenticated;
