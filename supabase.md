# Supabase RPC Functions for Episteme Sync

All SQL queries to execute in Supabase SQL Editor.

## Tables Synchronized

1. **cards** - FSRS flashcards with scheduling data
2. **review_log** - Review history per card
3. **card_image_refs** - Image references in cards

> **Note:** `source_notes` table was removed in v17 - metadata is now resolved from vault via `flashcard_uid`.

---

## 1. sync_all_data RPC Function

Uses UPSERT with LWW (Last Write Wins) conflict resolution.

```sql
CREATE OR REPLACE FUNCTION public.sync_all_data(
    p_cards JSONB DEFAULT '[]'::JSONB,
    p_review_log JSONB DEFAULT '[]'::JSONB,
    p_card_image_refs JSONB DEFAULT '[]'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    item JSONB;
BEGIN
    v_user_id := auth.uid()::UUID;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- CARDS
    FOR item IN SELECT * FROM jsonb_array_elements(p_cards) LOOP
        INSERT INTO public.cards (
            id, user_id, due, stability, difficulty, reps, lapses, state, last_review,
            scheduled_days, learning_step, suspended, buried_until, created_at, updated_at,
            deleted_at, question, answer, source_uid
        ) VALUES (
            (item->>'id')::uuid,
            v_user_id,
            item->>'due',                    -- TEXT, no cast!
            (item->>'stability')::float,
            (item->>'difficulty')::float,
            (item->>'reps')::int,
            (item->>'lapses')::int,
            (item->>'state')::int,
            item->>'last_review',            -- TEXT, no cast!
            (item->>'scheduled_days')::int,
            (item->>'learning_step')::int,
            (item->>'suspended')::boolean,
            item->>'buried_until',           -- TEXT, no cast!
            (item->>'created_at')::bigint,
            (item->>'updated_at')::bigint,
            (item->>'deleted_at')::bigint,
            item->>'question',
            item->>'answer',
            item->>'source_uid'
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
        WHERE EXCLUDED.updated_at > public.cards.updated_at;
    END LOOP;

    -- REVIEW LOG
    FOR item IN SELECT * FROM jsonb_array_elements(p_review_log) LOOP
        INSERT INTO public.review_log (
            id, user_id, card_id, reviewed_at, rating, scheduled_days, elapsed_days,
            state, time_spent_ms, updated_at, deleted_at
        ) VALUES (
            (item->>'id')::uuid,
            v_user_id,
            (item->>'card_id')::uuid,
            (item->>'reviewed_at')::bigint,
            (item->>'rating')::int,
            (item->>'scheduled_days')::int,
            (item->>'elapsed_days')::int,
            (item->>'state')::int,
            (item->>'time_spent_ms')::int,
            (item->>'updated_at')::bigint,
            (item->>'deleted_at')::bigint
        )
        ON CONFLICT (id, user_id) DO UPDATE SET
            card_id = EXCLUDED.card_id,
            reviewed_at = EXCLUDED.reviewed_at,
            rating = EXCLUDED.rating,
            state = EXCLUDED.state,
            updated_at = EXCLUDED.updated_at,
            deleted_at = EXCLUDED.deleted_at
        WHERE EXCLUDED.updated_at > public.review_log.updated_at;
    END LOOP;

    -- CARD IMAGE REFS
    FOR item IN SELECT * FROM jsonb_array_elements(p_card_image_refs) LOOP
        INSERT INTO public.card_image_refs (
            id, user_id, card_id, image_path, field, created_at, updated_at, deleted_at
        ) VALUES (
            (item->>'id')::uuid,
            v_user_id,
            (item->>'card_id')::uuid,
            item->>'image_path',
            item->>'field',
            (item->>'created_at')::bigint,
            (item->>'updated_at')::bigint,
            (item->>'deleted_at')::bigint
        )
        ON CONFLICT (id, user_id) DO UPDATE SET
            image_path = EXCLUDED.image_path,
            field = EXCLUDED.field,
            updated_at = EXCLUDED.updated_at,
            deleted_at = EXCLUDED.deleted_at
        WHERE EXCLUDED.updated_at > public.card_image_refs.updated_at;
    END LOOP;

    RETURN jsonb_build_object('status', 'success', 'time', now());

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$;
```

---

