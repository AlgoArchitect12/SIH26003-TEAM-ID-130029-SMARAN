-- MVP-22. Apply to a Supabase project before configuring a client build.
begin;

create table public.sync_accounts (
  owner_id uuid primary key references auth.users(id),
  version bigint not null default 0 check (version between 0 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sync_patients (
  owner_id uuid not null references public.sync_accounts(owner_id),
  patient_id text not null check (patient_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(owner_id, patient_id)
);
create table public.sync_records (
  owner_id uuid not null,
  patient_id text not null,
  entity_type text not null check (entity_type in ('patient_profiles','patient_settings','reminders','reminder_events','cognitive_sessions','adaptive_model_state','personal_memories')),
  entity_id text not null check (length(entity_id) between 1 and 256),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16384),
  deleted boolean not null default false,
  version bigint not null check (version between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(owner_id, entity_type, entity_id),
  unique(owner_id, version),
  foreign key(owner_id, patient_id) references public.sync_patients(owner_id, patient_id),
  check (not deleted or (entity_type = 'personal_memories' and payload = '{}'::jsonb))
);
create table public.sync_mutations (
  owner_id uuid not null references public.sync_accounts(owner_id),
  mutation_id text not null check (mutation_id ~ '^[0-9a-f]{32}$'),
  request jsonb not null check (octet_length(request::text) <= 18000),
  version bigint not null check (version > 0),
  created_at timestamptz not null default now(),
  primary key(owner_id, mutation_id)
);

alter table public.sync_accounts enable row level security;
alter table public.sync_patients enable row level security;
alter table public.sync_records enable row level security;
alter table public.sync_mutations enable row level security;
create policy account_owner on public.sync_accounts for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy patient_owner on public.sync_patients for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy record_owner on public.sync_records for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy mutation_owner on public.sync_mutations for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
-- Writes must use RPC so mutation identity and commit-ordered versions cannot be bypassed.
revoke all on public.sync_accounts, public.sync_patients, public.sync_records, public.sync_mutations from anon, authenticated;
grant select on public.sync_accounts, public.sync_patients, public.sync_records, public.sync_mutations to authenticated;

create function public.valid_sync_record(kind text, patient text, entity text, p jsonb, operation text)
returns boolean language plpgsql stable set search_path = '' as $$
declare fields text[]; k text; v jsonb; completed integer;
begin
  if patient is null or patient !~ '^[A-Za-z0-9_-]{1,128}$' or entity is null or length(entity) > 256 or
     jsonb_typeof(p) is distinct from 'object' or octet_length(p::text) > 16384 then return false; end if;
  if operation = 'delete' then return kind = 'personal_memories' and entity ~ '^[A-Za-z0-9_-]{1,128}$' and p = '{}'::jsonb; end if;
  if operation is distinct from 'upsert' then return false; end if;
  fields := case kind
    when 'patient_profiles' then array['id','preferred_name','age_bracket','emergency_name','emergency_phone','created_at','updated_at']
    when 'patient_settings' then array['patient_id','language','region','text_size','high_contrast','voice_guidance','reduced_motion','updated_at']
    when 'reminders' then array['id','patient_id','type','title','note','time_of_day','scheduled_date','repeat_rule','is_enabled','deleted_at','created_at','updated_at']
    when 'reminder_events' then array['reminder_id','patient_id','scheduled_for','status','completed_at','created_at']
    when 'cognitive_sessions' then array['id','patient_id','game_type','difficulty','started_at','completed_at','total_pairs','attempts','matches','hints_used','repeated_mistakes','avg_response_ms','accuracy','feedback_label','recommended_difficulty','created_at','challenges_completed','steps_completed','correct_selections','repeated_errors']
    when 'adaptive_model_state' then array['patient_id','game_type','bias','weight_accuracy','weight_pace','weight_memory','weight_hints','weight_stability','sample_count','updated_at']
    when 'personal_memories' then array['id','patient_id','name','relationship','description','created_at','updated_at']
    else null end;
  if fields is null or not (p ?& fields) or p - fields <> '{}'::jsonb then return false; end if;
  for k, v in select key, value from jsonb_each(p) loop
    if jsonb_typeof(v) not in ('string','number','null') or (jsonb_typeof(v) = 'string' and length(p->>k) > 2048) then return false; end if;
    if k = any(array['high_contrast','voice_guidance','reduced_motion','is_enabled','difficulty','attempts','hints_used','recommended_difficulty',
      'total_pairs','matches','repeated_mistakes','challenges_completed','steps_completed','correct_selections','repeated_errors',
      'avg_response_ms','accuracy','bias','weight_accuracy','weight_pace','weight_memory','weight_hints','weight_stability','sample_count']) then
      if jsonb_typeof(v) <> 'number' and not (v = 'null'::jsonb and k = any(array['total_pairs','matches','repeated_mistakes',
        'challenges_completed','steps_completed','correct_selections','repeated_errors'])) then return false; end if;
    elsif jsonb_typeof(v) <> 'string' and not (v = 'null'::jsonb and k = any(array['age_bracket','emergency_name','emergency_phone','scheduled_date','deleted_at','feedback_label'])) then
      return false;
    end if;
    if k like '%\_at' escape '\' and v <> 'null'::jsonb then
      if jsonb_typeof(v) <> 'string' or not isfinite((p->>k)::timestamptz) then return false; end if;
    end if;
  end loop;
  if (case when kind = 'patient_profiles' then p->>'id' else p->>'patient_id' end) is distinct from patient then return false; end if;
  if (case kind when 'patient_settings' then patient when 'adaptive_model_state' then patient || ':' || (p->>'game_type')
      when 'reminder_events' then (p->>'reminder_id') || ':' || left(p->>'scheduled_for',10) else p->>'id' end) is distinct from entity then return false; end if;
  if p ? 'id' and (p->>'id') !~ '^[A-Za-z0-9_-]{1,128}$' then return false; end if;
  if p ? 'game_type' and coalesce(p->>'game_type','') not in ('memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall') then return false; end if;
  if kind = 'patient_profiles' then
    return coalesce(length(trim(p->>'preferred_name')) between 1 and 80 and
      (p->'age_bracket' = 'null'::jsonb or p->>'age_bracket' in ('60-70','70-80','80+')) and
      (p->'emergency_name' = 'null'::jsonb or length(p->>'emergency_name') <= 80) and
      (p->'emergency_phone' = 'null'::jsonb or length(p->>'emergency_phone') <= 32) and
      p->>'created_at' is not null and p->>'updated_at' is not null, false);
  elsif kind = 'patient_settings' then
    return coalesce(p->>'language' in ('en','hi','as','bn','mni','kha','lus') and
      p->>'region' in ('assam','arunachal','manipur','meghalaya','mizoram','nagaland','sikkim','tripura') and
      p->>'text_size' in ('standard','large','extra-large') and p->'high_contrast' in ('0'::jsonb,'1'::jsonb) and
      p->'voice_guidance' in ('0'::jsonb,'1'::jsonb) and p->'reduced_motion' in ('0'::jsonb,'1'::jsonb) and p->>'updated_at' is not null, false);
  elsif kind = 'personal_memories' then
    return coalesce(length(trim(p->>'name')) between 1 and 100 and length(p->>'relationship') <= 100 and
      length(p->>'description') <= 500 and p->>'created_at' is not null and p->>'updated_at' is not null, false);
  elsif kind = 'reminders' then
    return coalesce(p->>'type' in ('medicine','hydration','activity','appointment','custom') and length(trim(p->>'title')) between 1 and 120 and
      length(p->>'note') <= 300 and p->>'time_of_day' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and
      ((p->>'repeat_rule' = 'daily' and p->'scheduled_date' = 'null'::jsonb) or
       (p->>'repeat_rule' = 'once' and p->>'scheduled_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (p->>'scheduled_date')::date::text = p->>'scheduled_date')) and
      p->'is_enabled' in ('0'::jsonb,'1'::jsonb) and (p->'deleted_at' = 'null'::jsonb or p->'is_enabled' = '0'::jsonb) and
      p->>'created_at' is not null and p->>'updated_at' is not null, false);
  elsif kind = 'reminder_events' then
    return coalesce(p->>'reminder_id' ~ '^[A-Za-z0-9_-]{1,128}$' and p->>'status' = 'completed' and
      p->>'scheduled_for' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]$' and
      left(p->>'scheduled_for',10)::date::text = left(p->>'scheduled_for',10) and p->>'completed_at' is not null and p->>'created_at' is not null, false);
  elsif kind = 'adaptive_model_state' then
    foreach k in array array['bias','weight_accuracy','weight_pace','weight_memory','weight_hints','weight_stability'] loop
      if jsonb_typeof(p->k) <> 'number' or (p->>k)::numeric not between -2 and 2 then return false; end if;
    end loop;
    return coalesce(p->>'sample_count' ~ '^[0-9]+$' and (p->>'sample_count')::numeric <= 9007199254740991 and p->>'updated_at' is not null, false);
  elsif kind = 'cognitive_sessions' then
    foreach k in array array['difficulty','attempts','hints_used','recommended_difficulty'] loop
      if jsonb_typeof(p->k) <> 'number' or (p->>k) !~ '^[0-9]+$' then return false; end if;
    end loop;
    if not coalesce((p->>'difficulty')::int between 1 and 5 and (p->>'recommended_difficulty')::int between 1 and 5 and
      (p->>'attempts')::int > 0 and (p->>'hints_used')::int >= 0 and jsonb_typeof(p->'avg_response_ms') = 'number' and
      (p->>'avg_response_ms')::numeric >= 0 and jsonb_typeof(p->'accuracy') = 'number' and (p->>'accuracy')::numeric between 0 and 1 and
      (p->>'completed_at')::timestamptz >= (p->>'started_at')::timestamptz and p->>'created_at' is not null and
      (p->'feedback_label' = 'null'::jsonb or p->>'feedback_label' in ('easy','comfortable','challenging')),false) then return false; end if;
    if p->>'game_type' = 'memory_match' then
      return coalesce((p->>'total_pairs')::int > 0 and p->'matches' = p->'total_pairs' and
        (p->>'repeated_mistakes')::int between 0 and (p->>'attempts')::int - (p->>'matches')::int and
        p->'challenges_completed' = 'null'::jsonb and p->'steps_completed' = 'null'::jsonb and
        p->'correct_selections' = 'null'::jsonb and p->'repeated_errors' = 'null'::jsonb,false);
    end if;
    completed := case when p->>'game_type' in ('routine_recall','sequence_memory') then (p->>'steps_completed')::int else (p->>'challenges_completed')::int end;
    return coalesce(completed > 0 and (p->>'correct_selections')::int = completed and
      (p->>'repeated_errors')::int between 0 and (p->>'attempts')::int - completed and
      abs((p->>'accuracy')::numeric - completed::numeric / (p->>'attempts')::int) < 0.000000001 and
      abs((p->>'difficulty')::int - (p->>'recommended_difficulty')::int) <= 1 and
      p->'total_pairs' = 'null'::jsonb and p->'matches' = 'null'::jsonb and p->'repeated_mistakes' = 'null'::jsonb and
      ((p->>'game_type' = 'routine_recall' and completed between 2 and 5 and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'sequence_memory' and completed between 2 and 6 and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' in ('pattern_recognition','familiar_object','picture_recall') and p->'steps_completed' = 'null'::jsonb)),false);
  end if;
  return false;
exception when others then return false;
end;
$$;

create function public.push_mutations(events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid(); e jsonb; saved public.sync_records; prior public.sync_mutations;
  result jsonb := '[]'::jsonb; next_version bigint; blocked boolean := false;
begin
  if account is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events) not between 1 and 25 or octet_length(events::text) > 450000 then
    raise exception 'Invalid batch' using errcode = '22023';
  end if;
  insert into public.sync_accounts(owner_id) values(account) on conflict do nothing;
  -- Per-account row lock remains held through commit: no cursor can skip an uncommitted earlier version.
  perform 1 from public.sync_accounts where owner_id = account for update;
  for e in select value from jsonb_array_elements(events) loop
    begin
      if blocked then raise exception 'Previous event requires attention' using errcode = '40001'; end if;
      if jsonb_typeof(e) is distinct from 'object' or e - array['mutation_id','patient_id','entity_type','entity_id','operation','payload'] <> '{}'::jsonb or
         coalesce(e->>'mutation_id','') !~ '^[0-9a-f]{32}$' or
         not public.valid_sync_record(e->>'entity_type',e->>'patient_id',e->>'entity_id',e->'payload',e->>'operation') then
        raise exception 'Invalid event' using errcode = '22023';
      end if;
      select * into prior from public.sync_mutations where owner_id = account and mutation_id = e->>'mutation_id';
      if found then
        if prior.request <> e then raise exception 'Mutation identity conflict' using errcode = '23505'; end if;
        result := result || jsonb_build_array(jsonb_build_object('mutation_id',e->>'mutation_id','status','duplicate'));
        continue;
      end if;
      if e->>'entity_type' = 'patient_profiles' then
        insert into public.sync_patients(owner_id,patient_id) values(account,e->>'patient_id') on conflict do nothing;
      elsif not exists(select 1 from public.sync_patients where owner_id = account and patient_id = e->>'patient_id') then
        raise exception 'Missing patient' using errcode = '23503';
      end if;
      if e->>'entity_type' = 'reminder_events' and not exists(select 1 from public.sync_records where owner_id = account and
        patient_id = e->>'patient_id' and entity_type = 'reminders' and entity_id = e->'payload'->>'reminder_id') then
        raise exception 'Missing reminder' using errcode = '23503';
      end if;
      select * into saved from public.sync_records where owner_id = account and entity_type = e->>'entity_type' and entity_id = e->>'entity_id';
      if found and saved.patient_id <> e->>'patient_id' then raise exception 'Patient identity conflict' using errcode = '23505'; end if;
      -- Immutable history is first-accepted; mutable state uses last server-accepted write. Tombstones never resurrect.
      if saved.version is not null and (saved.deleted or
        (saved.entity_type = 'reminders' and saved.payload->>'deleted_at' is not null) or e->>'entity_type' in ('cognitive_sessions','reminder_events')) then
        next_version := saved.version;
      else
        update public.sync_accounts set version = version + 1, updated_at = now() where owner_id = account returning version into next_version;
        insert into public.sync_records(owner_id,patient_id,entity_type,entity_id,payload,deleted,version)
          values(account,e->>'patient_id',e->>'entity_type',e->>'entity_id',e->'payload',e->>'operation' = 'delete',next_version)
          on conflict(owner_id,entity_type,entity_id) do update set payload = excluded.payload, deleted = excluded.deleted,
            version = excluded.version, updated_at = now();
      end if;
      insert into public.sync_mutations(owner_id,mutation_id,request,version) values(account,e->>'mutation_id',e,next_version);
      result := result || jsonb_build_array(jsonb_build_object('mutation_id',e->>'mutation_id','status','applied'));
    exception when others then
      result := result || jsonb_build_array(jsonb_build_object('mutation_id',e->>'mutation_id','status','rejected','error',
        case when sqlstate = '23505' then 'conflict' when sqlstate in ('22023','23503','23514','23502') then 'invalid' else 'server' end));
      blocked := true;
    end;
  end loop;
  return result;
end;
$$;

create function public.pull_changes(after_version bigint default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare account uuid := auth.uid(); rows jsonb; parents jsonb; cursor_value bigint;
begin
  if account is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if after_version is null or after_version < 0 or after_version > 9007199254740991 then raise exception 'Invalid cursor' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.version),'[]'::jsonb),coalesce(max(r.version),after_version) into rows,cursor_value
    from (select owner_id,patient_id,entity_type,entity_id,payload,deleted,version from public.sync_records
      where owner_id = account and version > after_version order by version limit 25) r;
  -- Include current parents from the same statement snapshot, even if their version sorts after a child.
  select coalesce(jsonb_agg(to_jsonb(r) order by r.version),'[]'::jsonb) into parents
    from (select owner_id,patient_id,entity_type,entity_id,payload,deleted,version from public.sync_records s
      where owner_id = account and (
        (entity_type in ('patient_profiles','patient_settings') and patient_id in (select value->>'patient_id' from jsonb_array_elements(rows))) or
        (entity_type = 'reminders' and exists(select 1 from jsonb_array_elements(rows) child where child->>'entity_type' = 'reminder_events'
          and child->>'patient_id' = s.patient_id and child->'payload'->>'reminder_id' = s.entity_id)))) r;
  return jsonb_build_object('records',rows,'parents',parents,'cursor',cursor_value,'has_more',
    exists(select 1 from public.sync_records where owner_id = account and version > cursor_value));
end;
$$;
revoke all on function public.valid_sync_record(text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.push_mutations(jsonb) from public, anon;
revoke all on function public.pull_changes(bigint) from public, anon;
grant execute on function public.push_mutations(jsonb) to authenticated;
grant execute on function public.pull_changes(bigint) to authenticated;
commit;
