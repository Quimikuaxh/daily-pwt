-- Daily PWT · RF-80b (decisión de Jose, 28/10/2026): a medianoche de Madrid, un oficial sin terminar cuenta como derrota.
-- `close_days` (pg_cron, cada hora en punto) lo cierra antes de calcular la media del día, y desde ese momento ese día ya no admite turnos
-- ni resultado (`day_closed`): nadie juega el de ayer sabiendo cómo le fue al resto. Redefine las funciones de
-- `20261027000000_pwt_cuentas.sql` añadiendo solo esa comprobación. Se puede volver a ejecutar entera.

-- Fija el multiplicador de los días cuya medianoche de Madrid ya pasó y aún no estaban cerrados. Antes, los oficiales en curso de esos
-- días pasan a derrota (`expired`) con el último estado guardado; cuentan en la media si se llegó a jugar algún turno (como rendirse).
create or replace function pwt.close_days() returns integer
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  closed integer;
begin
  update pwt.day_results r
  set status = 'lost', finished_at = now(), end_reason = 'expired', turns = s.turn, survivors = s.player_remaining,
      rival_fainted = s.rival_size - s.rival_remaining, validated = jsonb_array_length(s.decisions) > 0
  from pwt.battle_states s
  where s.user_id = r.user_id and s.date = r.date and r.date < pwt.madrid_today() and r.status = 'inProgress';
  -- Sin estado guardado (no debería pasar): derrota que no cuenta en la media.
  update pwt.day_results
  set status = 'lost', finished_at = now(), end_reason = 'expired', turns = 0, validated = false
  where date < pwt.madrid_today() and status = 'inProgress';
  delete from pwt.battle_states where date < pwt.madrid_today();

  insert into pwt.day_difficulty (date, players, average, multiplier)
  select r.date, count(*), round(avg(pwt.day_score(r.status, r.survivors)), 4), pwt.multiplier_of(avg(pwt.day_score(r.status, r.survivors)))
  from pwt.day_results r
  where r.date < pwt.madrid_today() and r.validated and r.status in ('won', 'lost')
    and not exists (select 1 from pwt.day_difficulty d where d.date = r.date)
  group by r.date;
  get diagnostics closed = row_count;
  return closed;
end $$;

-- Estado tras un turno (RF-100): solo del oficial propio en curso y de hoy; las decisiones solo crecen (y empiezan por las ya guardadas),
-- el turno no retrocede y los Pokémon en pie no aumentan.
create or replace function pwt.save_turn(
  p_date date, p_decisions jsonb, p_turn integer, p_player_remaining integer, p_rival_remaining integer
) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
  state pwt.battle_states%rowtype;
begin
  if p_date < pwt.madrid_today() then raise exception 'day_closed'; end if;
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

-- Resultado del oficial (RF-101), solo el mismo día (RF-80b). Se guarda siempre (cuenta para racha), pero solo puntúa si es coherente
-- con el último estado: hay estados guardados, las decisiones siguen a las guardadas, el combate acaba en ese turno o en el siguiente,
-- no revive nadie y gana quien debilita a todo el equipo contrario. El estado se borra.
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
  delete from pwt.battle_states where user_id = uid and date = p_date;
  return jsonb_build_object('validated', coalesce(coherent, false));
end $$;

-- Oficial que no se pudo reanudar (RF-83): gasta el día, 0 puntos y fuera de la media. Solo el mismo día: después ya es derrota (RF-80b).
create or replace function pwt.void_official(p_date date, p_reason text) returns void
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
begin
  if p_date < pwt.madrid_today() then raise exception 'day_closed'; end if;
  update pwt.day_results set status = 'void', void_reason = p_reason, finished_at = now(), validated = false
  where user_id = uid and date = p_date and status = 'inProgress';
  if not found then raise exception 'not_in_progress'; end if;
  delete from pwt.battle_states where user_id = uid and date = p_date;
end $$;
