-- Family pairing. Deploy separately after database review; no mobile secrets.
-- Short pairing codes are single-purpose, hashed, expiring and limited-use.
-- The code itself grants nothing; only claim_pairing_code creates an explicit
-- patient_memberships row, and every read is re-authorized against it.
begin;

create table public.pairing_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{32}$'),
  owner_id uuid not null references public.sync_accounts(owner_id),
  patient_id text not null,
  access_role text not null default 'family' check (access_role in ('family','caregiver','healthcare_worker')),
  scopes text[] not null default '{}',
  label text not null default '' check (length(label) <= 64),
  max_uses integer not null default 1 check (max_uses between 1 and 5),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(owner_id, patient_id) references public.sync_patients(owner_id, patient_id)
);
create table public.patient_memberships (
  patient_id text not null,
  owner_id uuid not null,
  member_id uuid not null references auth.users(id),
  access_role text not null check (access_role in ('family','caregiver','healthcare_worker')),
  scopes text[] not null default '{}',
  label text not null default '' check (length(label) <= 64),
  revoked_at timestamptz,
  granted_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(patient_id, member_id),
  foreign key(owner_id, patient_id) references public.sync_patients(owner_id, patient_id),
  check (member_id <> owner_id)
);
alter table public.pairing_codes enable row level security;
alter table public.patient_memberships enable row level security;
create table public.pairing_attempts (
  account_id uuid primary key references auth.users(id),
  attempts integer not null default 0,
  reset_at timestamptz not null default now()
);
alter table public.pairing_attempts enable row level security;
revoke all on public.pairing_codes, public.patient_memberships, public.pairing_attempts from public, anon, authenticated;
-- RPC-only access: no direct table grants, so existing grant snapshots are unchanged.

create function public.valid_pairing_scopes(scopes text[])
returns boolean language sql immutable set search_path = '' as $$
  select scopes is not null and coalesce(array_length(scopes, 1), 0) between 1 and 5
    and array_position(scopes, null) is null
    and (select bool_and(s = any (array['daily_activity','reminders','cognitive_activity','reports','memories']))
      from unnest(scopes) s);
$$;

create function public.create_pairing_code(p_patient text, p_scopes text[], p_label text default '',
  p_role text default 'family', p_ttl_minutes integer default 15, p_max_uses integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  code text := '';
  tries integer := 0;
  expires timestamptz;
begin
  if account is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from public.sync_patients where owner_id = account and patient_id = p_patient) then
    raise exception 'Patient is not authorized.' using errcode = '42501';
  end if;
  if p_role is null or p_ttl_minutes is null or p_max_uses is null or p_role not in ('family','caregiver','healthcare_worker') or not public.valid_pairing_scopes(p_scopes)
    or length(coalesce(p_label, '')) > 64 or p_ttl_minutes not between 5 and 60 or p_max_uses not between 1 and 5 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  perform 1 from public.sync_accounts where owner_id = account for update;
  if (select count(*) from public.pairing_codes where owner_id = account and revoked_at is null
    and expires_at > now() and uses < max_uses) >= 10 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  expires := now() + (p_ttl_minutes || ' minutes')::interval;
  loop
    tries := tries + 1;
    -- Two independent random UUID prefixes: 64 CSPRNG bits, no version bits.
    code := upper(left(gen_random_uuid()::text, 8) || left(gen_random_uuid()::text, 8));
    begin
      insert into public.pairing_codes(code_hash, owner_id, patient_id, access_role, scopes, label, max_uses, expires_at)
      values (md5(code), account, p_patient, p_role, p_scopes, coalesce(p_label, ''), p_max_uses, expires);
      exit;
    exception when unique_violation then
      if tries >= 5 then raise exception 'Code generation failed.'; end if;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'code', code, 'expires_at', expires);
end;
$$;

