-- Daily PWT · Estadísticas e historial de un amigo (decisión de Jose, 29/10/2026). Al pulsar un amigo en Amigos se ven sus estadísticas
-- (como en «Yo») y su historial con sus repeticiones. Solo entre amigos (solicitud aceptada) y solo de los días ya cerrados: el de hoy
-- no se enseña hasta la medianoche de Madrid, para no adelantar cómo le fue antes de jugar. Se puede volver a ejecutar entera.

-- Id del amigo con ese nickname; si no hay amistad aceptada con el que pregunta (o no existe), `not_friends`, sin distinguir los casos.
create or replace function pwt.friend_of_caller(p_nickname text) returns uuid
language plpgsql stable set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_member();
  other uuid;
begin
  select p.id into other from pwt.profiles p
  where lower(p.nickname) = lower(p_nickname) and p.registered
    and exists (select 1 from pwt.friendships f
                where f.status = 'accepted' and ((f.requester = uid and f.addressee = p.id) or (f.requester = p.id and f.addressee = uid)));
  if other is null then raise exception 'not_friends'; end if;
  return other;
end $$;

-- Lo que enseña la vista del amigo: nickname, días ya cerrados (como `my_days`, sin el combate guardado), puntos de esos días e historial
-- (como `my_history`, sin el enlace compartido, que es suyo).
create or replace function pwt.friend_profile(p_nickname text) returns jsonb
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  other uuid := pwt.friend_of_caller(p_nickname);
begin
  return jsonb_build_object(
    'nickname', (select nickname from pwt.profiles where id = other),
    'days', coalesce((select jsonb_agg(pwt.day_json(r.user_id, r.date) - 'battle' order by r.date)
                      from pwt.day_results r where r.user_id = other and r.date < pwt.madrid_today()), '[]'::jsonb),
    'points', coalesce((select jsonb_agg(jsonb_build_object('date', p.date, 'points', p.points, 'provisional', p.provisional) order by p.date)
                        from pwt.day_points('-infinity', pwt.madrid_today() - 1) p where p.user_id = other), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
                           'date', r.date, 'challengeNumber', d.challenge_number, 'trainerId', d.trainer_id, 'variantId', d.variant_id,
                           'status', d.status, 'turns', d.turns, 'survivors', d.survivors, 'playerFainted', to_jsonb(d.player_fainted),
                           'sharedId', null) order by r.date desc)
                         from pwt.replays r join pwt.day_results d on d.user_id = r.user_id and d.date = r.date
                         where r.user_id = other and r.date < pwt.madrid_today()), '[]'::jsonb));
end $$;

-- Repetición de un combate del amigo, de un día ya cerrado.
create or replace function pwt.get_friend_replay(p_nickname text, p_date date) returns text
language plpgsql stable security definer set search_path = pwt, pg_temp
as $$
declare
  other uuid := pwt.friend_of_caller(p_nickname);
  found_data text;
begin
  if p_date >= pwt.madrid_today() then raise exception 'replay_not_found'; end if;
  select data into found_data from pwt.replays where user_id = other and date = p_date;
  if found_data is null then raise exception 'replay_not_found'; end if;
  return found_data;
end $$;

revoke all on function pwt.friend_of_caller(text), pwt.friend_profile(text), pwt.get_friend_replay(text, date) from public, anon, authenticated;
grant execute on function pwt.friend_profile(text), pwt.get_friend_replay(text, date) to authenticated;