## 2. replace_all_data RPC Function

Deletes all user data and inserts fresh (force upload).

```sql
CREATE OR REPLACE FUNCTION public.replace_all_data(
    p_cards JSONB DEFAULT '[]'::JSONB,
    p_review_log JSONB DEFAULT '[]'::JSONB,
    p_card_image_refs JSONB DEFAULT '[]'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    item JSONB;
BEGIN
    v_user_id := auth.uid()::UUID;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    DELETE FROM public.card_image_refs WHERE user_id = v_user_id;
    DELETE FROM public.review_log WHERE user_id = v_user_id;
    DELETE FROM public.cards WHERE user_id = v_user_id;

    -- CARDS
    FOR item IN SELECT * FROM jsonb_array_elements(p_cards) LOOP
        INSERT INTO public.cards (
            id, user_id, due, stability, difficulty, reps, lapses, state, last_review,
            scheduled_days, learning_step, suspended, buried_until, created_at, updated_at,
            deleted_at, question, answer, source_uid
        ) VALUES (
            (item->>'id')::uuid,
            v_user_id,
            item->>'due',                    -- TEXT!
            (item->>'stability')::float,
            (item->>'difficulty')::float,
            (item->>'reps')::int,
            (item->>'lapses')::int,
            (item->>'state')::int,
            item->>'last_review',            -- TEXT!
            (item->>'scheduled_days')::int,
            (item->>'learning_step')::int,
            (item->>'suspended')::boolean,
            item->>'buried_until',           -- TEXT!
            (item->>'created_at')::bigint,
            (item->>'updated_at')::bigint,
            (item->>'deleted_at')::bigint,
            item->>'question',
            item->>'answer',
            item->>'source_uid'
        );
    END LOOP;

    -- REVIEW LOG
    FOR item IN SELECT * FROM jsonb_array_elements(p_review_log) LOOP
        INSERT INTO public.review_log (
            id, user_id, card_id, reviewed_at, rating, scheduled_days, elapsed_days,
            state, time_spent_ms, updated_at, deleted_at
        ) VALUES (
            (item->>'id')::uuid,
            v_user_id,
            (item->>'card_id')::uuid,
            (item->>'reviewed_at')::bigint,
            (item->>'rating')::int,
            (item->>'scheduled_days')::int,
            (item->>'elapsed_days')::int,
            (item->>'state')::int,
            (item->>'time_spent_ms')::int,
            (item->>'updated_at')::bigint,
            (item->>'deleted_at')::bigint
        );
    END LOOP;

    -- CARD IMAGE REFS
    FOR item IN SELECT * FROM jsonb_array_elements(p_card_image_refs) LOOP
        INSERT INTO public.card_image_refs (
            id, user_id, card_id, image_path, field, created_at, updated_at, deleted_at
        ) VALUES (
            (item->>'id')::uuid,
            v_user_id,
            (item->>'card_id')::uuid,
            item->>'image_path',
            item->>'field',
            (item->>'created_at')::bigint,
            (item->>'updated_at')::bigint,
            (item->>'deleted_at')::bigint
        );
    END LOOP;

    RETURN jsonb_build_object('status', 'success', 'time', now());

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$;
```

---

## Type Casting Rules

| Field Type | Example Fields | Cast |
|------------|---------------|------|
| UUID | id, card_id | `(item->>'id')::uuid` |
| TEXT (dates) | due, last_review, buried_until | `item->>'due'` (NO CAST!) |
| TEXT (content) | question, answer, source_uid | `item->>'question'` (NO CAST!) |
| FLOAT | stability, difficulty | `(item->>'stability')::float` |
| INT | reps, lapses, state, rating | `(item->>'reps')::int` |
| BIGINT | created_at, updated_at, deleted_at, reviewed_at | `(item->>'created_at')::bigint` |
| BOOLEAN | suspended | `(item->>'suspended')::boolean` |

**Important:** `due`, `last_review`, and `buried_until` are TEXT columns storing ISO date strings. Do NOT cast them to `::bigint`!

---

## Execution Order

1. Run `sync_all_data` function first
2. Run `replace_all_data` function second
3. (Optional) Drop `source_notes` table if it exists: `DROP TABLE IF EXISTS public.source_notes;`

## How to Execute

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and run each query separately (in order above)
