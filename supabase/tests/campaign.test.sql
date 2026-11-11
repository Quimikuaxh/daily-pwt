-- Ejecuta con `npx supabase test db`; todo dato y permiso de prueba se revierte.
begin;
set local plpgsql.check_asserts = on;
select '1..1';

create function pg_temp.expect_campaign_error(statement text, expected text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected in sqlerrm) > 0 then return; end if;
    raise;
  end;
  raise exception 'Se esperaba el error % para %', expected, statement;
end $$;

do $$
declare
  a uuid := 'd4000000-0000-4000-8000-000000000001';
  b uuid := 'd4000000-0000-4000-8000-000000000002';
  op uuid := 'd4000000-0000-4000-8000-000000000003';
  first_receipt jsonb;
begin
  insert into auth.users(id) values (a), (b);
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'is_anonymous', false)::text, true);
  assert pwt.get_campaign() is null, 'cuenta sin campaña';
  first_receipt := pwt.save_campaign(0, op, 1, '{"seed":"A"}', null);
  assert first_receipt->>'revision' = '1', 'primera revisión';
  assert pwt.save_campaign(0, op, 1, '{"seed":"A"}', 'null') = first_receipt, 'reintento';
  perform pg_temp.expect_campaign_error(format('select pwt.save_campaign(0, %L, 1, ''{}'', null)', op), 'campaign_operation_reused');
  perform pg_temp.expect_campaign_error('select pwt.save_campaign(0, gen_random_uuid(), 1, ''{}'', null)', 'campaign_revision_conflict');
  perform pwt.save_campaign(1, gen_random_uuid(), 1, '{"seed":"A","choice":1}', '{"decisions":[]}');
  assert pwt.save_campaign(0, op, 1, '{"seed":"A"}', null) = first_receipt, 'reintento antiguo';
  assert pwt.get_campaign()->>'revision' = '2', 'el reintento no revierte';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', b, 'is_anonymous', false)::text, true);
  assert pwt.get_campaign() is null, 'B no lee A por RPC';
  perform pg_temp.expect_campaign_error('select pwt.save_campaign(2, gen_random_uuid(), 1, ''{}'', null)', 'campaign_revision_conflict');
  perform pg_temp.expect_campaign_error('select * from pwt.campaigns', 'permission denied');
  perform pg_temp.expect_campaign_error('select * from pwt.campaign_operations', 'permission denied');
  perform pg_temp.expect_campaign_error(format('update pwt.campaigns set revision = 99 where user_id = %L', a), 'permission denied');
  perform pwt.save_campaign(0, op, 1, '{"seed":"B"}', null);

  -- Acredita RLS independientemente de los GRANT: habilita acceso solo dentro de esta transacción.
  reset role;
  grant usage on schema auth to authenticated;
  grant select, insert, update, delete on pwt.campaigns, pwt.campaign_operations to authenticated;
  set local role authenticated;
  assert (select count(*) from pwt.campaigns) = 1, 'RLS solo devuelve B';
  assert (select count(*) from pwt.campaign_operations) = 1, 'RLS solo devuelve recibos de B';
  assert not exists (select 1 from pwt.campaigns where user_id = a), 'RLS oculta A';
  update pwt.campaigns set state = '{}' where user_id = a;
  assert not found, 'RLS impide update ajeno';
  delete from pwt.campaigns where user_id = a;
  assert not found, 'RLS impide delete ajeno';
  update pwt.campaign_operations set revision = 99 where user_id = a;
  assert not found, 'RLS impide editar recibos ajenos';
  delete from pwt.campaign_operations where user_id = a;
  assert not found, 'RLS impide borrar recibos ajenos';
  perform pg_temp.expect_campaign_error(format('insert into pwt.campaigns values (%L, 1, 1, ''{}'', null, now())', a), 'row-level security');
  perform pg_temp.expect_campaign_error(format('insert into pwt.campaign_operations values (%L, gen_random_uuid(), ''x''::bytea, 3)', a), 'row-level security');
  perform pg_temp.expect_campaign_error(format('update pwt.campaigns set user_id = %L where user_id = %L', a, b), 'row-level security');

  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'is_anonymous', true)::text, true);
  assert not exists (select 1 from pwt.campaigns), 'anónimo no lee ni su propia fila';
  perform pg_temp.expect_campaign_error('select pwt.get_campaign()', 'not_registered');
  perform pg_temp.expect_campaign_error('select pwt.save_campaign(2, gen_random_uuid(), 1, ''{}'', null)', 'not_registered');
  reset role;
  revoke all on pwt.campaigns, pwt.campaign_operations from authenticated;
  set local role anon;
  perform set_config('request.jwt.claims', '{}', true);
  perform pg_temp.expect_campaign_error('select pwt.get_campaign()', 'permission denied');
  perform pg_temp.expect_campaign_error('select pwt.save_campaign(0, gen_random_uuid(), 1, ''{}'', null)', 'permission denied');
  reset role;
  assert (select state->>'seed' from pwt.campaigns where user_id = a) = 'A', 'campaña A intacta';
  assert (select revision from pwt.campaigns where user_id = a) = 2, 'revisión A intacta';
end $$;

select 'ok 1 - campaña: revisión, reintentos, RPC, privilegios y RLS entre cuentas';
rollback;
