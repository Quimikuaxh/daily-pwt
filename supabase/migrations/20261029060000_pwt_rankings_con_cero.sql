-- Daily PWT · F4: los rankings incluyen a quien tiene 0 (decisión de Jose del 29/10/2026; RF-106b, RF-107b).
-- Antes, el de racha omitía a quien la tenía a 0 y el de puntos solo traía a quien tuviera oficiales validados en ese mes. Ahora sale
-- todo jugador con nickname que haya terminado algún oficial (también importado o sin validar): en el de puntos, si lo terminó en ese
-- mes o antes. Quien solo abrió la web (sin cuenta recibe nickname al entrar) no sale. Un nombre liberado (RF-113) sin puntos tampoco.
-- Se puede volver a ejecutar entera.

-- Jugadores que han terminado algún oficial hasta `p_until` (incluido).
create or replace function pwt.players_until(p_until date)
returns table (user_id uuid)
language sql stable set search_path = pwt, pg_temp
as $$
  select distinct r.user_id from pwt.day_results r where r.status <> 'inProgress' and r.date <= p_until
$$;

create or replace function pwt.points_ranked(p_month date, p_scope text)
returns table (place integer, rank integer, nickname text, verified boolean, points numeric, me boolean)
language sql stable set search_path = pwt, pg_temp
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as first_day, (date_trunc('month', p_month) + interval '1 month - 1 day')::date as last_day
  ), scored as (
    select p.user_id, sum(p.points) as points
    from bounds b, pwt.day_points(b.first_day, b.last_day) p
    group by p.user_id
  ), totals as (
    select coalesce(s.user_id, pl.user_id) as user_id, coalesce(s.points, 0) as points
    from scored s full join (select pl.user_id from bounds b, pwt.players_until(b.last_day) pl) pl on pl.user_id = s.user_id
  )
  select (row_number() over (order by t.points desc, lower(pr.nickname) nulls last, pr.id))::integer,
         (rank() over (order by t.points desc))::integer,
         pr.nickname, pr.registered, t.points, pr.id = auth.uid()
  from totals t join pwt.profiles pr on pr.id = t.user_id
  where (pr.nickname is not null or t.points > 0)
    and (p_scope = 'global' or pr.id = auth.uid() or pr.id in (select pwt.friend_ids(auth.uid())))
$$;

create or replace function pwt.streak_ranked(p_scope text)
returns table (place integer, rank integer, nickname text, verified boolean, streak integer, me boolean)
language sql stable set search_path = pwt, pg_temp
as $$
  with streaks as (
    select pl.user_id, coalesce(s.streak, 0) as streak
    from pwt.players_until(pwt.madrid_today()) pl left join pwt.current_streaks() s on s.user_id = pl.user_id
  )
  select (row_number() over (order by s.streak desc, lower(pr.nickname), pr.id))::integer,
         (rank() over (order by s.streak desc))::integer,
         pr.nickname, pr.registered, s.streak, pr.id = auth.uid()
  from streaks s join pwt.profiles pr on pr.id = s.user_id
  where pr.nickname is not null
    and (p_scope = 'global' or pr.id = auth.uid() or pr.id in (select pwt.friend_ids(auth.uid())))
$$;

revoke all on function pwt.players_until(date), pwt.points_ranked(date, text), pwt.streak_ranked(text) from public, anon, authenticated;
