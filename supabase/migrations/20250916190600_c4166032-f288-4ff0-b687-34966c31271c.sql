-- Approuver le compte brasselet-g@orange.fr
UPDATE public.profiles 
SET 
  approved = true,
  approved_at = now()
WHERE email = 'brasselet-g@orange.fr';