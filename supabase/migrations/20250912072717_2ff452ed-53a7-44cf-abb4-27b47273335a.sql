-- Create project categories table
CREATE TABLE public.project_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for project categories
CREATE POLICY "Users can view categories of projects they have access to"
ON public.project_categories
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_categories.project_id 
    AND (
      p.owner_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project admins can manage categories"
ON public.project_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_categories.project_id 
    AND (
      p.owner_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid() AND pc.role = 'admin'
      )
    )
  )
);

-- Add category to project tasks
ALTER TABLE public.project_tasks 
ADD COLUMN category_id uuid REFERENCES public.project_categories(id) ON DELETE SET NULL;

-- Add trigger for updated_at
CREATE TRIGGER update_project_categories_updated_at
BEFORE UPDATE ON public.project_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically update task status based on assignment statuses
CREATE OR REPLACE FUNCTION public.update_task_status_from_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_uuid uuid;
  total_assignments integer;
  todo_count integer;
  in_progress_count integer;
  review_count integer;
  done_count integer;
  new_status text;
BEGIN
  -- Get the task_id from the assignment
  SELECT pta.task_id INTO task_uuid
  FROM public.project_task_assignments pta
  WHERE pta.id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Count assignments by status
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'todo'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'review'),
    COUNT(*) FILTER (WHERE status = 'done')
  INTO total_assignments, todo_count, in_progress_count, review_count, done_count
  FROM public.project_task_assignment_status ptas
  JOIN public.project_task_assignments pta ON pta.id = ptas.assignment_id
  WHERE pta.task_id = task_uuid;
  
  -- Determine new status based on assignment statuses
  IF total_assignments = 0 OR todo_count = total_assignments THEN
    new_status := 'todo';
  ELSIF done_count = total_assignments THEN
    new_status := 'done';
  ELSIF review_count > 0 THEN
    new_status := 'review';
  ELSIF in_progress_count > 0 THEN
    new_status := 'in_progress';
  ELSE
    new_status := 'todo';
  END IF;
  
  -- Update the task status
  UPDATE public.project_tasks
  SET status = new_status
  WHERE id = task_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for automatic status updates
CREATE TRIGGER update_task_status_on_assignment_change
AFTER INSERT OR UPDATE OR DELETE ON public.project_task_assignment_status
FOR EACH ROW
EXECUTE FUNCTION public.update_task_status_from_assignments();