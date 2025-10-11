-- Allow FO users to view department management data for their assigned formateur
CREATE POLICY "FO users can view their formateur departments"
ON public.department_management
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_fo_sectors ufs
    WHERE ufs.user_id = auth.uid()
    AND ufs.formateur = department_management.formateur
  )
);