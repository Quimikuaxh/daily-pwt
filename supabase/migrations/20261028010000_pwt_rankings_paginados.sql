-- Daily PWT · F4: rankings por páginas de 20 que se abren en la página del jugador (decisión de Jose del 28/10/2026; RF-108).
-- Sustituye a `points_ranking` y `streak_ranking` (los N primeros y el propio jugador al final), que se borran.
-- Se puede volver a ejecutar entera.

drop function if exists pwt.points_ranking(date, text, integer);
drop function if exists pwt.streak_ranking(text, integer);

-- Ranking completo de puntos del mes, en orden (RF-106, RF-112). `place` es la fila (1, 2, 3…) y sirve para paginar; `rank`, la
-- posición con empate compartido (1, 1, 3). Desempate de orden dentro de un empate: nickname y, si falta, el id.
create or replace function pwt.points_ranked(p_month date, p_scope text)
returns table (place integer, rank integer, nickname text, verified boolean, points numeric, me boolean)
language sql stable set search_path = pwt, pg_temp
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as first_day, (date_trunc('month', p_month) + interval '1 month - 1 day')::date as last_day
  ), totals as (
    select p.user_id, sum(p.points) as points
    from bounds b, pwt.day_points(b.first_day, b.last_day) p
    group by p.user_id
  )
  select (row_number() over (order by t.points desc, lower(pr.nickname) nulls last, pr.id))::integer,
         (rank() over (order by t.points desc))::integer,
         pr.nickname, pr.registered, t.points, pr.id = auth.uid()
  from totals t join pwt.profiles pr on pr.id = t.user_id
  where p_scope = 'global' or pr.id = auth.uid() or pr.id in (select pwt.friend_ids(auth.uid()))
$$;

-- Ranking completo de racha actual (RF-107), con el mismo formato.
create or replace function pwt.streak_ranked(p_scope text)
returns table (place integer, rank integer, nickname text, verified boolean, streak integer, me boolean)
language sql stable set search_path = pwt, pg_temp
as $$
  select (row_number() over (order by s.streak desc, lower(pr.nickname), pr.id))::integer,
         (rank() over (order by s.streak desc))::integer,
         pr.nickname, pr.registered, s.streak, pr.id = auth.uid()
  from pwt.current_streaks() s join pwt.profiles pr on pr.id = s.user_id
  where s.streak > 0 and pr.nickname is not null
    and (p_scope = 'global' or pr.id = auth.uid() or pr.id in (select pwt.friend_ids(auth.uid())))
$$;

-- Una página de un ranking ya ordenado (`rows`: filas con `place`). Sin `p_page`, la del jugador o, si no está, la primera.
-- Devuelve { page, pages, total, myPage, rows }; `myPage` es null si el jugador no aparece.
create or replace function pwt.ranking_page(p_rows jsonb, p_page integer, p_size integer) returns jsonb
language plpgsql immutable set search_path = pwt, pg_temp
as $$
declare
  size integer := least(greatest(coalesce(p_size, 20), 1), 100);
  total integer := jsonb_array_length(p_rows);
  my_position integer := (select (item ->> 'place')::integer from jsonb_array_elements(p_rows) as item where (item ->> 'me')::boolean limit 1);
  my_page integer := case when my_position is null then null else (my_position - 1) / size + 1 end;
  pages integer := greatest(1, ceil(total::numeric / size)::integer);
  page integer := least(greatest(coalesce(p_page, my_page, 1), 1), pages);
begin
  return jsonb_build_object(
    'page', page, 'pages', pages, 'total', total, 'myPage', my_page,
    'rows', coalesce((select jsonb_agg(item - 'place' order by (item ->> 'place')::integer) from jsonb_array_elements(p_rows) as item
                      where (item ->> 'place')::integer between (page - 1) * size + 1 and page * size), '[]'::jsonb));
end $$;

create or replace function pwt.points_ranking_page(p_month date, p_scope text, p_page integer default null, p_size integer default 20)
returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select pwt.ranking_page(coalesce((select jsonb_agg(to_jsonb(r)) from pwt.points_ranked(p_month, p_scope) r), '[]'::jsonb), p_page, p_size)
$$;

create or replace function pwt.streak_ranking_page(p_scope text, p_page integer default null, p_size integer default 20)
returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select pwt.ranking_page(coalesce((select jsonb_agg(to_jsonb(r)) from pwt.streak_ranked(p_scope) r), '[]'::jsonb), p_page, p_size)
$$;

revoke all on function pwt.points_ranked(date, text), pwt.streak_ranked(text), pwt.ranking_page(jsonb, integer, integer)
  from public, anon, authenticated;
revoke all on function pwt.points_ranking_page(date, text, integer, integer), pwt.streak_ranking_page(text, integer, integer) from public;
-- Los rankings se pueden ver sin sesión (RF-109).
grant execute on function pwt.points_ranking_page(date, text, integer, integer), pwt.streak_ranking_page(text, integer, integer)
  to anon, authenticated;
