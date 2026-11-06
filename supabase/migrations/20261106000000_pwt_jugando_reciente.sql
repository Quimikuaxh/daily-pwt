-- Daily PWT · «Jugando ahora» solo si ha guardado un turno hace poco (decisión de Jose, 06/11/2026; RF-111c, DEC-82).
-- Antes bastaba con tener el oficial de hoy en curso: quien lo dejaba a medias salía «jugando» (con el botón del directo) hasta que lo
-- terminaba o caducaba a medianoche, aunque llevara horas sin tocarlo. Ahora «jugando» = en curso y con su estado guardado (al empezar
-- y en cada turno, `battle_states.updated_at`) en los últimos `pwt.live_idle_limit()`; si no, `unfinished` («Combate a medias», sin
-- directo). Se puede volver a ejecutar entera.

-- Cuánto puede pasar sin guardar un turno antes de dejar de contar como «jugando».
create or replace function pwt.live_idle_limit() returns interval
language sql immutable set search_path = pwt, pg_temp
as $$ select interval '10 minutes' $$;

-- ¿Está jugando ahora su oficial de hoy? En curso y con un turno guardado (o empezado) hace poco.
create or replace function pwt.is_playing(p_user uuid) returns boolean
language sql stable set search_path = pwt, pg_temp
as $$
  select exists (
    select 1 from pwt.day_results d join pwt.battle_states s on s.user_id = d.user_id and s.date = d.date
    where d.user_id = p_user and d.date = pwt.madrid_today() and d.status = 'inProgress' and s.updated_at > now() - pwt.live_idle_limit())
$$;

-- ¿Tiene su oficial de hoy empezado y sin terminar, pero sin tocarlo hace rato?
create or replace function pwt.is_unfinished(p_user uuid) returns boolean
language sql stable set search_path = pwt, pg_temp
as $$
  select exists (select 1 from pwt.day_results where user_id = p_user and date = pwt.madrid_today() and status = 'inProgress')
         and not pwt.is_playing(p_user)
$$;

-- Como en `20261104010000_pwt_directo.sql`, con `unfinished` (cambia su tipo: se rehace).
drop function if exists pwt.list_friends();
create function pwt.list_friends()
returns table (nickname text, relation text, playing boolean, live text, unfinished boolean)
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select p.nickname,
         case when f.status = 'accepted' then 'friend' when f.requester = auth.uid() then 'outgoing' else 'incoming' end as relation,
         f.status = 'accepted' and pwt.is_playing(p.id) as playing,
         case when f.status = 'accepted' then
           (select r.status from pwt.live_requests r where r.viewer = auth.uid() and r.player = p.id and r.date = pwt.madrid_today())
         end as live,
         f.status = 'accepted' and pwt.is_unfinished(p.id) as unfinished
  from pwt.friendships f
  join pwt.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where pwt.require_member() is not null and (f.requester = auth.uid() or f.addressee = auth.uid())
  order by relation, lower(p.nickname)
$$;

revoke all on function pwt.live_idle_limit(), pwt.is_playing(uuid), pwt.is_unfinished(uuid), pwt.list_friends() from public, anon, authenticated;
grant execute on function pwt.list_friends() to authenticated;
