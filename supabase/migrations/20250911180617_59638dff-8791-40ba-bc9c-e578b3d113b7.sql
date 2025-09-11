-- Create table for individual assignment status and progress
CREATE TABLE public.project_task_assignment_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.project_task_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_task_assignment_status ENABLE ROW LEVEL SECURITY;

-- Create policies for assignment status
CREATE POLICY "Users can view assignment status of projects they have access to"
ON public.project_task_assignment_status
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM project_task_assignments pta
  JOIN project_tasks pt ON pt.id = pta.task_id
  JOIN projects p ON p.id = pt.project_id
  WHERE pta.id = project_task_assignment_status.assignment_id
    AND (p.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
    ))
));

CREATE POLICY "Users can update their own assignment status"
ON public.project_task_assignment_status
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Project collaborators can create assignment status"
ON public.project_task_assignment_status
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM project_task_assignments pta
  JOIN project_tasks pt ON pt.id = pta.task_id
  JOIN projects p ON p.id = pt.project_id
  WHERE pta.id = project_task_assignment_status.assignment_id
    AND (p.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
    ))
));

CREATE POLICY "Users can delete their own assignment status"
ON public.project_task_assignment_status
FOR DELETE
USING (user_id = auth.uid());

-- Create trigger for updating timestamps
CREATE TRIGGER update_project_task_assignment_status_updated_at
BEFORE UPDATE ON public.project_task_assignment_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();