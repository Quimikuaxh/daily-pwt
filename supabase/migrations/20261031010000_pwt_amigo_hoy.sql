-- Daily PWT · Historial de un amigo con su combate de hoy (decisión de Jose, 31/10/2026; RF-111b). Antes el de hoy no salía hasta la
-- medianoche de Madrid; ahora sale en el historial (resultado, turnos, en pie) y su repetición sigue sin poder verse hasta el día
-- siguiente (`get_friend_replay` no cambia). Las estadísticas y los puntos siguen siendo los de los días cerrados. Se puede volver a
-- ejecutar entera.

-- Como en `20261029030000_pwt_amigo.sql`, con el historial hasta hoy incluido.
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
                         where r.user_id = other and r.date <= pwt.madrid_today()), '[]'::jsonb));
end $$;
