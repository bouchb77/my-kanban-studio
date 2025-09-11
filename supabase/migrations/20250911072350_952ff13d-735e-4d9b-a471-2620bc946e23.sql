-- Deduplicate existing user_view_preferences by (user_id, view_type)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, view_type ORDER BY updated_at DESC, created_at DESC, id DESC) AS rn
  FROM public.user_view_preferences
)
DELETE FROM public.user_view_preferences uvp
USING ranked r
WHERE uvp.id = r.id AND r.rn > 1;

-- Add unique constraint to support upsert on (user_id, view_type)
ALTER TABLE public.user_view_preferences
ADD CONSTRAINT user_view_preferences_user_id_view_type_key
UNIQUE (user_id, view_type);
