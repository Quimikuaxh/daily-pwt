-- Daily PWT · Ranking «Vivos hoy» (decisión de Jose del 27/11/2026): cuántos Pokémon le quedan en pie a cada jugador al acabar el
-- oficial de hoy (día de Madrid), de más a menos. Sale al momento de terminar, sin esperar a cerrar el día. Perdido: 0; anulado: 0 (no
-- tiene supervivientes). En «Todos» solo aparece quien ya lo ha terminado hoy; en «Solo amigos», el jugador y todos sus amigos, con
-- `survivors` y `rank` a null (la pantalla enseña «—») si aún no lo han terminado. Mismo formato paginado que los otros rankings
-- (`ranking_page`). Solo funciones nuevas: no toca tablas. Se puede volver a ejecutar entera.

create or replace function pwt.survivors_ranked(p_scope text)
returns table (place integer, rank integer, nickname text, verified boolean, survivors integer, me boolean)
language sql stable set search_path = pwt, pg_temp
as $$
  with today as (
    select r.user_id, case when r.status = 'won' then coalesce(r.survivors, 0) else 0 end as survivors
    from pwt.day_results r
    where r.date = pwt.madrid_today() and r.status <> 'inProgress' and not r.imported
  ), people as (
    -- «Todos»: quien ha terminado hoy. «Solo amigos»: el jugador y sus amigos, hayan jugado o no.
    select t.user_id, t.survivors from today t where p_scope = 'global'
    union all
    select pr.id, t.survivors
    from pwt.profiles pr left join today t on t.user_id = pr.id
    where p_scope <> 'global' and (pr.id = auth.uid() or pr.id in (select pwt.friend_ids(auth.uid())))
  )
  select (row_number() over (order by p.survivors desc nulls last, lower(pr.nickname) nulls last, pr.id))::integer,
         case when p.survivors is null then null else (rank() over (order by p.survivors desc nulls last))::integer end,
         pr.nickname, pr.registered, p.survivors, coalesce(pr.id = auth.uid(), false)
  from people p join pwt.profiles pr on pr.id = p.user_id
  where pr.nickname is not null
$$;

create or replace function pwt.survivors_ranking_page(p_scope text, p_page integer default null, p_size integer default 20)
returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select pwt.ranking_page(coalesce((select jsonb_agg(to_jsonb(r)) from pwt.survivors_ranked(p_scope) r), '[]'::jsonb), p_page, p_size)
$$;

revoke all on function pwt.survivors_ranked(text) from public, anon, authenticated;
revoke all on function pwt.survivors_ranking_page(text, integer, integer) from public;
-- Como los otros rankings, se puede ver sin sesión (RF-109); sin sesión, «Solo amigos» sale vacío.
grant execute on function pwt.survivors_ranking_page(text, integer, integer) to anon, authenticated;
