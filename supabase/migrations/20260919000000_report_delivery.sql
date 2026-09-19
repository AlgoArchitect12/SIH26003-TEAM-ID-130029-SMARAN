-- MVP-28. Forward only; do not deploy as part of source validation.
begin;
alter table public.sync_records drop constraint sync_records_entity_type_check;
alter table public.sync_records add constraint sync_records_entity_type_check check (entity_type in (
  'patient_profiles','patient_settings','reminders','reminder_events','cognitive_sessions','adaptive_model_state','personal_memories',
  'care_circle_members','activity_reports','report_preferences','report_recipients','report_deliveries'));

create or replace function public.valid_care_record(kind text, patient text, entity text, p jsonb, operation text)
returns boolean language plpgsql stable set search_path = '' as $$
declare fields text[]; k text; v jsonb; s jsonb; g jsonb; n integer := 0;
  games text[] := array['memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall','remember_lights','number_path','sudoku_lite','chess_puzzle','word_match'];
begin
  if operation is distinct from 'upsert' or patient is null or patient !~ '^[A-Za-z0-9_-]{1,128}$' or
    entity is null or entity !~ '^[A-Za-z0-9_-]{1,128}$' or jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>16384 then return false; end if;
  fields := case kind
    when 'care_circle_members' then array['id','patient_id','display_name','relationship','access_role','email','phone','status','scopes','created_at','updated_at']
    when 'activity_reports' then array['id','patient_id','period_start','period_end','generated_at','report_version','snapshot','delivery_state','updated_at']
    when 'report_preferences' then array['patient_id','recipient_id','frequency','requested','consented_at','last_requested_at','delivery_status','updated_at']
    when 'report_recipients' then array['id','patient_id','care_member_id','channel','normalized_destination','consent_status','frequency','created_at','updated_at','revoked_at']
    when 'report_deliveries' then array['id','patient_id','recipient_id','report_period','report_start','report_end','report_snapshot_id','status','provider','provider_message_id','attempt_count','last_error','queued_at','sent_at','delivered_at','failed_at','created_at','updated_at']
    else null end;
  if fields is null or not(p ?& fields) or p-fields <> '{}'::jsonb or p->>'patient_id' is distinct from patient or
    (case when kind='report_preferences' then patient else p->>'id' end) is distinct from entity then return false; end if;
  for k,v in select key,value from jsonb_each(p) loop
    if k in ('requested','report_version','attempt_count') then
      if jsonb_typeof(v) <> 'number' then return false; end if;
    elsif v='null'::jsonb and k in ('email','phone','recipient_id','consented_at','last_requested_at','care_member_id','revoked_at','provider','provider_message_id','last_error','sent_at','delivered_at','failed_at') then null;
    elsif jsonb_typeof(v) <> 'string' or octet_length(p->>k) > (case when k='snapshot' then 12000 else 2048 end) then return false;
    end if;
    if k like '%\_at' escape '\' and v<>'null'::jsonb and not isfinite((p->>k)::timestamptz) then return false; end if;
  end loop;

  -- Use original checks for existing kinds
  if kind='care_circle_members' then
    s := (p->>'scopes')::jsonb;
    if jsonb_typeof(s)<>'array' or jsonb_array_length(s)>5 or
      exists(select 1 from jsonb_array_elements(s) x where jsonb_typeof(x)<>'string' or x #>> '{}' not in ('daily_activity','reminders','cognitive_activity','reports','memories')) or
      (select count(*) from jsonb_array_elements(s))<>(select count(distinct x) from jsonb_array_elements(s) x) then return false; end if;
    return coalesce(length(trim(p->>'display_name')) between 1 and 80 and length(trim(p->>'relationship')) between 1 and 100 and
      p->>'access_role' in ('family','caregiver','healthcare_worker') and p->>'status' in ('local','revoked') and
      (p->>'status'<>'revoked' or s='[]'::jsonb) and
      (p->'email'='null'::jsonb or (length(p->>'email')<=254 and p->>'email' ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')) and
      (p->'phone'='null'::jsonb or p->>'phone' ~ '^\+?[0-9 ()-]{5,32}$'),false);
  elsif kind='report_preferences' then
    return coalesce(p->>'frequency' in ('weekly','monthly') and p->'requested' in ('0'::jsonb,'1'::jsonb) and p->>'delivery_status'='not_configured' and
      (p->'recipient_id'='null'::jsonb or p->>'recipient_id' ~ '^[A-Za-z0-9_-]{1,128}$') and
      (p->'requested'='0'::jsonb or (p->'recipient_id'<>'null'::jsonb and p->'consented_at'<>'null'::jsonb and p->'last_requested_at'<>'null'::jsonb)),false);
  elsif kind='activity_reports' then
    if p->'report_version'<>'1'::jsonb or p->>'delivery_state' not in ('generated','share_requested') or
      not isfinite((p->>'period_start')::timestamptz) or not isfinite((p->>'period_end')::timestamptz) or
      (p->>'period_start')::timestamptz >= (p->>'period_end')::timestamptz then return false; end if;
    s := (p->>'snapshot')::jsonb;
    fields := array['patientName','days','timezone','games','routine','memories'];
    if jsonb_typeof(s)<>'object' or not(s ?& fields) or s-fields<>'{}'::jsonb or
      jsonb_typeof(s->'patientName')<>'string' or length(trim(s->>'patientName')) not between 1 and 80 or
      s->'days' not in ('7'::jsonb,'30'::jsonb) or jsonb_typeof(s->'timezone')<>'string' or length(s->>'timezone')>100 or
      jsonb_typeof(s->'games')<>'array' or jsonb_array_length(s->'games') not in (8,11) then return false; end if;
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=s->>'timezone') then return false; end if;
    for g in select value from jsonb_array_elements(s->'games') loop
      n := n+1; fields := array['gameType','sessions','attempts','correct','hints','repeatedErrors'];
      if jsonb_typeof(g)<>'object' or not(g ?& fields) or g-fields<>'{}'::jsonb or g->>'gameType' is distinct from games[n] then return false; end if;
      for k,v in select key,value from jsonb_each(g-'gameType') loop
        if v='null'::jsonb and k<>'sessions' then continue; end if;
        if jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]+$' or v::numeric>9007199254740991 then return false; end if;
      end loop;
      if g->'correct'<>'null'::jsonb and g->'attempts'<>'null'::jsonb and (g->>'correct')::numeric>(g->>'attempts')::numeric then return false; end if;
    end loop;
    foreach k in array array['routine','memories'] loop
      fields := case when k='routine' then array['completed','hydration','activity','appointment','unknownCategory','scheduledToday','completedToday'] else array['stored','added'] end;
      g := s->k;
      if jsonb_typeof(g)<>'object' or not(g ?& fields) or g-fields<>'{}'::jsonb then return false; end if;
      for v in select value from jsonb_each(g) loop
        if jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]+$' or v::numeric>9007199254740991 then return false; end if;
      end loop;
    end loop;
    return (s->'routine'->>'completedToday')::numeric <= (s->'routine'->>'scheduledToday')::numeric and
      (s->'memories'->>'added')::numeric <= (s->'memories'->>'stored')::numeric and
      (s->'routine'->>'hydration')::numeric+(s->'routine'->>'activity')::numeric+(s->'routine'->>'appointment')::numeric+(s->'routine'->>'unknownCategory')::numeric <= (s->'routine'->>'completed')::numeric;
  elsif kind='report_recipients' then
    return coalesce((p->'care_member_id'='null'::jsonb or p->>'care_member_id' ~ '^[A-Za-z0-9_-]{1,128}$') and
      p->>'channel' = 'whatsapp' and length(p->>'normalized_destination') between 5 and 32 and
      p->>'consent_status' in ('enabled','revoked') and p->>'frequency' in ('weekly','monthly','manual') and
      (p->>'consent_status' = 'enabled' or p->'revoked_at' <> 'null'::jsonb), false);
  elsif kind='report_deliveries' then
    return coalesce(p->>'recipient_id' ~ '^[A-Za-z0-9_-]{1,128}$' and p->>'report_period' in ('7-day','30-day','manual') and
      isfinite((p->>'report_start')::timestamptz) and isfinite((p->>'report_end')::timestamptz) and
      (p->>'report_start')::timestamptz < (p->>'report_end')::timestamptz and p->>'report_snapshot_id' ~ '^[A-Za-z0-9_-]{1,128}$' and
      p->>'status' in ('not_configured','queued','sending','sent','delivered','failed','cancelled','share_requested') and
      (p->'provider' = 'null'::jsonb or p->>'provider' in ('whatsapp_business','manual_share')) and
      (p->>'attempt_count')::numeric >= 0 and isfinite((p->>'queued_at')::timestamptz), false);
  end if;
  return false;
