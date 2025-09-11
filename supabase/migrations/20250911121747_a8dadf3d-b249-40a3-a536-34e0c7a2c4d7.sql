-- Create projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create project collaborators table
CREATE TABLE public.project_collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create project tasks table
CREATE TABLE public.project_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create project task assignments table
CREATE TABLE public.project_task_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Create project task comments table
CREATE TABLE public.project_task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
CREATE POLICY "Users can view projects they own or collaborate on" 
ON public.projects 
FOR SELECT 
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.project_collaborators 
    WHERE project_id = projects.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owners can update their projects" 
ON public.projects 
FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Project owners can delete their projects" 
ON public.projects 
FOR DELETE 
USING (owner_id = auth.uid());

-- Create policies for project collaborators
CREATE POLICY "Users can view collaborators of projects they have access to" 
ON public.project_collaborators 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project owners and admins can add collaborators" 
ON public.project_collaborators 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.project_collaborators pc 
    WHERE pc.project_id = project_id AND pc.user_id = auth.uid() AND pc.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Project owners and admins can remove collaborators" 
ON public.project_collaborators 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.project_collaborators pc 
    WHERE pc.project_id = project_id AND pc.user_id = auth.uid() AND pc.role IN ('owner', 'admin')
  )
);

-- Create policies for project tasks
CREATE POLICY "Users can view tasks of projects they have access to" 
ON public.project_tasks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project collaborators can create tasks" 
ON public.project_tasks 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project collaborators can update tasks" 
ON public.project_tasks 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project collaborators can delete tasks" 
ON public.project_tasks 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

-- Create policies for task assignments
CREATE POLICY "Users can view task assignments of projects they have access to" 
ON public.project_task_assignments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt
    JOIN public.projects p ON p.id = pt.project_id
    WHERE pt.id = task_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project collaborators can assign tasks" 
ON public.project_task_assignments 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt
    JOIN public.projects p ON p.id = pt.project_id
    WHERE pt.id = task_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project collaborators can remove task assignments" 
ON public.project_task_assignments 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt
    JOIN public.projects p ON p.id = pt.project_id
    WHERE pt.id = task_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

-- Create policies for task comments
CREATE POLICY "Users can view comments of tasks in projects they have access to" 
ON public.project_task_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt
    JOIN public.projects p ON p.id = pt.project_id
    WHERE pt.id = task_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project collaborators can add comments" 
ON public.project_task_comments 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.project_tasks pt
    JOIN public.projects p ON p.id = pt.project_id
    WHERE pt.id = task_id AND (
      p.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can update their own comments" 
ON public.project_task_comments 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" 
ON public.project_task_comments 
FOR DELETE 
USING (user_id = auth.uid());

-- Create triggers for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_task_comments_updated_at
BEFORE UPDATE ON public.project_task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();