-- Drop the restrictive policy for FO users
DROP POLICY IF EXISTS "FO users can view their formateur departments" ON department_management;

-- Create a new policy that allows:
-- 1. Admins to see everything
-- 2. FO users with 'tous' to see everything
-- 3. FO users with a specific sector to see only their sector
CREATE POLICY "FO users can view departments based on their access"
ON department_management
FOR SELECT
TO authenticated
USING (
  is_current_user_admin() 
  OR 
  EXISTS (
    SELECT 1 FROM user_fo_sectors ufs
    WHERE ufs.user_id = auth.uid()
    AND (
      ufs.formateur = 'tous'  -- Users with 'tous' can see all sectors
      OR ufs.formateur = department_management.formateur  -- Users with specific sector
    )
  )
);