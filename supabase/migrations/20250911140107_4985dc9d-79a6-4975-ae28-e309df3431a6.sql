-- Fix infinite recursion in projects table SELECT policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view projects they own or collaborate on" ON public.projects;

-- Create a simplified policy that doesn't cause recursion
CREATE POLICY "Users can view projects they own or collaborate on" 
ON public.projects 
FOR SELECT 
USING (
  -- User is the owner
  owner_id = auth.uid() 
  OR 
  -- Use the security definer function to check collaboration
  public.user_has_project_access(id, auth.uid())
);