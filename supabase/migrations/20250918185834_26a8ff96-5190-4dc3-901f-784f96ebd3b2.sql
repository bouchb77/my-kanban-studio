-- Remove the admin-only policy
DROP POLICY IF EXISTS "Only admins can view contacts" ON public.contacts;

-- Create a new policy that allows both admins and approved users to view contacts
CREATE POLICY "Approved users and admins can view contacts" 
ON public.contacts 
FOR SELECT 
USING (is_current_user_admin() OR is_user_approved());