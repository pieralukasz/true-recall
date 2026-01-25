⏺ Oto wszystkie zapytania SQL do wykonania w Supabase:

-- =====================================================  
 -- 1. Update sync_all_data RPC function  
 -- Usuwa p_source_notes parameter i logikę source_notes  
 -- =====================================================

CREATE OR REPLACE FUNCTION sync_all_data(  
 p_cards JSONB DEFAULT '[]'::jsonb,  
 p_review_log JSONB DEFAULT '[]'::jsonb,  
 p_card_image_refs JSONB DEFAULT '[]'::jsonb  
 ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$  
 DECLARE  
 v_user_id TEXT;  
 v_now BIGINT;  
 v_cards_inserted INTEGER := 0;  
 v_cards_updated INTEGER := 0;  
 v_review_log_inserted INTEGER := 0;  
 v_review_log_updated INTEGER := 0;  
 v_card_image_refs_inserted INTEGER := 0;  
 v_card_image_refs_updated INTEGER := 0;  
 BEGIN  
 -- Get authenticated user ID  
 v_user_id := auth.uid();  
 IF v_user_id IS NULL THEN  
 RETURN jsonb_build_object('status', 'error', 'message', 'Not authenticated');  
 END IF;

      v_now := EXTRACT(EPOCH FROM NOW()) * 1000;

      -- ===========================================
      -- CARDS
      -- ===========================================
      FOR i IN 0..jsonb_array_length(p_cards) - 1 LOOP
          INSERT INTO public.cards (
              user_id, id, due, stability, difficulty, reps, lapses, state,
              last_review, scheduled_days, learning_step, suspended, buried_until,
              created_at, updated_at, deleted_at, question, answer, source_uid
          ) VALUES (
              v_user_id,
              p_cards->i->>'id',
              p_cards->i->>'due',
              COALESCE((p_cards->i->>'stability')::REAL, 0),
              COALESCE((p_cards->i->>'difficulty')::REAL, 0),
              COALESCE((p_cards->i->>'reps')::INTEGER, 0),
              COALESCE((p_cards->i->>'lapses')::INTEGER, 0),
              COALESCE((p_cards->i->>'state')::INTEGER, 0),
              p_cards->i->>'last_review',
              COALESCE((p_cards->i->>'scheduled_days')::INTEGER, 0),
              COALESCE((p_cards->i->>'learning_step')::INTEGER, 0),
              COALESCE((p_cards->i->>'suspended')::BOOLEAN, FALSE),
              p_cards->i->>'buried_until',
              COALESCE((p_cards->i->>'created_at')::BIGINT, v_now),
              COALESCE((p_cards->i->>'updated_at')::BIGINT, v_now),
              p_cards->i->>'deleted_at',
              p_cards->i->>'question',
              p_cards->i->>'answer',
              p_cards->i->>'source_uid'
          )
          ON CONFLICT (id, user_id) DO UPDATE SET
              due = EXCLUDED.due,
              stability = EXCLUDED.stability,
              difficulty = EXCLUDED.difficulty,
              reps = EXCLUDED.reps,
              lapses = EXCLUDED.lapses,
              state = EXCLUDED.state,
              last_review = EXCLUDED.last_review,
              scheduled_days = EXCLUDED.scheduled_days,
              learning_step = EXCLUDED.learning_step,
              suspended = EXCLUDED.suspended,
              buried_until = EXCLUDED.buried_until,
              updated_at = EXCLUDED.updated_at,
              deleted_at = EXCLUDED.deleted_at,
              question = EXCLUDED.question,
              answer = EXCLUDED.answer,
              source_uid = EXCLUDED.source_uid
          WHERE public.cards.updated_at < EXCLUDED.updated_at;
      END LOOP;

      -- ===========================================
      -- REVIEW LOG
      -- ===========================================
      FOR i IN 0..jsonb_array_length(p_review_log) - 1 LOOP
          INSERT INTO public.review_log (
              user_id, id, card_id, reviewed_at, rating, scheduled_days,
              elapsed_days, state, time_spent_ms, updated_at, deleted_at
          ) VALUES (
              v_user_id,
              p_review_log->i->>'id',
              p_review_log->i->>'card_id',
              p_review_log->i->>'reviewed_at',
              COALESCE((p_review_log->i->>'rating')::INTEGER, 0),
              COALESCE((p_review_log->i->>'scheduled_days')::INTEGER, 0),
              COALESCE((p_review_log->i->>'elapsed_days')::INTEGER, 0),
              COALESCE((p_review_log->i->>'state')::INTEGER, 0),
              COALESCE((p_review_log->i->>'time_spent_ms')::INTEGER, 0),
              COALESCE((p_review_log->i->>'updated_at')::BIGINT, v_now),
              p_review_log->i->>'deleted_at'
          )
          ON CONFLICT (id, user_id) DO UPDATE SET
              card_id = EXCLUDED.card_id,
              reviewed_at = EXCLUDED.reviewed_at,
              rating = EXCLUDED.rating,
              scheduled_days = EXCLUDED.scheduled_days,
              elapsed_days = EXCLUDED.elapsed_days,
              state = EXCLUDED.state,
              time_spent_ms = EXCLUDED.time_spent_ms,
              updated_at = EXCLUDED.updated_at,
              deleted_at = EXCLUDED.deleted_at
          WHERE public.review_log.updated_at < EXCLUDED.updated_at;
      END LOOP;

      -- ===========================================
      -- CARD IMAGE REFS
      -- ===========================================
      FOR i IN 0..jsonb_array_length(p_card_image_refs) - 1 LOOP
          INSERT INTO public.card_image_refs (
              user_id, id, card_id, image_path, field, created_at, updated_at, deleted_at
          ) VALUES (
              v_user_id,
              p_card_image_refs->i->>'id',
              p_card_image_refs->i->>'card_id',
              p_card_image_refs->i->>'image_path',
              p_card_image_refs->i->>'field',
              COALESCE((p_card_image_refs->i->>'created_at')::BIGINT, v_now),
              COALESCE((p_card_image_refs->i->>'updated_at')::BIGINT, v_now),
              p_card_image_refs->i->>'deleted_at'
          )
          ON CONFLICT (id, user_id) DO UPDATE SET
              card_id = EXCLUDED.card_id,
              image_path = EXCLUDED.image_path,
              field = EXCLUDED.field,
              updated_at = EXCLUDED.updated_at,
              deleted_at = EXCLUDED.deleted_at
          WHERE public.card_image_refs.updated_at < EXCLUDED.updated_at;
      END LOOP;

      RETURN jsonb_build_object(
          'status', 'ok',
          'message', 'Sync completed'
      );

END;

$$
;


-- =====================================================
-- 2. Update replace_all_data RPC function
-- Usuwa p_source_notes parameter i logikę source_notes
-- =====================================================

CREATE OR REPLACE FUNCTION replace_all_data(
    p_cards JSONB DEFAULT '[]'::jsonb,
    p_review_log JSONB DEFAULT '[]'::jsonb,
    p_card_image_refs JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS
$$

DECLARE  
 v_user_id TEXT;  
 v_now BIGINT;  
 BEGIN  
 -- Get authenticated user ID  
 v_user_id := auth.uid();  
 IF v_user_id IS NULL THEN  
 RETURN jsonb_build_object('status', 'error', 'message', 'Not authenticated');  
 END IF;

      v_now := EXTRACT(EPOCH FROM NOW()) * 1000;

      -- Delete all existing data for this user
      DELETE FROM public.card_image_refs WHERE user_id = v_user_id;
      DELETE FROM public.review_log WHERE user_id = v_user_id;
      DELETE FROM public.cards WHERE user_id = v_user_id;

      -- Insert new data
      -- CARDS
      FOR i IN 0..jsonb_array_length(p_cards) - 1 LOOP
          INSERT INTO public.cards (
              user_id, id, due, stability, difficulty, reps, lapses, state,
              last_review, scheduled_days, learning_step, suspended, buried_until,
              created_at, updated_at, deleted_at, question, answer, source_uid
          ) VALUES (
              v_user_id,
              p_cards->i->>'id',
              p_cards->i->>'due',
              COALESCE((p_cards->i->>'stability')::REAL, 0),
              COALESCE((p_cards->i->>'difficulty')::REAL, 0),
              COALESCE((p_cards->i->>'reps')::INTEGER, 0),
              COALESCE((p_cards->i->>'lapses')::INTEGER, 0),
              COALESCE((p_cards->i->>'state')::INTEGER, 0),
              p_cards->i->>'last_review',
              COALESCE((p_cards->i->>'scheduled_days')::INTEGER, 0),
              COALESCE((p_cards->i->>'learning_step')::INTEGER, 0),
              COALESCE((p_cards->i->>'suspended')::BOOLEAN, FALSE),
              p_cards->i->>'buried_until',
              COALESCE((p_cards->i->>'created_at')::BIGINT, v_now),
              COALESCE((p_cards->i->>'updated_at')::BIGINT, v_now),
              p_cards->i->>'deleted_at',
              p_cards->i->>'question',
              p_cards->i->>'answer',
              p_cards->i->>'source_uid'
          );
      END LOOP;

      -- REVIEW LOG
      FOR i IN 0..jsonb_array_length(p_review_log) - 1 LOOP
          INSERT INTO public.review_log (
              user_id, id, card_id, reviewed_at, rating, scheduled_days,
              elapsed_days, state, time_spent_ms, updated_at, deleted_at
          ) VALUES (
              v_user_id,
              p_review_log->i->>'id',
              p_review_log->i->>'card_id',
              p_review_log->i->>'reviewed_at',
              COALESCE((p_review_log->i->>'rating')::INTEGER, 0),
              COALESCE((p_review_log->i->>'scheduled_days')::INTEGER, 0),
              COALESCE((p_review_log->i->>'elapsed_days')::INTEGER, 0),
              COALESCE((p_review_log->i->>'state')::INTEGER, 0),
              COALESCE((p_review_log->i->>'time_spent_ms')::INTEGER, 0),
              COALESCE((p_review_log->i->>'updated_at')::BIGINT, v_now),
              p_review_log->i->>'deleted_at'
          );
      END LOOP;

      -- CARD IMAGE REFS
      FOR i IN 0..jsonb_array_length(p_card_image_refs) - 1 LOOP
          INSERT INTO public.card_image_refs (
              user_id, id, card_id, image_path, field, created_at, updated_at, deleted_at
          ) VALUES (
              v_user_id,
              p_card_image_refs->i->>'id',
              p_card_image_refs->i->>'card_id',
              p_card_image_refs->i->>'image_path',
              p_card_image_refs->i->>'field',
              COALESCE((p_card_image_refs->i->>'created_at')::BIGINT, v_now),
              COALESCE((p_card_image_refs->i->>'updated_at')::BIGINT, v_now),
              p_card_image_refs->i->>'deleted_at'
          );
      END LOOP;

      RETURN jsonb_build_object(
          'status', 'ok',
          'message', 'All data replaced'
      );

END;

$$
;


-- =====================================================
-- 3. Drop source_notes table
-- =====================================================

DROP TABLE IF EXISTS public.source_notes;

Kolejność wykonywania:

1. Najpierw uruchom sync_all_data - aby zaktualizować funkcję RPC
2. Potem uruchom replace_all_data - aby zaktualizować drugą funkcję RPC
3. Na końcu uruchom DROP TABLE - aby usunąć tabelę source_notes

Jak to wykonać w Supabase:

1. Otwórz Supabase Dashboard
2. Przejdź do SQL Editor
3. Skopiuj i uruchom każde zapytanie osobno (w powyższej kolejności)
$$
