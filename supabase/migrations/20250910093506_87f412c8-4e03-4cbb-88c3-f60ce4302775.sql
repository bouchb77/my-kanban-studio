-- Add JSONB column to store custom field values on tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Optional: a small index can help if we later filter by custom fields (kept simple)
-- CREATE INDEX IF NOT EXISTS idx_tasks_custom_fields ON public.tasks USING GIN (custom_fields);
