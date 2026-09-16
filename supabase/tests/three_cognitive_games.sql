-- Run after all four migrations in a disposable local PostgreSQL/Supabase database.
-- No credentials or deployed data are needed; all checks are read-only and roll back.
begin;
do $$
declare game text; level integer; n integer; p jsonb; model jsonb;
begin
  foreach game in array array['memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall','remember_lights','number_path','sudoku_lite','chess_puzzle','word_match'] loop
    for level in 1..5 loop
      n := case game when 'remember_lights' then 2 * (level + 1)
        when 'number_path' then case level when 1 then 5 when 2 then 7 else 10 end
        when 'sudoku_lite' then case level when 1 then 3 when 2 then 6 when 3 then 8 when 4 then 12 else 16 end
        when 'chess_puzzle' then case level when 1 then 6 when 2 then 4 when 3 then 4 else 3 end
        when 'word_match' then case level when 1 then 3 when 2 then 4 when 3 then 4 when 4 then 5 else 6 end else 3 end;
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
      if game in ('remember_lights','number_path','sudoku_lite','chess_puzzle','word_match') then
        if public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"steps_completed":1}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"correct_selections":0}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"accuracy":0}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"challenges_completed":1}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"difficulty":6}'::jsonb,'upsert')
          or public.valid_sync_record('cognitive_sessions','synthetic-patient','synthetic-session',p || '{"difficulty":0}'::jsonb,'upsert')
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
do $$
declare count_games integer; snapshot jsonb; p jsonb; items jsonb;
  games text[] := array['memory_match','pattern_recognition','routine_recall','familiar_object','sequence_memory','picture_recall','remember_lights','number_path','sudoku_lite','chess_puzzle','word_match'];
begin
  foreach count_games in array array[8,11] loop
    select jsonb_agg(jsonb_build_object('gameType',g,'sessions',1,'attempts',5,'correct',3,'hints',1,'repeatedErrors',1) order by n)
      into items from unnest(games[1:count_games]) with ordinality as t(g,n);
    snapshot := jsonb_build_object('patientName','Synthetic','days',7,'timezone','Asia/Kolkata','games',items,
      'routine',jsonb_build_object('completed',0,'hydration',0,'activity',0,'appointment',0,'unknownCategory',0,'scheduledToday',0,'completedToday',0),
      'memories',jsonb_build_object('stored',0,'added',0));
    p := jsonb_build_object('id','synthetic-report','patient_id','synthetic-patient','period_start','2026-09-09T00:00:00Z','period_end','2026-09-16T00:00:00Z',
      'generated_at','2026-09-16T00:00:00Z','updated_at','2026-09-16T00:00:00Z','report_version',1,'delivery_state','generated','snapshot',snapshot::text);
    if not public.valid_sync_record('activity_reports','synthetic-patient','synthetic-report',p,'upsert') then raise exception 'Rejected % game report',count_games; end if;
    snapshot := jsonb_set(snapshot,'{games,0,gameType}','"unknown"'::jsonb);
    if public.valid_sync_record('activity_reports','synthetic-patient','synthetic-report',p || jsonb_build_object('snapshot',snapshot::text),'upsert') then raise exception 'Accepted unknown report game'; end if;
    snapshot := jsonb_set(snapshot,'{games}',items || (items->0));
    if public.valid_sync_record('activity_reports','synthetic-patient','synthetic-report',p || jsonb_build_object('snapshot',snapshot::text),'upsert') then raise exception 'Accepted wrong report count'; end if;
    if public.valid_sync_record('activity_reports','another-patient','synthetic-report',p,'upsert') then raise exception 'Accepted report ownership mismatch'; end if;
  end loop;
end;
$$;
rollback;