exception when others then return false;
end;
$$;

create or replace function public.push_mutations(events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid(); e jsonb; saved public.sync_records; prior public.sync_mutations; incoming jsonb; recipient jsonb;
  result jsonb := '[]'::jsonb; next_version bigint; blocked boolean := false;
begin
  if account is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events) not between 1 and 25 or octet_length(events::text) > 450000 then
    raise exception 'Invalid batch' using errcode = '22023';
  end if;
  insert into public.sync_accounts(owner_id) values(account) on conflict do nothing;
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
      if e->>'entity_type'='report_preferences' and e->'payload'->'recipient_id'<>'null'::jsonb and not exists(
        select 1 from public.sync_records where owner_id=account and patient_id=e->>'patient_id' and entity_type='care_circle_members'
          and entity_id=e->'payload'->>'recipient_id') then raise exception 'Missing recipient' using errcode='23503'; end if;
      if e->>'entity_type'='report_recipients' and e->'payload'->'care_member_id'<>'null'::jsonb and not exists(
        select 1 from public.sync_records where owner_id=account and patient_id=e->>'patient_id' and entity_type='care_circle_members'
          and entity_id=e->'payload'->>'care_member_id') then raise exception 'Missing care member' using errcode='23503'; end if;
      if e->>'entity_type'='report_deliveries' and not exists(
        select 1 from public.sync_records where owner_id=account and patient_id=e->>'patient_id' and entity_type='report_recipients'
          and entity_id=e->'payload'->>'recipient_id') then raise exception 'Missing recipient' using errcode='23503'; end if;
      if e->>'entity_type'='report_deliveries' and not exists(
        select 1 from public.sync_records where owner_id=account and patient_id=e->>'patient_id' and entity_type='activity_reports'
          and entity_id=e->'payload'->>'report_snapshot_id') then raise exception 'Missing report snapshot' using errcode='23503'; end if;
      incoming := e->'payload';
      if e->>'entity_type'='report_preferences' and incoming->>'requested'='1' then
        select s.payload into recipient from public.sync_records s where s.owner_id=account and s.patient_id=e->>'patient_id'
          and s.entity_type='care_circle_members' and s.entity_id=incoming->>'recipient_id';
        if recipient->>'status'<>'local' or recipient->>'email' is null or
          not ((recipient->>'scopes')::jsonb ? 'reports') or
          (incoming->>'consented_at')::timestamptz < (recipient->>'updated_at')::timestamptz then
          incoming := incoming || jsonb_build_object('requested',0,'consented_at',null);
        end if;
      end if;
      select * into saved from public.sync_records where owner_id = account and entity_type = e->>'entity_type' and entity_id = e->>'entity_id';
      if found and saved.patient_id <> e->>'patient_id' then raise exception 'Patient identity conflict' using errcode = '23505'; end if;
      if saved.version is not null and saved.entity_type='activity_reports' and
        saved.payload-array['delivery_state','updated_at'] <> (e->'payload')-array['delivery_state','updated_at'] then
        raise exception 'Report snapshot is immutable' using errcode='23505'; end if;
      if saved.version is not null and (saved.deleted or
        (saved.entity_type = 'care_circle_members' and saved.payload->>'status' = 'revoked') or
        (saved.entity_type = 'reminders' and saved.payload->>'deleted_at' is not null) or e->>'entity_type' in ('cognitive_sessions','reminder_events')) then
        next_version := saved.version;
      else
        update public.sync_accounts set version = version + 1, updated_at = now() where owner_id = account returning version into next_version;
        insert into public.sync_records(owner_id,patient_id,entity_type,entity_id,payload,deleted,version)
          values(account,e->>'patient_id',e->>'entity_type',e->>'entity_id',incoming,e->>'operation' = 'delete',next_version)
          on conflict(owner_id,entity_type,entity_id) do update set payload = excluded.payload, deleted = excluded.deleted,
            version = excluded.version, updated_at = now();
        if e->>'entity_type'='care_circle_members' and (incoming->>'status'='revoked' or
          (saved.version is not null and (saved.payload->'scopes' is distinct from incoming->'scopes' or saved.payload->'email' is distinct from incoming->'email'))) and
          exists(select 1 from public.sync_records s where s.owner_id=account and s.patient_id=e->>'patient_id'
            and s.entity_type='report_preferences' and s.payload->>'recipient_id'=e->>'entity_id' and s.payload->>'requested'='1') then
          update public.sync_accounts set version=version+1,updated_at=now() where owner_id=account returning version into next_version;
          update public.sync_records s set payload=s.payload || jsonb_build_object('requested',0,'consented_at',null,'updated_at',incoming->>'updated_at'),
            version=next_version,updated_at=now() where s.owner_id=account and s.patient_id=e->>'patient_id'
              and s.entity_type='report_preferences' and s.payload->>'recipient_id'=e->>'entity_id';
        end if;
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

