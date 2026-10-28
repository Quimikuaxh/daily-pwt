-- Daily PWT · F4: inicio de sesión con Google en un solo paso, pasando a la cuenta lo jugado sin cuenta (decisión de Jose, 28/10/2026).
-- Antes se enlazaba Google a la sesión anónima (`linkIdentity`); si ese Google ya tenía cuenta, Google devolvía un error y había que
-- iniciar sesión otra vez. Ahora la sesión anónima pide un código de un solo uso antes de ir a Google y la cuenta lo canjea al volver.
-- Se puede volver a ejecutar entera.

create table if not exists pwt.guest_claims (
  code text primary key,
  guest_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table pwt.guest_claims enable row level security;
revoke all on pwt.guest_claims from anon, authenticated;

-- Al pasar un día a la cuenta, su estado en curso (si lo hay) va con él.
alter table pwt.battle_states drop constraint if exists battle_states_user_id_date_fkey;
alter table pwt.battle_states add constraint battle_states_user_id_date_fkey
  foreign key (user_id, date) references pwt.day_results (user_id, date) on delete cascade on update cascade;

-- Código de un solo uso para la sesión anónima que va a iniciar sesión con Google. Vale una hora; uno por sesión anónima (el nuevo
-- sustituye al anterior).
create or replace function pwt.create_guest_claim() returns text
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_user();
  new_code text := gen_random_uuid()::text;
begin
  if not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'not_guest'; end if;
  delete from pwt.guest_claims where guest_id = uid or created_at < now() - interval '1 hour';
  insert into pwt.guest_claims (code, guest_id) values (new_code, uid);
  return new_code;
end $$;

-- La cuenta canjea el código: recibe los días de la sesión anónima que no tenga (con su validación y sus puntos; si ya tiene ese día,
-- manda la cuenta y el de la sesión anónima se queda donde estaba, contando en la media). Si la cuenta es nueva (sin días y con el
-- perfil de hace menos de una hora), se queda además con el nombre de la sesión anónima. Devuelve cuántos días ha recibido.
create or replace function pwt.claim_guest(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_registered();
  guest uuid;
  account_is_new boolean;
  guest_nickname text;
  moved integer;
begin
  delete from pwt.guest_claims where code = p_code and created_at >= now() - interval '1 hour' returning guest_id into guest;
  if guest is null then raise exception 'invalid_claim'; end if;
  if guest = uid then return jsonb_build_object('days', 0, 'nickname', null); end if;

  account_is_new := not exists (select 1 from pwt.day_results where user_id = uid)
    and exists (select 1 from pwt.profiles where id = uid and created_at >= now() - interval '1 hour');

  update pwt.day_results set user_id = uid
  where user_id = guest and date not in (select date from pwt.day_results where user_id = uid);
  get diagnostics moved = row_count;

  if account_is_new then
    select nickname into guest_nickname from pwt.profiles where id = guest and nickname is not null;
    if guest_nickname is not null then
      update pwt.profiles set nickname = null where id = guest;
      update pwt.profiles set nickname = guest_nickname where id = uid;
    end if;
  end if;
  return jsonb_build_object('days', moved, 'nickname', guest_nickname);
end $$;

revoke all on function pwt.create_guest_claim(), pwt.claim_guest(text) from public, anon, authenticated;
grant execute on function pwt.create_guest_claim(), pwt.claim_guest(text) to authenticated;
