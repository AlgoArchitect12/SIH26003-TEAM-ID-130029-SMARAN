-- Executed by check-family-pairing.cjs in a disposable PostgreSQL instance.
begin;
insert into auth.users(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd') on conflict do nothing;
insert into public.sync_accounts(owner_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc') on conflict do nothing;
insert into public.sync_patients(owner_id,patient_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','gps-a'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','gps-b');
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ declare r jsonb; e uuid; begin
  r:=public.location_control('gps-a','consent'); e:=(r->>'epoch')::uuid;
  assert (r->>'enabled')::boolean;
  assert public.location_publish('gps-a',null,'[]')->>'error'='forbidden','null epoch cannot bypass consent';
  assert public.location_snapshot('gps-b')->>'error'='forbidden','patient A cannot read B';
  assert public.location_control('gps-b','consent')->>'error'='forbidden','patient A cannot configure B';
  assert public.location_publish('gps-b',e,'[]')->>'error'='forbidden','patient A cannot write B';
  perform public.location_control('gps-a','zone','{"latitude":0,"longitude":0,"radius":300}');
  perform public.location_publish('gps-a',e,jsonb_build_array(jsonb_build_object('id','inside','latitude',0,'longitude',0,'accuracy',10,'recorded_at',now()-interval '30 seconds')));
  assert public.location_snapshot('gps-a')->'event'='null'::jsonb,'no initial alert';
  perform public.location_publish('gps-a',e,jsonb_build_array(jsonb_build_object('id','outside','latitude',0.01,'longitude',0,'accuracy',10,'recorded_at',now())));
  assert public.location_snapshot('gps-a')->'event'->>'kind'='exit','exit';
  perform public.location_publish('gps-a',e,jsonb_build_array(jsonb_build_object('id','old','latitude',0,'longitude',0,'accuracy',10,'recorded_at',now()-interval '1 minute')));
  assert public.location_snapshot('gps-a')->'point'->>'id'='outside','late point cannot replace latest';
  assert public.location_snapshot('gps-a')->'event'->>'kind'='exit','late replay cannot create entry';
  perform public.location_publish('gps-a',e,'[]');
  assert public.location_snapshot('gps-a')->'event'->>'kind'='exit','duplicate suppressed';
  assert jsonb_array_length(public.location_snapshot('gps-a')->'history')=3;
  perform public.location_control('gps-a','pause');
  assert public.location_publish('gps-a',e,'[]')->>'error'='forbidden','pause invalidates epoch';
  r:=public.location_control('gps-a','resume');
  assert r->>'epoch'<>e::text,'resume rotates epoch';
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$ begin
  assert public.location_snapshot('gps-a')->>'error'='forbidden','unpaired caregiver';
  assert (select count(*) from public.location_points)=0,'direct RLS denies unpaired';
end $$;
reset role;
insert into public.patient_memberships(patient_id,owner_id,member_id,access_role,scopes,label,granted_by)
 values('gps-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caregiver','{location}','GPS test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
set local role authenticated;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$ declare r jsonb; begin
  r:=public.location_snapshot('gps-a');
  assert (r->>'ok')::boolean and not (r->>'owner')::boolean;
  assert (select count(*) from public.location_points)=3,'authorized direct RLS';
  assert public.location_control('gps-a','consent')->>'error'='forbidden','caregiver cannot grant patient consent';
  assert public.location_publish('gps-a',(r->>'epoch')::uuid,'[]')->>'error'='forbidden','caregiver cannot publish device position';
  assert public.location_snapshot('gps-b')->>'error'='forbidden','caregiver patient isolation';
  perform public.location_control('gps-a','pause');
  perform public.location_control('gps-a','resume');
end $$;
reset role;
-- Seed a definite outside state, then test entry and hysteresis with fresh points.
update public.location_sharing set inside=false,last_event=jsonb_build_object('kind','exit','at',now()-interval '6 minutes') where patient_id='gps-a';
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ declare e uuid; h jsonb; i integer; begin
  e:=(public.location_snapshot('gps-a')->>'epoch')::uuid;
  perform public.location_publish('gps-a',e,jsonb_build_array(jsonb_build_object('id','entry','latitude',0,'longitude',0,'accuracy',10,'recorded_at',now()+interval '1 second')));
  assert public.location_snapshot('gps-a')->'event'->>'kind'='entry','entry detected';
  perform public.location_publish('gps-a',e,jsonb_build_array(jsonb_build_object('id','uncertain','latitude',0.003,'longitude',0,'accuracy',500,'recorded_at',now()+interval '2 seconds')));
  assert public.location_snapshot('gps-a')->'event'->>'kind'='entry','inaccurate boundary cannot alert';
  for i in 1..310 loop
    perform public.location_publish('gps-a',e,jsonb_build_array(jsonb_build_object('id','bounded-'||i,'latitude',0,'longitude',0,'accuracy',10,'recorded_at',now()-make_interval(secs=>i))));
  end loop;
  h:=public.location_snapshot('gps-a')->'history';
  assert jsonb_array_length(h)=288,'bounded count';
  perform public.location_publish('gps-a',e,jsonb_build_array(jsonb_build_object('id','expired','latitude',0,'longitude',0,'accuracy',10,'recorded_at',now()-interval '25 hours')));
  assert not exists(select 1 from public.location_points where id='expired'),'expired upload discarded';
  begin
    perform public.location_publish('gps-a',e,'[{"id":"invalid","latitude":91,"longitude":0,"accuracy":1,"recorded_at":"2026-01-01"}]');
    raise exception 'Bad coordinate accepted';
  exception when others then assert SQLERRM='Invalid point'; end;
  begin
    perform public.location_control('gps-a','zone','{"latitude":0,"longitude":0,"radius":1}');
    raise exception 'Bad zone accepted';
  exception when others then assert SQLERRM='Invalid safe zone'; end;
  perform public.revoke_membership('gps-a','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$ begin
  assert public.location_snapshot('gps-a')->>'error'='forbidden','revocation immediately blocks RPC';
  assert public.location_control('gps-a','resume')->>'error'='forbidden','revocation blocks controls';
  assert (select count(*) from public.location_points)=0,'revocation immediately blocks direct RLS';
  assert exists(select 1 from public.location_signals where patient_id='gps-a'),'revocation sends cache invalidation';
  assert not exists(select 1 from public.location_signals where recipient<>auth.uid()),'signal recipient isolation';
end $$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ begin
  perform public.location_control('gps-a','revoke');
  assert jsonb_array_length(public.location_snapshot('gps-a')->'history')=0,'revoke erases history';
  assert public.location_control('gps-a','resume')->>'error'='consent','cannot resume revoked consent';
end $$;
set local request.jwt.claim.sub='';
do $$ begin
  assert public.location_snapshot('gps-a')->>'error'='forbidden','no session no data';
  assert (select count(*) from public.location_points)=0,'no-session RLS';
end $$;
reset role;
rollback;