create or replace function public.pull_changes(after_version bigint default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare account uuid := auth.uid(); rows jsonb; parents jsonb; cursor_value bigint;
begin
  if account is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if after_version is null or after_version < 0 or after_version > 9007199254740991 then raise exception 'Invalid cursor' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.version),'[]'::jsonb),coalesce(max(r.version),after_version) into rows,cursor_value
    from (select owner_id,patient_id,entity_type,entity_id,payload,deleted,version from public.sync_records
      where owner_id = account and version > after_version order by version limit 25) r;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.version),'[]'::jsonb) into parents
    from (select owner_id,patient_id,entity_type,entity_id,payload,deleted,version from public.sync_records s
      where owner_id = account and (
        (entity_type in ('patient_profiles','patient_settings') and patient_id in (select value->>'patient_id' from jsonb_array_elements(rows))) or
        (entity_type = 'reminders' and exists(select 1 from jsonb_array_elements(rows) child where child->>'entity_type' = 'reminder_events'
          and child->>'patient_id' = s.patient_id and child->'payload'->>'reminder_id' = s.entity_id)) or
        (entity_type = 'care_circle_members' and exists(select 1 from jsonb_array_elements(rows) child where child->>'entity_type' = 'report_preferences'
          and child->>'patient_id' = s.patient_id and child->'payload'->>'recipient_id' = s.entity_id)) or
        (entity_type = 'care_circle_members' and exists(select 1 from jsonb_array_elements(rows) child where child->>'entity_type' = 'report_recipients'
          and child->>'patient_id' = s.patient_id and child->'payload'->>'care_member_id' = s.entity_id)) or
        (entity_type = 'report_recipients' and exists(select 1 from jsonb_array_elements(rows) child where child->>'entity_type' = 'report_deliveries'
          and child->>'patient_id' = s.patient_id and child->'payload'->>'recipient_id' = s.entity_id)) or
        (entity_type = 'activity_reports' and exists(select 1 from jsonb_array_elements(rows) child where child->>'entity_type' = 'report_deliveries'
          and child->>'patient_id' = s.patient_id and child->'payload'->>'report_snapshot_id' = s.entity_id)))) r;
  return jsonb_build_object('records',rows,'parents',parents,'cursor',cursor_value,'has_more',
    exists(select 1 from public.sync_records where owner_id = account and version > cursor_value));
