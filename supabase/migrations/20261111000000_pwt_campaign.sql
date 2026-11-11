-- Campaña por cuenta, independiente del oficial diario. La API no acepta un propietario del cliente.
create table if not exists pwt.campaigns (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null check (schema_version = 1),
  revision bigint not null check (revision between 1 and 9007199254740991),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  battle jsonb check (battle is null or jsonb_typeof(battle) = 'object'),
  updated_at timestamptz not null default now()
);

-- Conserva recibos, no copias completas de cada turno. Un reintento antiguo tampoco vuelve a escribir.
create table if not exists pwt.campaign_operations (
  user_id uuid not null references pwt.campaigns(user_id) on delete cascade,
  operation_id uuid not null,
  request_hash bytea not null,
  revision bigint not null check (revision between 1 and 9007199254740991),
  primary key (user_id, operation_id),
  unique (user_id, revision)
);

alter table pwt.campaigns enable row level security;
alter table pwt.campaign_operations enable row level security;
revoke all on pwt.campaigns, pwt.campaign_operations from public, anon, authenticated;

-- Defensa adicional al cierre de privilegios: solo el dueño con cuenta, nunca una sesión anónima.
drop policy if exists campaign_owner on pwt.campaigns;
create policy campaign_owner on pwt.campaigns for all to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false))
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
drop policy if exists campaign_operation_owner on pwt.campaign_operations;
create policy campaign_operation_owner on pwt.campaign_operations for all to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false))
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));

create or replace function pwt.get_campaign() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := pwt.require_registered();
begin
  return (select jsonb_build_object('version', c.schema_version, 'revision', c.revision,
    'state', c.state, 'battle', c.battle) from pwt.campaigns c where c.user_id = uid);
end $$;

-- Revisión 0 = crear. Cada operación nueva incrementa exactamente una revisión.
-- El recibo devuelve la revisión original, aunque haya escrituras posteriores; no es una lectura del estado vigente.
create or replace function pwt.save_campaign(
  p_expected_revision bigint, p_operation_id uuid, p_version integer, p_state jsonb, p_battle jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := pwt.require_registered();
  current_revision bigint;
  fingerprint bytea;
  receipt pwt.campaign_operations%rowtype;
begin
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 9007199254740991
    or p_operation_id is null or p_version is distinct from 1
    or p_state is null or jsonb_typeof(p_state) <> 'object'
    or (p_battle is not null and jsonb_typeof(p_battle) not in ('object', 'null')) then
    raise exception 'invalid_campaign';
  end if;
  -- Normaliza null JSON/SQL y orden de claves antes de identificar la petición.
  p_battle := nullif(p_battle, 'null'::jsonb);
  fingerprint := sha256(convert_to(jsonb_build_array(p_expected_revision, p_version, p_state, p_battle)::text, 'UTF8'));

  -- Serializa también la primera escritura, cuando todavía no existe fila que bloquear.
  perform pg_advisory_xact_lock(hashtextextended('pwt.campaign:' || uid::text, 0));
  select * into receipt from pwt.campaign_operations where user_id = uid and operation_id = p_operation_id;
  if found then
    if receipt.request_hash <> fingerprint then raise exception 'campaign_operation_reused'; end if;
    return jsonb_build_object('revision', receipt.revision, 'operationId', p_operation_id);
  end if;

  select revision into current_revision from pwt.campaigns where user_id = uid for update;
  if coalesce(current_revision, 0) <> p_expected_revision then raise exception 'campaign_revision_conflict'; end if;
  current_revision := p_expected_revision + 1;
  insert into pwt.campaigns(user_id, schema_version, revision, state, battle)
    values (uid, p_version, current_revision, p_state, p_battle)
    on conflict (user_id) do update set schema_version = excluded.schema_version,
      revision = excluded.revision, state = excluded.state, battle = excluded.battle, updated_at = now();
  insert into pwt.campaign_operations(user_id, operation_id, request_hash, revision)
    values (uid, p_operation_id, fingerprint, current_revision);
  return jsonb_build_object('revision', current_revision, 'operationId', p_operation_id);
end $$;

revoke all on function pwt.get_campaign() from public, anon;
revoke all on function pwt.save_campaign(bigint, uuid, integer, jsonb, jsonb) from public, anon;
grant execute on function pwt.get_campaign() to authenticated;
grant execute on function pwt.save_campaign(bigint, uuid, integer, jsonb, jsonb) to authenticated;
