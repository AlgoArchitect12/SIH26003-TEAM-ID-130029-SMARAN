-- Additive server-only delivery ledger. Apply after review; no provider secrets in SQL.
begin;
create table public.report_send_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null, patient_id text not null, delivery_id text not null,
  recipient_id text not null, snapshot_id text not null,
  period_start timestamptz not null, period_end timestamptz not null,
  state text not null check(state in ('sending','sent','delivered','failed','retry')),
  attempt integer not null default 1 check(attempt between 0 and 3),
  claim uuid not null unique default gen_random_uuid(),
  provider_message_id text unique, last_error text,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(owner_id,patient_id) references public.sync_patients(owner_id,patient_id),
  unique(owner_id,delivery_id), unique(owner_id,patient_id,recipient_id,period_start,period_end),
  check(period_end > period_start),
  check(last_error is null or last_error in ('rate_limited','rejected','unknown','receipt_failed')),
  check(provider_message_id is null or length(provider_message_id) between 1 and 256)
);
alter table public.report_send_jobs enable row level security;
revoke all on public.report_send_jobs from public,anon,authenticated;

-- Receipt fields are server-owned even when an old/offline client replays its queued intent.
create function public.guard_report_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
declare job public.report_send_jobs; fields text[] := array['status','provider','provider_message_id','attempt_count','last_error','sent_at','delivered_at','failed_at','updated_at'];
begin
  if new.entity_type <> 'report_deliveries' then return new; end if;
  if tg_op='UPDATE' and old.payload-fields <> new.payload-fields then
    raise exception 'Delivery intent is immutable' using errcode='23505';
  end if;
  select * into job from public.report_send_jobs where owner_id=new.owner_id and delivery_id=new.entity_id;
  if job.id is null and tg_op='UPDATE' and old.payload->>'status'<>'queued' then
    new.payload := (new.payload-fields) || (old.payload-(select array_agg(k) from jsonb_object_keys(old.payload) k where not(k=any(fields))));
    return new;
  end if;
  new.payload := new.payload || jsonb_build_object(
    'status',case when job.id is null then 'queued' when job.state='retry' then 'queued' else job.state end,
    'provider',case when job.id is null then null else 'whatsapp_business' end,
    'provider_message_id',job.provider_message_id,'attempt_count',coalesce(job.attempt,0),'last_error',job.last_error,
    'sent_at',case when job.state in ('sent','delivered') then job.updated_at else null end,
    'delivered_at',case when job.state='delivered' then job.updated_at else null end,
    'failed_at',case when job.state='failed' then job.updated_at else null end);
  return new;
end;
$$;
create trigger report_delivery_receipts before insert or update on public.sync_records
for each row execute function public.guard_report_delivery();
revoke all on function public.guard_report_delivery() from public,anon,authenticated;

create function public.report_delivery_project(p_job uuid) returns void
language plpgsql security definer set search_path='' as $$
declare job public.report_send_jobs; next_version bigint;
begin
  select * into job from public.report_send_jobs where id=p_job;
  update public.sync_accounts set version=version+1,updated_at=now() where owner_id=job.owner_id returning version into next_version;
  update public.sync_records set payload=payload || jsonb_build_object('updated_at',job.updated_at),version=next_version,updated_at=now()
    where owner_id=job.owner_id and patient_id=job.patient_id and entity_type='report_deliveries' and entity_id=job.delivery_id;
end;
$$;
revoke all on function public.report_delivery_project(uuid) from public,anon,authenticated;

