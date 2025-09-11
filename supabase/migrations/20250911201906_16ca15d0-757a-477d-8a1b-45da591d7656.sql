-- Create function to check if user is admin of a project
CREATE OR REPLACE FUNCTION public.user_is_project_admin(project_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user is project owner (always considered admin)
  IF EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_uuid AND owner_id = user_uuid
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a collaborator with admin role
  RETURN EXISTS (
    SELECT 1 FROM public.project_collaborators 
    WHERE project_id = project_uuid AND user_id = user_uuid AND role = 'admin'
  );
END;
$$;

-- Update the delete policy for project_tasks to only allow admins and owners
DROP POLICY IF EXISTS "Project collaborators can delete tasks" ON public.project_tasks;

CREATE POLICY "Project admins can delete tasks"
ON public.project_tasks
FOR DELETE
USING (public.user_is_project_admin(project_id, auth.uid()));

-- Add a function to delete a project task (for use in the application)
CREATE OR REPLACE FUNCTION public.delete_project_task(task_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_uuid uuid;
BEGIN
  -- Get the project_id for this task
  SELECT project_id INTO project_uuid FROM public.project_tasks WHERE id = task_uuid;
  
  -- Check if user is admin of the project
  IF NOT public.user_is_project_admin(project_uuid, auth.uid()) THEN
    RETURN FALSE;
  END IF;
  
  -- Delete the task (this will cascade to assignments, comments, etc.)
  DELETE FROM public.project_tasks WHERE id = task_uuid;
  
  RETURN TRUE;
END;
$$;