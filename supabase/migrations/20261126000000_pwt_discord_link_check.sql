-- Comprobación del `state` de vinculación de Discord sin gastarlo (DEC-77). La Edge Function la llama antes de hablar con Discord: al
-- recibir `?start=` (para no mandar a autorizar con un `state` que no existe) y a la vuelta, antes de canjear el `code`. Así un `state`
-- inventado, caducado o ya usado no provoca ninguna llamada a Discord. `discord_link_finish` sigue siendo la que lo consume y la que
-- decide; esta solo adelanta el rechazo.

create or replace function pwt.discord_link_check(p_state text) returns boolean
language sql stable security definer set search_path = pwt, pg_temp
as $$
  select exists (select 1 from pwt.discord_link_states where state = p_state and expires_at >= now())
$$;

revoke all on function pwt.discord_link_check(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function pwt.discord_link_check(text) to service_role;
  end if;
end $$;
