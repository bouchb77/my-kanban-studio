-- Fix the search path issue in the security definer function
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;