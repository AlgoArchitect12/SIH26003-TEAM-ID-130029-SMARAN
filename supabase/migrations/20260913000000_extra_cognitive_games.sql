-- Extend only the deployed sync validator; preserve its signature, permissions and all existing games.
begin;

create or replace function public.valid_sync_record(kind text, patient text, entity text, p jsonb, operation text)
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
  if p ? 'game_type' and coalesce(p->>'game_type','') not in ('memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall','remember_lights','number_path') then return false; end if;
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
    completed := case when p->>'game_type' in ('routine_recall','sequence_memory','remember_lights','number_path') then (p->>'steps_completed')::int else (p->>'challenges_completed')::int end;
    return coalesce(completed > 0 and (p->>'correct_selections')::int = completed and
      (p->>'repeated_errors')::int between 0 and (p->>'attempts')::int - completed and
      abs((p->>'accuracy')::numeric - completed::numeric / (p->>'attempts')::int) < 0.000000001 and
      abs((p->>'difficulty')::int - (p->>'recommended_difficulty')::int) <= 1 and
      p->'total_pairs' = 'null'::jsonb and p->'matches' = 'null'::jsonb and p->'repeated_mistakes' = 'null'::jsonb and
      ((p->>'game_type' = 'routine_recall' and completed between 2 and 5 and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'sequence_memory' and completed between 2 and 6 and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'remember_lights' and completed = 2 * ((p->>'difficulty')::int + 1) and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' = 'number_path' and completed = case (p->>'difficulty')::int when 1 then 5 when 2 then 7 else 10 end and p->'challenges_completed' = 'null'::jsonb) or
       (p->>'game_type' in ('pattern_recognition','familiar_object','picture_recall') and p->'steps_completed' = 'null'::jsonb)),false);
  end if;
  return false;
exception when others then return false;
end;
$$;

commit;