end;
$$;

create or replace function public.valid_sync_record(kind text, patient text, entity text, p jsonb, operation text)
returns boolean language plpgsql stable set search_path = '' as $$
declare fields text[]; k text; v jsonb; completed integer;
begin
  if kind in ('care_circle_members','activity_reports','report_preferences','report_recipients','report_deliveries') then return public.valid_care_record(kind,patient,entity,p,operation); end if;
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
  if p ? 'game_type' and coalesce(p->>'game_type','') not in ('memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall','remember_lights','number_path','sudoku_lite','chess_puzzle','word_match') then return false; end if;
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
    completed := case when p->>'game_type' in ('routine_recall','sequence_memory','remember_lights','number_path','sudoku_lite','chess_puzzle','word_match') then (p->>'steps_completed')::int else (p->>'challenges_completed')::int end;
    return coalesce(completed > 0 and (p->>'correct_selections')::int = completed and
      (p->>'repeated_errors')::int between 0 and (p->>'attempts')::int - completed and
      abs((p->>'accuracy')::numeric - completed::numeric / (p->>'attempts')::int) < 0.000000001 and
      abs((p->>'difficulty')::int - (p->>'recommended_difficulty')::int) <= 1 and
      p->'total_pairs' = 'null'::jsonb and p->'matches' = 'null'::jsonb and p->'repeated_mistakes' = 'null'::jsonb and
      ((p->>'game_type' = 'routine_recall' and completed between 2 and 5 and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'sequence_memory' and completed between 2 and 6 and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'remember_lights' and completed = 2 * ((p->>'difficulty')::int + 1) and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'number_path' and completed = case (p->>'difficulty')::int when 1 then 5 when 2 then 7 else 10 end and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'sudoku_lite' and completed = case (p->>'difficulty')::int when 1 then 3 when 2 then 6 when 3 then 8 when 4 then 12 else 16 end and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'chess_puzzle' and completed = case (p->>'difficulty')::int when 1 then 6 when 2 then 4 when 3 then 4 else 3 end and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'word_match' and completed = case (p->>'difficulty')::int when 1 then 3 when 2 then 4 when 3 then 4 when 4 then 5 else 6 end and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' in ('pattern_recognition','familiar_object','picture_recall') and p->'steps_completed' = 'null'::jsonb)),false);
  end if;
  return false;
exception when others then return false;
end;
$$;

commit;
