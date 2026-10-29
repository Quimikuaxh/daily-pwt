-- Daily PWT · «Victorias: X/Y» bajo el rival de Hoy (decisión de Jose, 29/10/2026): cuántos jugadores le han ganado hoy y cuántos han
-- terminado su oficial. Solo los validados, los mismos que entran en la media del multiplicador. Se ve sin sesión, como los rankings.
-- Se puede volver a ejecutar entera.

create or replace function pwt.day_wins(p_date date) returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select jsonb_build_object(
    'wins', count(*) filter (where r.status = 'won'),
    'players', count(*))
  from pwt.day_results r
  where r.date = p_date and r.validated and r.status in ('won', 'lost')
$$;

revoke all on function pwt.day_wins(date) from public, anon, authenticated;
grant execute on function pwt.day_wins(date) to anon, authenticated;
