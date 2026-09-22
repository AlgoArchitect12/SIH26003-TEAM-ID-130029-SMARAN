-- Forward migration. Deploy separately after database review; no mobile secrets.
begin;
alter table public.sync_records drop constraint sync_records_entity_type_check;
alter table public.sync_records add constraint sync_records_entity_type_check check (entity_type in (
  'patient_profiles','patient_settings','reminders','reminder_events','cognitive_sessions','adaptive_model_state','personal_memories',
  'care_circle_members','activity_reports','report_preferences','report_recipients','report_deliveries','patient_locations'));

alter function public.valid_sync_record(text,text,text,jsonb,text) rename to valid_sync_record_before_location;
create function public.valid_sync_record(kind text, patient text, entity text, p jsonb, operation text)
returns boolean language plpgsql stable set search_path='' as $$
begin
  if kind is distinct from 'patient_locations' then
    return public.valid_sync_record_before_location(kind,patient,entity,p,operation);
  end if;
  return coalesce(operation='upsert' and patient ~ '^[A-Za-z0-9_-]{1,128}$' and entity ~ '^[A-Za-z0-9_-]{1,128}$' and
    jsonb_typeof(p)='object' and p ?& array['id','patient_id','latitude','longitude','accuracy','recorded_at','source'] and
    p-array['id','patient_id','latitude','longitude','accuracy','recorded_at','source']='{}'::jsonb and
    p->>'id'=entity and p->>'patient_id'=patient and
    jsonb_typeof(p->'id')='string' and jsonb_typeof(p->'patient_id')='string' and
    jsonb_typeof(p->'latitude')='number' and (p->>'latitude')::numeric between -90 and 90 and
    jsonb_typeof(p->'longitude')='number' and (p->>'longitude')::numeric between -180 and 180 and
    (p->'accuracy'='null'::jsonb or (jsonb_typeof(p->'accuracy')='number' and (p->>'accuracy')::numeric between 0 and 10000000)) and
    jsonb_typeof(p->'recorded_at')='string' and isfinite((p->>'recorded_at')::timestamptz) and
    jsonb_typeof(p->'source')='string' and p->>'source' in ('background','last_known'),false);
exception when others then return false;
end;
$$;
revoke all on function public.valid_sync_record(text,text,text,jsonb,text) from public,anon;
grant execute on function public.valid_sync_record(text,text,text,jsonb,text) to authenticated;

-- Existing owner RLS and push/pull ownership checks also apply to location records.
-- An immutable location ID cannot be overwritten by a later client mutation.
create function public.keep_location_immutable() returns trigger language plpgsql set search_path='' as $$
begin
  if old.entity_type='patient_locations' and new.payload is distinct from old.payload then
    raise exception 'Location records are immutable' using errcode='23505';
  end if;
  return new;
end;
$$;
create trigger location_immutable before update on public.sync_records for each row execute function public.keep_location_immutable();

-- Roles are assigned only by a server operator in auth.users.raw_app_meta_data.
-- Do not trust user_metadata or a client-supplied role. Even admins remain owner-scoped.
create function public.admin_patients() returns jsonb language plpgsql security definer set search_path='' as $$
declare account uuid := auth.uid();
begin
  if account is null or not exists(select 1 from auth.users where id=account and raw_app_meta_data->>'role'='admin') then
    raise exception 'Admin authorization required' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('patient',p.payload,
    'location',(select l.payload from public.sync_records l where l.owner_id=account and l.patient_id=p.patient_id and l.entity_type='patient_locations' and not l.deleted order by l.payload->>'recorded_at' desc limit 1),
    'reports',coalesce((select jsonb_agg(r.payload) from (select payload from public.sync_records where owner_id=account and patient_id=p.patient_id and entity_type='activity_reports' and not deleted order by payload->>'generated_at' desc limit 20) r),'[]'::jsonb)))
    from public.sync_records p where p.owner_id=account and p.entity_type='patient_profiles' and not p.deleted),'[]'::jsonb);
end;
$$;
revoke all on function public.admin_patients() from public,anon;
grant execute on function public.admin_patients() to authenticated;
commit;
