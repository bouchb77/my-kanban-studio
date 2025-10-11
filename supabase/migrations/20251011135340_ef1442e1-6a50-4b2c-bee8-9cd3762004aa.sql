-- Drop the existing FO policy
DROP POLICY IF EXISTS "FO users can view their formateur departments" ON public.department_management;

-- Create a more permissive policy for FO users
CREATE POLICY "FO users can view their formateur departments" 
ON public.department_management 
FOR SELECT 
USING (
  is_current_user_admin() 
  OR 
  EXISTS (
    SELECT 1 
    FROM user_fo_sectors ufs
    WHERE ufs.user_id = auth.uid() 
    AND ufs.formateur = department_management.formateur
  )
);