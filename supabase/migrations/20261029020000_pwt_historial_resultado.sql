-- Daily PWT · Historial con el resultado en dibujo (decisión de Jose, 29/10/2026): copa y los Pokémon debilitados en gris. `my_history`
-- (de `20261029000000_pwt_repeticiones.sql`) devuelve además `playerFainted`, en el orden del equipo (null en los días que no lo tienen).
-- Se puede volver a ejecutar entera.

create or replace function pwt.my_history() returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', r.date, 'challengeNumber', d.challenge_number, 'trainerId', d.trainer_id, 'variantId', d.variant_id, 'status', d.status,
    'turns', d.turns, 'survivors', d.survivors, 'playerFainted', to_jsonb(d.player_fainted), 'sharedId', r.shared_id) order by r.date desc), '[]'::jsonb)
  from pwt.replays r join pwt.day_results d on d.user_id = r.user_id and d.date = r.date
  where r.user_id = pwt.require_user()
$$;
