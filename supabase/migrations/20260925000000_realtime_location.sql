-- Location has separate consent and retention; never enters AI or general backup.
begin;
create or replace function public.valid_pairing_scopes(scopes text[])
returns boolean language sql immutable set search_path='' as $$
  select scopes is not null and coalesce(array_length(scopes,1),0) between 1 and 6
    and array_position(scopes,null) is null and
    (select bool_and(s=any(array['daily_activity','reminders','cognitive_activity','reports','memories','location'])) from unnest(scopes) s);
$$;
create table public.location_sharing (
  owner_id uuid not null, patient_id text not null, consent boolean not null default false,
  enabled boolean not null default false, epoch uuid not null default gen_random_uuid(),
  zone jsonb, inside boolean, last_event jsonb, device_status text not null default 'unavailable',
  revision bigint not null default 0,
  primary key(owner_id,patient_id),
  foreign key(owner_id,patient_id) references public.sync_patients(owner_id,patient_id),
  check(not enabled or consent)
);
create table public.location_points (
  owner_id uuid not null, patient_id text not null, id text not null,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  accuracy double precision check(accuracy between 0 and 10000000), recorded_at timestamptz not null,
  primary key(owner_id,patient_id,id),
  foreign key(owner_id,patient_id) references public.location_sharing(owner_id,patient_id)
);
create index location_recent on public.location_points(owner_id,patient_id,recorded_at desc);
-- Only invalidations travel over Realtime. No coordinates, names or contact details.
create table public.location_signals (
  recipient uuid not null, owner_id uuid not null, patient_id text not null, revision bigint not null default 0,
  primary key(recipient,owner_id,patient_id),
  foreign key(owner_id,patient_id) references public.sync_patients(owner_id,patient_id)
);
alter table public.location_sharing enable row level security;
alter table public.location_points enable row level security;
alter table public.location_signals enable row level security;
revoke all on public.location_sharing,public.location_points,public.location_signals from public,anon,authenticated;

create function public.location_allowed(o uuid,p text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (auth.uid()=o or exists(select 1 from public.patient_memberships
    where owner_id=o and patient_id=p and member_id=auth.uid() and revoked_at is null and 'location'=any(scopes)));
$$;
create policy location_owner_or_member on public.location_sharing for select to authenticated
  using(public.location_allowed(owner_id,patient_id));
create policy location_points_reader on public.location_points for select to authenticated using(
  public.location_allowed(owner_id,patient_id) and recorded_at > now()-interval '24 hours' and
  exists(select 1 from public.location_sharing s where s.owner_id=location_points.owner_id and s.patient_id=location_points.patient_id and s.consent));
create policy location_signal_recipient on public.location_signals for select to authenticated using(recipient=auth.uid());
grant select on public.location_sharing,public.location_points,public.location_signals to authenticated;

create function public.signal_location(o uuid,p text) returns void
language plpgsql security definer set search_path='' as $$
begin
  insert into public.location_signals(recipient,owner_id,patient_id,revision)
    select o,o,p,1 union select member_id,o,p,1 from public.patient_memberships
      where owner_id=o and patient_id=p and revoked_at is null and 'location'=any(scopes)
    on conflict(recipient,owner_id,patient_id) do update set revision=location_signals.revision+1;
end;
$$;
create function public.location_membership_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Include the old recipient even when scope is removed, so cached maps clear.
  insert into public.location_signals(recipient,owner_id,patient_id,revision)
    values(new.member_id,new.owner_id,new.patient_id,1)
    on conflict(recipient,owner_id,patient_id) do update set revision=location_signals.revision+1;
  return new;
end;
$$;
create trigger location_membership_signal after update on public.patient_memberships
  for each row execute function public.location_membership_changed();

create function public.location_owner(p text) returns uuid
language sql stable security definer set search_path='' as $$
  select owner_id from public.sync_patients where patient_id=p and owner_id=auth.uid()
  union all select owner_id from public.patient_memberships where patient_id=p and member_id=auth.uid()
    and revoked_at is null and 'location'=any(scopes) limit 1;
$$;
create function public.location_snapshot(p_patient text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid:=public.location_owner(p_patient); s public.location_sharing%rowtype; h jsonb;
begin
  if o is null or not public.location_allowed(o,p_patient) then return jsonb_build_object('ok',false,'error','forbidden'); end if;
  select * into s from public.location_sharing where owner_id=o and patient_id=p_patient;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.recorded_at desc),'[]'::jsonb) into h from
    (select id,latitude,longitude,accuracy,recorded_at from public.location_points
     where owner_id=o and patient_id=p_patient and s.consent and recorded_at>now()-interval '24 hours'
     order by recorded_at desc limit 288) q;
  return jsonb_build_object('ok',true,'owner',o=auth.uid(),'consent',coalesce(s.consent,false),
    'display_name',(select payload->>'preferred_name' from public.sync_records where owner_id=o and patient_id=p_patient and entity_type='patient_profiles' and not deleted limit 1),
    'enabled',coalesce(s.enabled,false),'epoch',coalesce(s.epoch::text,''),'zone',s.zone,'history',h,'point',h->0,
    'event',case when (s.last_event->>'at')::timestamptz>now()-interval '24 hours' then s.last_event else null end,
    'device_status',coalesce(s.device_status,'unavailable'),'revision',coalesce(s.revision,0));
