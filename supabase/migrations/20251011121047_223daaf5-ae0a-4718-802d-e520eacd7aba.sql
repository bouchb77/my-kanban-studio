-- Assign sector GBRASSELET to brasselet-g@orange.fr
INSERT INTO public.user_fo_sectors (user_id, formateur)
SELECT id, 'GBRASSELET'
FROM public.profiles
WHERE email = 'brasselet-g@orange.fr'
ON CONFLICT (user_id) 
DO UPDATE SET formateur = 'GBRASSELET', updated_at = now();