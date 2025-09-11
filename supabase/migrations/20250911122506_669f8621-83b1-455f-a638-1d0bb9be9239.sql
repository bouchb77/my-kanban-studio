-- Fix infinite recursion in RLS policies by creating security definer functions
-- and fix the relationship issues

-- Create security definer functions to avoid RLS recursion
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
  
  -- Check if user is a collaborator (using direct query without RLS)
  IF EXISTS (
    SELECT 1 FROM public.project_collaborators 
    WHERE project_id = project_uuid AND user_id = user_uuid
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view collaborators of projects they have access to" ON public.project_collaborators;
DROP POLICY IF EXISTS "Project owners and admins can add collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "Project owners and admins can remove collaborators" ON public.project_collaborators;

-- Create new simplified policies using the security definer function
CREATE POLICY "Users can view project collaborators" 
ON public.project_collaborators 
FOR SELECT 
USING (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage collaborators" 
ON public.project_collaborators 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND owner_id = auth.uid()
  )
);