end;
$$;
create function public.location_control(p_patient text,p_action text,p_zone jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid:=public.location_owner(p_patient); s public.location_sharing%rowtype;
begin
  if o is null or not public.location_allowed(o,p_patient) then return jsonb_build_object('ok',false,'error','forbidden'); end if;
  if p_action is null or p_action not in('consent','resume','pause','revoke','zone') then raise exception 'Invalid action'; end if;
  if p_action='consent' and o<>auth.uid() then return jsonb_build_object('ok',false,'error','forbidden'); end if;
  insert into public.location_sharing(owner_id,patient_id) values(o,p_patient) on conflict do nothing;
  select * into s from public.location_sharing where owner_id=o and patient_id=p_patient for update;
  if p_action in('resume','zone') and not s.consent then return jsonb_build_object('ok',false,'error','consent'); end if;
  if p_action='zone' and p_zone is not null and not coalesce(
    jsonb_typeof(p_zone)='object' and p_zone-array['latitude','longitude','radius']='{}'::jsonb and
    jsonb_typeof(p_zone->'latitude')='number' and (p_zone->>'latitude')::numeric between -90 and 90 and
    jsonb_typeof(p_zone->'longitude')='number' and (p_zone->>'longitude')::numeric between -180 and 180 and
    jsonb_typeof(p_zone->'radius')='number' and (p_zone->>'radius')::numeric between 100 and 10000,false)
    then raise exception 'Invalid safe zone'; end if;
  update public.location_sharing set
    consent=case when p_action='consent' then true when p_action='revoke' then false else consent end,
    enabled=case when p_action in('consent','resume') then true when p_action in('pause','revoke') then false else enabled end,
    epoch=case when p_action='zone' then epoch else gen_random_uuid() end,
    zone=case when p_action='zone' then p_zone when p_action='revoke' then null else zone end,
    inside=null,last_event=null,device_status=case when p_action in('pause','revoke') then 'paused' else 'unavailable' end,
    revision=revision+1 where owner_id=o and patient_id=p_patient;
  if p_action='revoke' then delete from public.location_points where owner_id=o and patient_id=p_patient; end if;
  perform public.signal_location(o,p_patient);
  return public.location_snapshot(p_patient);
end;
$$;
create function public.location_publish(p_patient text,p_epoch uuid,p_points jsonb,p_status text default 'active') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid:=auth.uid(); s public.location_sharing%rowtype; p jsonb; stamp timestamptz;
  newest public.location_points%rowtype; distance double precision; next_inside boolean;
begin
  select * into s from public.location_sharing where owner_id=o and patient_id=p_patient for update;
  if o is null or p_epoch is null or s.epoch is null or not s.enabled or not s.consent or s.epoch<>p_epoch then
    return jsonb_build_object('ok',false,'error','forbidden'); end if;
  if p_status is null or p_status not in('active','denied','disabled','unavailable') or
    jsonb_typeof(p_points) is distinct from 'array' or jsonb_array_length(p_points)>25 then raise exception 'Invalid points'; end if;
  for p in select value from jsonb_array_elements(p_points) loop
    if not coalesce(jsonb_typeof(p)='object' and p-array['id','latitude','longitude','accuracy','recorded_at']='{}'::jsonb and
      jsonb_typeof(p->'id')='string' and p->>'id' ~ '^[A-Za-z0-9_-]{1,128}$' and
      jsonb_typeof(p->'latitude')='number' and (p->>'latitude')::numeric between -90 and 90 and
      jsonb_typeof(p->'longitude')='number' and (p->>'longitude')::numeric between -180 and 180 and
      (p->'accuracy'='null'::jsonb or (jsonb_typeof(p->'accuracy')='number' and (p->>'accuracy')::numeric between 0 and 10000000)) and
      jsonb_typeof(p->'recorded_at')='string',false) then raise exception 'Invalid point'; end if;
    stamp:=(p->>'recorded_at')::timestamptz;
    if not isfinite(stamp) or stamp>now()+interval '1 minute' then raise exception 'Invalid time'; end if;
    if stamp>now()-interval '24 hours' then
      insert into public.location_points(owner_id,patient_id,id,latitude,longitude,accuracy,recorded_at)
        values(o,p_patient,p->>'id',(p->>'latitude')::double precision,(p->>'longitude')::double precision,(p->>'accuracy')::double precision,stamp)
        on conflict do nothing;
    end if;
  end loop;
  delete from public.location_points where owner_id=o and patient_id=p_patient and (recorded_at<=now()-interval '24 hours' or id in
    (select id from public.location_points where owner_id=o and patient_id=p_patient order by recorded_at desc offset 288));
  select * into newest from public.location_points where owner_id=o and patient_id=p_patient order by recorded_at desc limit 1;
  -- Accuracy-aware boundary hysteresis; no alert on first fix or stale replay.
  if s.zone is not null and newest.recorded_at>now()-interval '5 minutes' and newest.accuracy is not null then
    distance:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(newest.latitude-(s.zone->>'latitude')::float)/2),2)+
      cos(radians(newest.latitude))*cos(radians((s.zone->>'latitude')::float))*power(sin(radians(newest.longitude-(s.zone->>'longitude')::float)/2),2))));
    next_inside:=case when distance+newest.accuracy<(s.zone->>'radius')::float then true
      when distance-newest.accuracy>(s.zone->>'radius')::float then false else s.inside end;
    if next_inside is not null and s.inside is not null and next_inside<>s.inside and
      (s.last_event is null or newest.recorded_at>(s.last_event->>'at')::timestamptz+interval '5 minutes') then
      s.last_event:=jsonb_build_object('kind',case when next_inside then 'entry' else 'exit' end,'at',newest.recorded_at);
    end if;
    s.inside:=next_inside;
  end if;
  update public.location_sharing set inside=s.inside,last_event=s.last_event,device_status=p_status,revision=revision+1
    where owner_id=o and patient_id=p_patient;
  perform public.signal_location(o,p_patient);
  return jsonb_build_object('ok',true);
end;
$$;
create function public.prune_location_history() returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.location_points where recorded_at<=now()-interval '24 hours';
  update public.location_sharing set last_event=null where (last_event->>'at')::timestamptz<=now()-interval '24 hours';
end;
$$;
revoke all on function public.location_allowed(uuid,text),public.location_owner(text),public.signal_location(uuid,text),
  public.location_membership_changed(),public.location_snapshot(text),public.location_control(text,text,jsonb),
  public.location_publish(text,uuid,jsonb,text),public.prune_location_history() from public,anon,authenticated;
grant execute on function public.location_allowed(uuid,text),public.location_snapshot(text),public.location_control(text,text,jsonb),
  public.location_publish(text,uuid,jsonb,text) to authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.location_signals;
  end if;
  -- Supabase Cron must be enabled by the operator; local PostgreSQL can test without it.
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('smaran-location-retention','*/15 * * * *','select public.prune_location_history()');
  end if;
end $$;
commit;