create function public.report_delivery_claim(p_owner uuid,p_patient text,p_delivery text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d jsonb; r jsonb; m jsonb; s jsonb; job public.report_send_jobs; scopes jsonb; authorized boolean:=false;
begin
  -- Same lock as push_mutations: authorization is checked against committed consent.
  perform 1 from public.sync_accounts where owner_id=p_owner for update;
  select payload into d from public.sync_records where owner_id=p_owner and patient_id=p_patient
    and entity_type='report_deliveries' and entity_id=p_delivery and not deleted;
  if d is null or not public.valid_care_record('report_deliveries',p_patient,p_delivery,d,'upsert') then
    return jsonb_build_object('ok',false,'error','forbidden');
  end if;
  if (d->>'status'<>'queued' or d->>'provider_message_id' is not null or (d->>'attempt_count')::numeric<>0) and
    not exists(select 1 from public.report_send_jobs where owner_id=p_owner and delivery_id=p_delivery) then
    return jsonb_build_object('ok',false,'error','already_claimed');
  end if;
  select payload into r from public.sync_records where owner_id=p_owner and patient_id=p_patient
    and entity_type='report_recipients' and entity_id=d->>'recipient_id' and not deleted;
  select payload into s from public.sync_records where owner_id=p_owner and patient_id=p_patient
    and entity_type='activity_reports' and entity_id=d->>'report_snapshot_id' and not deleted;
  select payload into m from public.sync_records where owner_id=p_owner and patient_id=p_patient
    and entity_type='care_circle_members' and entity_id=r->>'care_member_id' and not deleted;
  if r is not null and s is not null and m is not null and
    public.valid_care_record('report_recipients',p_patient,r->>'id',r,'upsert') and
    public.valid_care_record('activity_reports',p_patient,s->>'id',s,'upsert') and
    public.valid_care_record('care_circle_members',p_patient,m->>'id',m,'upsert') then
    scopes := (m->>'scopes')::jsonb;
    authorized := not (r->>'consent_status'<>'enabled' or r->>'revoked_at' is not null or m->>'status'<>'local' or not(scopes ? 'reports') or
    r->>'normalized_destination' !~ '^\+[1-9][0-9]{4,14}$' or m->>'phone' is distinct from r->>'normalized_destination' or
    (m->>'updated_at')::timestamptz > (r->>'updated_at')::timestamptz or
    (r->>'updated_at')::timestamptz > (d->>'queued_at')::timestamptz or
    d->>'report_start' is distinct from s->>'period_start' or d->>'report_end' is distinct from s->>'period_end' or
    (d->>'report_period'<>'manual' and d->>'report_period' <> ((s->>'snapshot')::jsonb->>'days')||'-day'));
  end if;
  if authorized is not true then
    -- A revoked/changed/orphaned intent is terminal, so it cannot starve later cron jobs.
    insert into public.report_send_jobs(owner_id,patient_id,delivery_id,recipient_id,snapshot_id,period_start,period_end,state,attempt,last_error)
      values(p_owner,p_patient,p_delivery,d->>'recipient_id',d->>'report_snapshot_id',(d->>'report_start')::timestamptz,(d->>'report_end')::timestamptz,'failed',0,'rejected')
      on conflict(owner_id,patient_id,recipient_id,period_start,period_end) do update
        set state='failed',last_error='rejected',updated_at=now() where report_send_jobs.state='retry'
      returning * into job;
    if job.id is not null then perform public.report_delivery_project(job.id); end if;
    return jsonb_build_object('ok',false,'error','forbidden');
  end if;
  select * into job from public.report_send_jobs where owner_id=p_owner and patient_id=p_patient and
    recipient_id=d->>'recipient_id' and period_start=(d->>'report_start')::timestamptz and period_end=(d->>'report_end')::timestamptz for update;
  if found then
    if job.delivery_id<>p_delivery or job.state<>'retry' or job.attempt>=3 or job.available_at>now() then
      return jsonb_build_object('ok',false,'error','already_claimed');
    end if;
    update public.report_send_jobs set state='sending',attempt=attempt+1,claim=gen_random_uuid(),last_error=null,updated_at=now()
      where id=job.id returning * into job;
  else
    -- Historical claimed/sent intents must never become new sends during migration.
    if d->>'status'<>'queued' or d->>'provider_message_id' is not null or (d->>'attempt_count')::numeric<>0 then
      return jsonb_build_object('ok',false,'error','already_claimed');
    end if;
    insert into public.report_send_jobs(owner_id,patient_id,delivery_id,recipient_id,snapshot_id,period_start,period_end,state)
      values(p_owner,p_patient,p_delivery,d->>'recipient_id',d->>'report_snapshot_id',(d->>'report_start')::timestamptz,(d->>'report_end')::timestamptz,'sending') returning * into job;
  end if;
  perform public.report_delivery_project(job.id);
  return jsonb_build_object('ok',true,'claim',job.claim,'destination',r->>'normalized_destination',
    'snapshot',(s->>'snapshot')::jsonb,'scopes',scopes,'start',s->>'period_start','end',s->>'period_end');
end;
$$;

create function public.report_delivery_finish(p_claim uuid,p_result text,p_message text default null) returns void
language plpgsql security definer set search_path='' as $$
declare job public.report_send_jobs; account uuid;
begin
  if p_result not in ('accepted','rate_limited','rejected','unknown','sent','delivered','read','failed') or
    (p_message is not null and length(p_message) not between 1 and 256) or
    (p_result in ('accepted','sent','delivered','read','failed') and p_message is null) then raise exception 'Invalid receipt'; end if;
  select owner_id into account from public.report_send_jobs where claim=p_claim;
  perform 1 from public.sync_accounts where owner_id=account for update;
  select * into job from public.report_send_jobs where claim=p_claim for update;
  if not found or (job.provider_message_id is not null and job.provider_message_id is distinct from p_message) or job.state='delivered' then return; end if;
  if p_result in ('rate_limited','rejected','unknown') and (job.state<>'sending' or job.provider_message_id is not null) then return; end if;
  if p_result in ('accepted','sent') and job.state in ('sent','failed') then return; end if;
  if p_result='failed' and job.state='failed' and job.provider_message_id=p_message then return; end if;
  update public.report_send_jobs set
    state=case when p_result in ('delivered','read') then 'delivered' when p_result in ('accepted','sent') then 'sent'
      when p_result='unknown' then 'sending' when p_result='rate_limited' and attempt<3 then 'retry' else 'failed' end,
    provider_message_id=coalesce(p_message,provider_message_id),
    last_error=case when p_result in ('rate_limited','rejected','unknown') then p_result when p_result='failed' then 'receipt_failed' else null end,
    available_at=now()+make_interval(secs=>60*(2^attempt)::integer),updated_at=now()
    where id=job.id;
  perform public.report_delivery_project(job.id);
end;
$$;

-- Bounded cron pass over explicitly queued reports; consent never generates a report or send by itself.
create function public.report_delivery_pending() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select s.owner_id,s.patient_id,s.entity_id as delivery_id from public.sync_records s
    left join public.report_send_jobs j on j.owner_id=s.owner_id and j.patient_id=s.patient_id
      and j.recipient_id=s.payload->>'recipient_id' and j.period_start=(s.payload->>'report_start')::timestamptz and j.period_end=(s.payload->>'report_end')::timestamptz
    where s.entity_type='report_deliveries' and not s.deleted and s.payload->>'status'='queued'
      and (j.id is null or (j.delivery_id=s.entity_id and j.state='retry' and j.attempt<3 and j.available_at<=now()))
    order by s.updated_at limit 3
  ) q;
$$;
revoke all on function public.report_delivery_claim(uuid,text,text),public.report_delivery_finish(uuid,text,text),public.report_delivery_pending() from public,anon,authenticated;
grant execute on function public.report_delivery_claim(uuid,text,text),public.report_delivery_finish(uuid,text,text),public.report_delivery_pending() to service_role;
commit;
