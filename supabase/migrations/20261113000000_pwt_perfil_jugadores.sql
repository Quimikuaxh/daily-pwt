-- Daily PWT · Estadísticas e historial de cualquier jugador, aunque no sea amigo (decisión de Jose, 13/11/2026). Se abren desde los
-- rankings y desde la búsqueda de Amigos. Lo puede ver cualquiera con sesión (con cuenta o sin ella) y de cualquier jugador con nickname
-- (también los que juegan sin cuenta, que ya salen en los rankings); nadie puede ocultarlo: son datos de juego, no personales. Las reglas
-- son las de la vista de un amigo (`20261104020000_pwt_repeticion_hoy.sql`): sus días y su historial hasta hoy, los puntos de los días
-- cerrados, y la repetición de hoy solo para quien ya terminó su oficial de hoy. Las funciones `friend_*` se quedan para los clientes
-- anteriores al despliegue. Se puede volver a ejecutar entera.

-- Id del jugador con ese nickname (sin distinguir mayúsculas); si no existe, `player_not_found`. Quien pregunta necesita sesión y perfil.
create or replace function pwt.player_of_caller(p_nickname text) returns uuid
language plpgsql stable set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_profile();
  other uuid;
begin
  select p.id into other from pwt.profiles p where p.nickname is not null and lower(p.nickname) = lower(p_nickname);
  if other is null then raise exception 'player_not_found'; end if;
  return other;
end $$;

-- Como `friend_profile` (20261104020000), para cualquier jugador.
create or replace function pwt.player_profile(p_nickname text) returns jsonb
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  other uuid := pwt.player_of_caller(p_nickname);
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

-- Como `get_friend_replay` (20261104020000), para cualquier jugador: la de hoy, solo si quien la pide ya terminó su oficial de hoy.
create or replace function pwt.get_player_replay(p_nickname text, p_date date) returns text
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  other uuid := pwt.player_of_caller(p_nickname);
  found_data text;
begin
  if p_date > pwt.madrid_today() or (p_date = pwt.madrid_today() and not pwt.caller_done_today()) then raise exception 'replay_not_found'; end if;
  select data into found_data from pwt.replays where user_id = other and date = p_date;
  if found_data is null then raise exception 'replay_not_found'; end if;
  return found_data;
end $$;

revoke all on function pwt.player_of_caller(text), pwt.player_profile(text), pwt.get_player_replay(text, date) from public, anon, authenticated;
grant execute on function pwt.player_profile(text), pwt.get_player_replay(text, date) to authenticated;
