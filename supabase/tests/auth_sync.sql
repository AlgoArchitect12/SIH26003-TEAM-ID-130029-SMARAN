-- Run only in a disposable local Supabase database after the migration, as its database owner.
-- This exercises actual PostgreSQL/RLS; the entire fixture, including temporary grants, rolls back.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  event jsonb; result jsonb; table_name text; affected bigint; before_version bigint;
begin
  insert into auth.users(id) values(a),(b);
  event := jsonb_build_object('mutation_id',repeat('a',32),'patient_id','synthetic-one','entity_type','patient_profiles',
    'entity_id','synthetic-one','operation','upsert','payload',jsonb_build_object('id','synthetic-one','preferred_name','Synthetic',
    'age_bracket',null,'emergency_name',null,'emergency_phone',null,'created_at','2026-09-12T00:00:00Z','updated_at','2026-09-12T00:00:00Z'));
  perform set_config('request.jwt.claim.sub',b::text,true);
  set local role authenticated;
  result := public.push_mutations(jsonb_build_array(event));
  if result->0->>'status' <> 'applied' then raise exception 'B fixture push failed: %',result; end if;
  reset role;
  perform set_config('request.jwt.claim.sub',a::text,true);
  set local role authenticated;
  result := public.push_mutations(jsonb_build_array(event));
  if result->0->>'status' <> 'applied' then raise exception 'A push failed: %',result; end if;
  select version into before_version from public.sync_accounts where owner_id = a;
  result := public.push_mutations(jsonb_build_array(event));
  if result->0->>'status' <> 'duplicate' then raise exception 'Duplicate mutation failed'; end if;
  if (select version from public.sync_accounts where owner_id = a) <> before_version then raise exception 'Duplicate advanced version'; end if;
  result := public.push_mutations(jsonb_build_array(jsonb_set(event,'{payload,preferred_name}','"Changed replay"')));
  if result->0->>'error' <> 'conflict' then raise exception 'Reused mutation identity accepted'; end if;
  result := public.pull_changes(0);
  if jsonb_array_length(result->'records') <> 1 or result->'records'->0->>'owner_id' <> a::text then raise exception 'Pull leaked B'; end if;
  if jsonb_array_length(public.pull_changes(before_version)->'records') <> 0 then raise exception 'Incremental cursor failed'; end if;
  if has_table_privilege('authenticated','public.sync_records','INSERT') then raise exception 'Direct writes are not revoked'; end if;
  reset role;
  -- Temporarily grant DML to isolate RLS from the stricter production RPC-only grants.
  grant insert,update,delete on public.sync_accounts,public.sync_patients,public.sync_records,public.sync_mutations to authenticated;
  set local role authenticated;
  foreach table_name in array array['sync_accounts','sync_patients','sync_records','sync_mutations'] loop
    execute format('select count(*) from public.%I where owner_id = $1',table_name) into affected using b;
    if affected <> 0 then raise exception 'SELECT leaked account B: %',table_name; end if;
    execute format('update public.%I set owner_id = owner_id where owner_id = $1',table_name) using b;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'UPDATE reached B: %',table_name; end if;
    execute format('delete from public.%I where owner_id = $1',table_name) using b;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'DELETE reached B: %',table_name; end if;
    begin
      case table_name
        when 'sync_accounts' then insert into public.sync_accounts(owner_id) values(b);
        when 'sync_patients' then insert into public.sync_patients(owner_id,patient_id) values(b,'forbidden-patient');
        when 'sync_records' then insert into public.sync_records(owner_id,patient_id,entity_type,entity_id,payload,version)
          values(b,'synthetic-one','patient_profiles','forbidden-record','{}',2);
        when 'sync_mutations' then insert into public.sync_mutations(owner_id,mutation_id,request,version) values(b,repeat('b',32),'{}',1);
      end case;
      raise exception 'INSERT as B succeeded: %',table_name;
    exception when insufficient_privilege then null;
    end;
  end loop;
  reset role;
  set local role anon;
  begin
    perform public.pull_changes(0);
    raise exception 'Anonymous RPC access succeeded';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;
rollback;
