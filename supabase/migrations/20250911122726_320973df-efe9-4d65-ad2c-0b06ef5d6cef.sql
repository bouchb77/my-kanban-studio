-- Drop all existing policies for project_collaborators to fix recursion
DROP POLICY IF EXISTS "Users can view project collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "Project owners can manage collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "Users can view collaborators of projects they have access to" ON public.project_collaborators;
DROP POLICY IF EXISTS "Project owners and admins can add collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "Project owners and admins can remove collaborators" ON public.project_collaborators;

-- Create security definer function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.user_has_project_access(project_uuid uuid, user_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is project owner
  IF EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_uuid AND owner_id = user_uuid
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a collaborator (bypass RLS for this check)
  RETURN EXISTS (
    SELECT 1 FROM public.project_collaborators 
    WHERE project_id = project_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create simple, non-recursive policies
CREATE POLICY "Project collaborators select policy" 
ON public.project_collaborators 
FOR SELECT 
USING (
  -- User can see collaborators of projects they own
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND owner_id = auth.uid()
  )
  OR
  -- User can see their own collaborator records
  user_id = auth.uid()
);

CREATE POLICY "Project collaborators insert policy" 
ON public.project_collaborators 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Project collaborators delete policy" 
ON public.project_collaborators 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND owner_id = auth.uid()
  )
);