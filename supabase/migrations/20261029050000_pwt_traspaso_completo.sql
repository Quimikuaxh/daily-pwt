-- Daily PWT · Traspaso de la sesión anónima a la cuenta: también los enlaces compartidos (29/10/2026). `claim_guest` (de
-- `20261028030000_pwt_traspaso_anonimo.sql`) mueve los resultados, y con ellos, por `on update cascade`, su repetición y su combate en
-- curso; pero los enlaces compartidos seguían a nombre de la sesión anónima y, desde la cuenta, «Dejar de compartir» fallaba (solo los
-- borra su dueño). Ahora pasan a la cuenta, con el límite de 20 compartidas (RF-133). Se puede volver a ejecutar entera.

create or replace function pwt.claim_guest(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = pwt, pg_temp
as $$
declare
  uid uuid := pwt.require_registered();
  guest uuid;
  account_is_new boolean;
  guest_nickname text;
  moved integer;
  moving date[];
begin
  delete from pwt.guest_claims where code = p_code and created_at >= now() - interval '1 hour' returning guest_id into guest;
  if guest is null then raise exception 'invalid_claim'; end if;
  if guest = uid then return jsonb_build_object('days', 0, 'nickname', null); end if;

  account_is_new := not exists (select 1 from pwt.day_results where user_id = uid)
    and exists (select 1 from pwt.profiles where id = uid and created_at >= now() - interval '1 hour');

  -- Los días que pasan a la cuenta: los del invitado que la cuenta no tiene.
  select coalesce(array_agg(date), '{}') into moving from pwt.day_results
  where user_id = guest and date not in (select date from pwt.day_results where user_id = uid);

  -- Con ellos se mueven su repetición y su combate en curso (`on update cascade`).
  update pwt.day_results set user_id = uid where user_id = guest and date = any (moving);
  get diagnostics moved = row_count;
  -- Como al guardar una repetición (RF-125): se quedan las 20 más recientes.
  delete from pwt.replays
  where user_id = uid and date not in (select date from pwt.replays where user_id = uid order by date desc limit pwt.replay_limit());
  update pwt.shared_replays set owner = uid where owner = guest;
  -- Y como al compartir (RF-133): como mucho 20 compartidas, se borran las más antiguas.
  delete from pwt.shared_replays
  where owner = uid and id not in (select id from pwt.shared_replays where owner = uid order by created_at desc, id limit pwt.replay_limit());

  if account_is_new then
    select nickname into guest_nickname from pwt.profiles where id = guest and nickname is not null;
    if guest_nickname is not null then
      update pwt.profiles set nickname = null where id = guest;
      update pwt.profiles set nickname = guest_nickname where id = uid;
    end if;
  end if;
  return jsonb_build_object('days', moved, 'nickname', guest_nickname);
end $$;

revoke all on function pwt.claim_guest(text) from public, anon, authenticated;
grant execute on function pwt.claim_guest(text) to authenticated;