create function public.claim_pairing_code(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  normalized text := upper(btrim(coalesce(p_code, '')));
  row public.pairing_codes%rowtype;
  hits integer;
begin
  if account is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  insert into public.pairing_attempts(account_id, attempts, reset_at) values(account, 1, now() + interval '15 minutes')
  on conflict (account_id) do update set
    attempts = case when pairing_attempts.reset_at <= now() then 1 else pairing_attempts.attempts + 1 end,
    reset_at = case when pairing_attempts.reset_at <= now() then now() + interval '15 minutes' else pairing_attempts.reset_at end
  returning attempts into hits;
  if hits > 20 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  if normalized !~ '^[A-F0-9]{16}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  select * into row from public.pairing_codes where code_hash = md5(normalized) for update;
  if row.code_hash is null or row.revoked_at is not null or row.owner_id = account then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if row.expires_at <= now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if row.uses >= row.max_uses then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  if exists(select 1 from public.patient_memberships where patient_id = row.patient_id and member_id = account and owner_id <> row.owner_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  insert into public.patient_memberships(patient_id, owner_id, member_id, access_role, scopes, label, granted_by)
  values (row.patient_id, row.owner_id, account, row.access_role, row.scopes, row.label, row.owner_id)
  on conflict (patient_id, member_id) do update set
    revoked_at = null, access_role = excluded.access_role, scopes = excluded.scopes,
    label = excluded.label, granted_by = excluded.granted_by, updated_at = now()
    where patient_memberships.owner_id = excluded.owner_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  update public.pairing_codes set uses = uses + 1 where code_hash = row.code_hash;
  return jsonb_build_object('ok', true, 'patient_id', row.patient_id,
    'access_role', row.access_role, 'scopes', row.scopes, 'label', row.label);
end;
$$;

create function public.revoke_membership(p_patient text, p_member uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  target uuid := coalesce(p_member, account);
  grantor uuid;
  revoked integer := 0;
begin
  if account is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select owner_id into grantor from public.sync_patients where owner_id = account and patient_id = p_patient;
  if grantor is null then
    -- A member may only leave their own grant; they cannot touch other members.
    if target is distinct from account then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;
  update public.patient_memberships set revoked_at = now(), updated_at = now()
  where patient_id = p_patient and member_id = target and revoked_at is null
    and (owner_id = account or member_id = account);
  get diagnostics revoked = row_count;
  if grantor is not null then
    update public.pairing_codes set revoked_at = now()
    where owner_id = account and patient_id = p_patient and revoked_at is null;
  end if;
  return jsonb_build_object('ok', true, 'revoked', revoked);
end;
$$;

create function public.list_memberships()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
begin
  if account is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  return jsonb_build_object('ok', true,
    'received', coalesce((select jsonb_agg(jsonb_build_object(
      'patient_id', m.patient_id, 'access_role', m.access_role, 'scopes', m.scopes, 'label', m.label,
      'display_name', (select p.payload->>'preferred_name' from public.sync_records p
        where p.owner_id = m.owner_id and p.patient_id = m.patient_id and p.entity_type = 'patient_profiles' and not p.deleted)))
      from public.patient_memberships m where m.member_id = account and m.revoked_at is null), '[]'::jsonb),
    'granted', coalesce((select jsonb_agg(jsonb_build_object(
      'patient_id', m.patient_id, 'member_id', m.member_id, 'access_role', m.access_role,
      'scopes', m.scopes, 'label', m.label, 'revoked', m.revoked_at is not null, 'updated_at', m.updated_at))
      from public.patient_memberships m where m.owner_id = account), '[]'::jsonb));
end;
$$;

create function public.granted_snapshot(p_patient text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  m public.patient_memberships%rowtype;
  name text;
begin
  if account is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into m from public.patient_memberships
  where patient_id = p_patient and member_id = account and revoked_at is null;
  if m.patient_id is null then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select p.payload->>'preferred_name' into name from public.sync_records p
  where p.owner_id = m.owner_id and p.patient_id = p_patient and p.entity_type = 'patient_profiles' and not p.deleted;
  return jsonb_build_object('ok', true, 'patient_id', p_patient, 'display_name', name, 'scopes', m.scopes,
    'counts', case when 'daily_activity' = any (m.scopes) then jsonb_build_object(
      'sessions_total', (select count(*) from public.sync_records
        where owner_id = m.owner_id and patient_id = p_patient and entity_type = 'cognitive_sessions' and not deleted),
      'sessions_7d', (select count(*) from public.sync_records
        where owner_id = m.owner_id and patient_id = p_patient and entity_type = 'cognitive_sessions' and not deleted
          and (payload->>'completed_at')::timestamptz > now() - interval '7 days'),
      'reminders_pending', (select count(*) from public.sync_records
        where owner_id = m.owner_id and patient_id = p_patient and entity_type = 'reminders' and not deleted
          and coalesce((payload->>'is_enabled')::int, 0) = 1 and (payload->>'deleted_at') is null),
      'memories', case when 'memories' = any(m.scopes) then (select count(*) from public.sync_records
        where owner_id = m.owner_id and patient_id = p_patient and entity_type = 'personal_memories' and not deleted) else null end,
      'reports', (select count(*) from public.sync_records
        where owner_id = m.owner_id and patient_id = p_patient and entity_type = 'activity_reports' and not deleted))
      else null end,
    'sessions', case when 'cognitive_activity' = any (m.scopes) then coalesce((select jsonb_agg(x order by completed desc) from
      (select payload->>'game_type' as game, (payload->>'attempts')::int as attempts,
        (payload->>'accuracy')::numeric as accuracy, payload->>'completed_at' as completed from public.sync_records
        where owner_id = m.owner_id and patient_id = p_patient and entity_type = 'cognitive_sessions' and not deleted
        order by (payload->>'completed_at') desc limit 10) x), '[]'::jsonb) else null end,
    'reminders', case when 'reminders' = any (m.scopes) then coalesce((select jsonb_agg(x) from
      (select entity_id as id, version, payload->>'title' as title, payload->>'type' as type, payload->>'time_of_day' as time,
        payload->>'repeat_rule' as repeat, payload->>'scheduled_date' as date from public.sync_records
        where owner_id = m.owner_id and patient_id = p_patient and entity_type = 'reminders' and not deleted
          and coalesce((payload->>'is_enabled')::int, 0) = 1 and (payload->>'deleted_at') is null
        order by payload->>'time_of_day' limit 25) x), '[]'::jsonb) else null end,
    'memories', case when 'memories' = any (m.scopes) then coalesce((select jsonb_agg(x) from
      (select entity_id as id, version, payload->>'name' as name, payload->>'relationship' as relationship, payload->>'description' as description
        from public.sync_records where owner_id = m.owner_id and patient_id = p_patient
          and entity_type = 'personal_memories' and not deleted order by payload->>'updated_at' desc limit 25) x), '[]'::jsonb) else null end,
    'reports', case when 'reports' = any (m.scopes) then coalesce((select jsonb_agg(payload) from
      (select jsonb_build_object('generated_at',payload->>'generated_at', 'period_start',payload->>'period_start',
        'period_end',payload->>'period_end', 'facts', (payload->>'snapshot')::jsonb - 'games' - 'routine' - 'memories'
          || case when 'cognitive_activity' = any(m.scopes) then jsonb_build_object('games',(payload->>'snapshot')::jsonb->'games') else '{}'::jsonb end
          || case when 'daily_activity' = any(m.scopes) or 'reminders' = any(m.scopes) then jsonb_build_object('routine',(payload->>'snapshot')::jsonb->'routine') else '{}'::jsonb end
          || case when 'memories' = any(m.scopes) then jsonb_build_object('memories',(payload->>'snapshot')::jsonb->'memories') else '{}'::jsonb end) as payload
        from public.sync_records where owner_id = m.owner_id and patient_id = p_patient
        and entity_type = 'activity_reports' and not deleted order by payload->>'generated_at' desc limit 3) x), '[]'::jsonb) else null end);
end;
$$;

revoke all on function public.valid_pairing_scopes(text[]) from public, anon, authenticated;
revoke all on function public.create_pairing_code(text, text[], text, text, integer, integer) from public, anon;
revoke all on function public.claim_pairing_code(text) from public, anon;
revoke all on function public.revoke_membership(text, uuid) from public, anon;
revoke all on function public.list_memberships() from public, anon;
revoke all on function public.granted_snapshot(text) from public, anon;
grant execute on function public.create_pairing_code(text, text[], text, text, integer, integer) to authenticated;
grant execute on function public.claim_pairing_code(text) to authenticated;
grant execute on function public.revoke_membership(text, uuid) to authenticated;
grant execute on function public.list_memberships() to authenticated;
grant execute on function public.granted_snapshot(text) to authenticated;
-- Revoke outstanding codes without revoking any existing relationship.
create function public.patient_access(p_patient text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if exists(select 1 from public.sync_patients where owner_id=auth.uid() and patient_id=p_patient) then role:='owner';
  else select access_role into role from public.patient_memberships where patient_id=p_patient and member_id=auth.uid() and revoked_at is null;
  end if;
  if role is null then return jsonb_build_object('ok',false,'error','forbidden'); end if;
  return jsonb_build_object('ok',true,'role',role);
end;
$$;
revoke all on function public.patient_access(text) from public, anon;
grant execute on function public.patient_access(text) to authenticated;

create function public.revoke_pairing_codes(p_patient text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.sync_patients where owner_id = auth.uid() and patient_id = p_patient) then
    return jsonb_build_object('ok',false,'error','forbidden');
  end if;
  update public.pairing_codes set revoked_at = now() where owner_id = auth.uid() and patient_id = p_patient and revoked_at is null;
  return jsonb_build_object('ok',true);
end;
$$;

-- Bounded remote editing; never accepts table names or arbitrary record fields.
-- The owner's commit-ordered version stream brings edits into SQLite through existing pull sync.
create function public.update_shared_record(p_patient text, p_kind text, p_id text, p_version bigint, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.patient_memberships; saved public.sync_records; revised jsonb; v bigint; scope text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  scope := case p_kind when 'reminders' then 'reminders' when 'personal_memories' then 'memories' end;
  select * into m from public.patient_memberships where patient_id = p_patient and member_id = auth.uid() and revoked_at is null for share;
  if m.patient_id is null or scope is null or not scope = any(m.scopes) then return jsonb_build_object('ok',false,'error','forbidden'); end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or octet_length(p_patch::text) > 4096 or p_patch = '{}'::jsonb or
    p_patch - (case p_kind when 'reminders' then array['title','note','time_of_day','is_enabled'] else array['name','relationship','description'] end) <> '{}'::jsonb then
    return jsonb_build_object('ok',false,'error','invalid_input');
  end if;
  perform 1 from public.sync_accounts where owner_id = m.owner_id for update;
  select * into saved from public.sync_records where owner_id = m.owner_id and patient_id = p_patient and entity_type = p_kind and entity_id = p_id;
  if saved.version is null or saved.deleted or saved.payload->>'deleted_at' is not null then return jsonb_build_object('ok',false,'error','forbidden'); end if;
  if p_version is distinct from saved.version then return jsonb_build_object('ok',false,'error','conflict'); end if;
  revised := saved.payload || p_patch || jsonb_build_object('updated_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  if not public.valid_sync_record(p_kind,p_patient,p_id,revised,'upsert') then return jsonb_build_object('ok',false,'error','invalid_input'); end if;
  update public.sync_accounts set version = version + 1, updated_at = now() where owner_id = m.owner_id returning version into v;
  update public.sync_records set payload = revised, version = v, updated_at = now() where owner_id = m.owner_id and entity_type = p_kind and entity_id = p_id;
  return jsonb_build_object('ok',true,'version',v);
end;
$$;

-- AI receives only server-authorized, bounded recorded facts. Client context is never accepted.
create function public.assistant_context(p_patient text, p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare account uuid := auth.uid(); owner uuid; scopes text[]; role text; records jsonb;
begin
  if account is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_day is null or abs(p_day - current_date) > 1 then return jsonb_build_object('ok',false,'error','invalid_input'); end if;
  select owner_id into owner from public.sync_patients where owner_id = account and patient_id = p_patient;
  if owner is not null then
    role := 'owner'; scopes := array['daily_activity','reminders','cognitive_activity','memories'];
  else
    select owner_id, m.scopes, access_role into owner, scopes, role from public.patient_memberships m
      where patient_id = p_patient and member_id = account and revoked_at is null;
  end if;
  if owner is null then return jsonb_build_object('ok',false,'error','forbidden'); end if;
  with reminders as (
    select entity_type,entity_id,payload from public.sync_records where owner_id = owner and patient_id = p_patient and not deleted
      and entity_type = 'reminders' and ('reminders' = any(scopes) or 'daily_activity' = any(scopes))
      and payload->>'deleted_at' is null and payload->>'is_enabled' = '1'
      and (payload->>'repeat_rule' = 'daily' or payload->>'scheduled_date' = p_day::text)
      order by payload->>'time_of_day',entity_id limit 25
  ), visible as (
    (select entity_type,entity_id,payload from public.sync_records where owner_id = owner and patient_id = p_patient and not deleted
      and entity_type = 'cognitive_sessions' and 'cognitive_activity' = any(scopes)
      and (payload->>'completed_at')::timestamptz >= p_day - interval '7 days'
      order by payload->>'completed_at' desc limit 50)
    union all select * from reminders
    union all select entity_type,entity_id,payload from public.sync_records where owner_id = owner and patient_id = p_patient and not deleted
      and entity_type = 'reminder_events' and left(payload->>'scheduled_for',10) = p_day::text
      and payload->>'reminder_id' in (select entity_id from reminders)
    union all (select entity_type,entity_id,payload from public.sync_records where owner_id = owner and patient_id = p_patient and not deleted
      and entity_type = 'personal_memories' and 'memories' = any(scopes) order by version desc limit 25)
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind',entity_type,'id',entity_id,'data',
    (select jsonb_object_agg(key,value) from jsonb_each(payload) where key = any(case entity_type
      when 'cognitive_sessions' then array['game_type','completed_at']
      when 'reminders' then array['title','time_of_day','repeat_rule','scheduled_date','is_enabled','deleted_at']
      when 'reminder_events' then array['reminder_id','scheduled_for']
      else array['name','relationship','description'] end))) order by entity_type,entity_id), '[]'::jsonb) into records from visible;
  return jsonb_build_object('ok',true,'role',role,'scopes',scopes,'records',records);
end;
$$;
revoke all on function public.revoke_pairing_codes(text) from public, anon;
revoke all on function public.update_shared_record(text,text,text,bigint,jsonb) from public, anon;
revoke all on function public.assistant_context(text,date) from public, anon;
grant execute on function public.revoke_pairing_codes(text) to authenticated;
grant execute on function public.update_shared_record(text,text,text,bigint,jsonb) to authenticated;
grant execute on function public.assistant_context(text,date) to authenticated;
-- Retire GPS from the admin response while preserving historical tables and records.
create or replace function public.admin_patients() returns jsonb language plpgsql security definer set search_path='' as $$
declare account uuid := auth.uid();
begin
  if account is null or not exists(select 1 from auth.users where id=account and raw_app_meta_data->>'role'='admin') then
    raise exception 'Admin authorization required' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('patient',p.payload,
    'reports',coalesce((select jsonb_agg(r.payload) from (select payload from public.sync_records where owner_id=account and patient_id=p.patient_id and entity_type='activity_reports' and not deleted order by payload->>'generated_at' desc limit 20) r),'[]'::jsonb)))
    from public.sync_records p where p.owner_id=account and p.entity_type='patient_profiles' and not p.deleted),'[]'::jsonb);
end;
$$;
revoke all on function public.valid_sync_record(text,text,text,jsonb,text) from authenticated;
commit;
