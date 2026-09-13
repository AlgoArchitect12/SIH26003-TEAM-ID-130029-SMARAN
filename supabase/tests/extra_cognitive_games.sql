-- Run after both migrations in a disposable local PostgreSQL/Supabase database.
-- No credentials or deployed data are needed; all checks are read-only and roll back.
begin;
do $$
declare game text; level integer; n integer; p jsonb; model jsonb;
begin
  foreach game in array array['memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall','remember_lights','number_path'] loop
    for level in 1..5 loop
      n := case game when 'remember_lights' then 2 * (level + 1)
        when 'number_path' then case level when 1 then 5 when 2 then 7 else 10 end else 3 end;
      p := jsonb_build_object('id','synthetic-session','patient_id','synthetic-patient','game_type',game,
        'difficulty',level,'recommended_difficulty',level,'started_at','2026-09-13T00:00:00Z',
        'completed_at','2026-09-13T00:01:00Z','created_at','2026-09-13T00:01:00Z',
        'attempts',n+2,'hints_used',2,'avg_response_ms',1500,'accuracy',n::numeric/(n+2),'feedback_label',null,
        'total_pairs',null,'matches',null,'repeated_mistakes',null,'challenges_completed',null,'steps_completed',null,
        'correct_selections',n,'repeated_errors',1);
      if game = 'memory_match' then
        p := p || jsonb_build_object('total_pairs',n,'matches',n,'repeated_mistakes',1,'correct_selections',null,'repeated_errors',null);
      elsif game in ('pattern_recognition','familiar_object','picture_recall') then
        p := p || jsonb_build_object('challenges_completed',n);
      else
        p := p || jsonb_build_object('steps_completed',n);
      end if;
      if not public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p,'upsert') then
        raise exception 'Rejected valid % level %', game, level;
      end if;
      if game in ('remember_lights','number_path') then
        if public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"steps_completed":1}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"correct_selections":0}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"accuracy":0}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"challenges_completed":1}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','another-patient','synthetic-session',p,'upsert') then
          raise exception 'Accepted invalid % telemetry or ownership', game;
        end if;
      end if;
      model := jsonb_build_object('patient_id','synthetic-patient','game_type',game,'bias',-1.8,'weight_accuracy',1.4,
        'weight_pace',0.5,'weight_memory',0.7,'weight_hints',0.8,'weight_stability',0.4,'sample_count',1,'updated_at','2026-09-13T00:01:00Z');
      if not public.valid_sync_record('adaptive_model_state','synthetic-patient','synthetic-patient:' || game,model,'upsert') then
        raise exception 'Rejected model %',game;
      end if;
    end loop;
  end loop;
  if public.valid_sync_record('adaptive_model_state','synthetic-patient','synthetic-patient:unknown',model || '{"game_type":"unknown"}'::jsonb,'upsert') then
    raise exception 'Accepted unknown activity';
  end if;
end;
$$;
rollback;
