-- Remove the overly permissive policy that allows all authenticated users to view contacts
DROP POLICY IF EXISTS "All authenticated users can view contacts" ON public.contacts;

-- Create a more secure policy that only allows admin users to view contacts
CREATE POLICY "Only admins can view contacts" 
ON public.contacts 
FOR SELECT 
USING (is_current_user_admin());

-- Also ensure the public policy doesn't exist (in case there was one)
DROP POLICY IF EXISTS "Public access to contacts" ON public.contacts;