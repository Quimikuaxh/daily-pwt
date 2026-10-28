-- Daily PWT · F4: los puntos solo existen cuando el día está cerrado (decisión de Jose del 28/10/2026; RF-105).
-- Antes, un día abierto puntuaba con un multiplicador provisional (la media de ese momento) y la interfaz lo marcaba así.
-- Se puede volver a ejecutar entera.

-- Puntos de cada oficial validado entre dos fechas (RF-103 a RF-105), solo de los días ya cerrados: con el multiplicador fijado al
-- cierre. Un oficial terminado tras el cierre puntúa con ese multiplicador. `provisional` se queda en la firma (siempre falso) para no
-- cambiar la de las funciones que la usan.
create or replace function pwt.day_points(p_from date, p_to date)
returns table (user_id uuid, date date, points numeric, provisional boolean)
language sql stable set search_path = pwt, pg_temp
as $$
  select r.user_id, r.date, round(pwt.day_score(r.status, r.survivors) * d.multiplier, 2), false
  from pwt.day_results r join pwt.day_difficulty d on d.date = r.date
  where r.date between p_from and p_to and r.validated and r.status in ('won', 'lost')
$$;

revoke all on function pwt.day_points(date, date) from public, anon, authenticated;

-- Cierre a la hora en punto: el día queda cerrado a las 00:00 de Madrid (22:00 o 23:00 UTC, según el horario de verano).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pwt-close-days', '0 * * * *', 'select pwt.close_days()');
  end if;
end $$;
