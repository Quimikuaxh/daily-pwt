-- Daily PWT · F4: saber quién no ha elegido aún su nombre, para el aviso de Hoy (decisión de Jose del 31/10/2026; RF-94b).
-- `nickname_chosen` se pone a `true` al cambiarlo con `set_nickname`. Cualquier otro cambio de nombre (el provisional al crear el perfil o
-- al volver tras liberarlo, el traspaso de invitado a cuenta) lo recalcula: elegido si no es del tipo `entrenador_12345`. Los perfiles que
-- ya existían se marcan igual. Se puede volver a ejecutar entera.

alter table pwt.profiles add column if not exists nickname_chosen boolean not null default false;

-- Nombre provisional de `default_nickname` (RF-94): `entrenador_` + 5 cifras.
create or replace function pwt.is_default_nickname(p_nickname text) returns boolean
language sql immutable set search_path = pwt, pg_temp
as $$
  select p_nickname is null or p_nickname ~ '^entrenador_[0-9]{5}$'
$$;

-- Los que ya existían: elegido si su nombre no es el provisional.
update pwt.profiles set nickname_chosen = true where not nickname_chosen and not pwt.is_default_nickname(nickname);

-- Un cambio de nombre que no marca `nickname_chosen` por sí mismo (todos menos `set_nickname`) lo recalcula por el patrón.
create or replace function pwt.profiles_nickname_chosen() returns trigger
language plpgsql set search_path = pwt, pg_temp
as $$
begin
  if new.nickname is distinct from old.nickname and new.nickname_chosen is not distinct from old.nickname_chosen then
    new.nickname_chosen := not pwt.is_default_nickname(new.nickname);
  end if;
  return new;
end $$;

drop trigger if exists profiles_nickname_chosen on pwt.profiles;
create trigger profiles_nickname_chosen before update of nickname on pwt.profiles
  for each row execute function pwt.profiles_nickname_chosen();

-- Como en `20261027000000_pwt_cuentas.sql`, y además marca el nombre como elegido.
create or replace function pwt.set_nickname(p_nickname text) returns text
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_profile();
begin
  if p_nickname is null or p_nickname !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'invalid_nickname'; end if;
  update pwt.profiles set nickname = p_nickname, nickname_chosen = true where id = uid;
  return p_nickname;
exception when unique_violation then
  raise exception 'nickname_taken';
end $$;

-- Como en `20261027000000_pwt_cuentas.sql`, con `nicknameChosen`.
create or replace function pwt.my_summary() returns jsonb
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select jsonb_build_object(
    'nickname', (select nickname from pwt.profiles where id = pwt.require_user()),
    'nicknameChosen', coalesce((select nickname_chosen from pwt.profiles where id = auth.uid()), false),
    'registered', coalesce((select registered from pwt.profiles where id = auth.uid()), false),
    'points', coalesce((select jsonb_agg(jsonb_build_object('date', p.date, 'points', p.points, 'provisional', p.provisional) order by p.date)
                        from pwt.day_points('-infinity', 'infinity') p where p.user_id = auth.uid()), '[]'::jsonb),
    'incomingRequests', (select count(*) from pwt.friendships where addressee = auth.uid() and status = 'pending'))
$$;

revoke all on function pwt.is_default_nickname(text), pwt.profiles_nickname_chosen() from public, anon, authenticated;
