-- Disposable local PostgreSQL/Supabase only, after all three migrations. All fixture data rolls back.
begin;
create function pg_temp.care_push(patient text, kind text, identity text, p jsonb, expected text default 'applied')
returns void language plpgsql as $$
declare result jsonb;
begin
  result := public.push_mutations(jsonb_build_array(jsonb_build_object('mutation_id',replace(gen_random_uuid()::text,'-',''),
    'patient_id',patient,'entity_type',kind,'entity_id',identity,'operation','upsert','payload',p)));
  if result->0->>'status' is distinct from expected then raise exception 'Unexpected % result: %',kind,result; end if;
end;
$$;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); stamp text := '2026-09-15T10:00:00.000Z';
  profile jsonb; member jsonb; preference jsonb; report jsonb; facts jsonb; game_rows jsonb; result jsonb; bad jsonb;
  before_version bigint;
begin
  insert into auth.users(id) values(a),(b);
  profile := jsonb_build_object('id','care-one','preferred_name','Synthetic','age_bracket',null,'emergency_name',null,
    'emergency_phone',null,'created_at',stamp,'updated_at',stamp);
  member := jsonb_build_object('id','care-member','patient_id','care-one','display_name','Synthetic worker','relationship','daughter',
    'access_role','healthcare_worker','email','synthetic@example.invalid','phone',null,'status','local','scopes','["reports","cognitive_activity"]',
    'created_at',stamp,'updated_at',stamp);
  preference := jsonb_build_object('patient_id','care-one','recipient_id','care-member','frequency','weekly','requested',1,
    'consented_at',stamp,'last_requested_at',stamp,'delivery_status','not_configured','updated_at',stamp);
  select jsonb_agg(jsonb_build_object('gameType',g,'sessions',1,'attempts',4,'correct',3,'hints',1,'repeatedErrors',0) order by ord)
    into game_rows from unnest(array['memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall','remember_lights','number_path']) with ordinality as games(g,ord);
  facts := jsonb_build_object('patientName','Synthetic','days',7,'timezone','Asia/Calcutta','games',game_rows,
    'routine',jsonb_build_object('completed',2,'hydration',1,'activity',0,'appointment',0,'unknownCategory',1,'scheduledToday',1,'completedToday',1),
    'memories',jsonb_build_object('stored',0,'added',0));
  report := jsonb_build_object('id','care-report','patient_id','care-one','period_start','2026-09-09T00:00:00.000Z',
    'period_end','2026-09-16T00:00:00.000Z','generated_at',stamp,'report_version',1,'snapshot',facts::text,'delivery_state','generated','updated_at',stamp);
  if not public.valid_sync_record('care_circle_members','care-one','care-member',member,'upsert') or
    not public.valid_sync_record('report_preferences','care-one','care-one',preference,'upsert') or
    not public.valid_sync_record('activity_reports','care-one','care-report',report,'upsert') then raise exception 'Valid care payload rejected'; end if;
  foreach bad in array array[member || '{"status":"linked"}',member || '{"scopes":"[\"reports\",\"reports\"]"}',
    member || '{"scopes":"[\"photos\"]"}',member || '{"access_role":"admin"}',member || '{"email":"bad"}',
    member || '{"status":"revoked"}',member || '{"secret":"bad"}'] loop
    if public.valid_sync_record('care_circle_members','care-one','care-member',bad,'upsert') then raise exception 'Invalid member accepted'; end if;
  end loop;
  foreach bad in array array[preference || '{"consented_at":null}',preference || '{"requested":2}',preference || '{"delivery_status":"sent"}'] loop
    if public.valid_sync_record('report_preferences','care-one','care-one',bad,'upsert') then raise exception 'Invalid preference accepted'; end if;
  end loop;
  foreach bad in array array[report || '{"delivery_state":"delivered"}',report || '{"report_version":2}',
    report || jsonb_build_object('snapshot',(facts || '{"days":1}')::text),
    report || jsonb_build_object('snapshot',(facts || '{"timezone":"not/a-zone"}')::text),
    report || jsonb_build_object('snapshot',jsonb_set(facts,'{games,0,correct}','5')::text)] loop
    if public.valid_sync_record('activity_reports','care-one','care-report',bad,'upsert') then raise exception 'Invalid report accepted'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub',a::text,true);
  set local role authenticated;
  perform pg_temp.care_push('care-one','patient_profiles','care-one',profile);
  perform pg_temp.care_push('care-one','care_circle_members','care-member',member);
  perform pg_temp.care_push('care-one','report_preferences','care-one',preference);
  perform pg_temp.care_push('care-one','activity_reports','care-report',report);
  perform pg_temp.care_push('care-one','activity_reports','care-report',report || jsonb_build_object('snapshot',(facts || '{"patientName":"Changed"}')::text),'rejected');
  perform pg_temp.care_push('care-one','activity_reports','care-report',report || '{"delivery_state":"share_requested"}');
  -- Same owner, different patient cannot reference the first patient's trusted person.
  perform pg_temp.care_push('care-two','patient_profiles','care-two',profile || '{"id":"care-two"}');
  perform pg_temp.care_push('care-two','report_preferences','care-two',preference || '{"patient_id":"care-two"}','rejected');
  -- A new email invalidates saved consent and advances the cursor for that preference too.
  select version into before_version from public.sync_accounts where owner_id=a;
  member := member || '{"email":"changed@example.invalid","updated_at":"2026-09-15T11:00:00.000Z"}';
  perform pg_temp.care_push('care-one','care_circle_members','care-member',member);
  if (select payload->>'requested' from public.sync_records where owner_id=a and entity_type='report_preferences' and entity_id='care-one') <> '0' then raise exception 'Email edit retained consent'; end if;
  result := public.pull_changes(before_version);
  if jsonb_array_length(result->'records') <> 2 then raise exception 'Consent clearing was not versioned'; end if;
  perform pg_temp.care_push('care-one','report_preferences','care-one',preference);
  if (select payload->>'requested' from public.sync_records where owner_id=a and entity_type='report_preferences' and entity_id='care-one') <> '0' then raise exception 'Old consent restored'; end if;
  preference := preference || '{"consented_at":"2026-09-15T11:01:00.000Z","updated_at":"2026-09-15T11:01:00.000Z"}';
  perform pg_temp.care_push('care-one','report_preferences','care-one',preference);
  if (select payload->>'requested' from public.sync_records where owner_id=a and entity_type='report_preferences' and entity_id='care-one') <> '1' then raise exception 'Fresh consent lost'; end if;
  perform pg_temp.care_push('care-one','care_circle_members','care-member',member || '{"status":"revoked","scopes":"[]"}');
  perform pg_temp.care_push('care-one','care_circle_members','care-member',member);
  perform pg_temp.care_push('care-one','report_preferences','care-one',preference);
  if (select payload->>'status' from public.sync_records where owner_id=a and entity_type='care_circle_members' and entity_id='care-member') <> 'revoked' or
    (select payload->>'requested' from public.sync_records where owner_id=a and entity_type='report_preferences' and entity_id='care-one') <> '0' then raise exception 'Revoked access restored'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub',b::text,true);
  set local role authenticated;
  if exists(select 1 from public.sync_records) or jsonb_array_length(public.pull_changes(0)->'records')<>0 then raise exception 'Account B read account A'; end if;
  perform pg_temp.care_push('care-one','care_circle_members','care-member',member,'rejected');
  perform pg_temp.care_push('care-one','patient_profiles','care-one',profile);
  perform pg_temp.care_push('care-one','report_preferences','care-one',preference,'rejected');
  if has_table_privilege('authenticated','public.sync_records','INSERT') or has_table_privilege('authenticated','public.sync_records','UPDATE') or
    has_function_privilege('authenticated','public.valid_care_record(text,text,text,jsonb,text)','EXECUTE') then raise exception 'Grants broadened'; end if;
  reset role;
end;
$$;
rollback;
