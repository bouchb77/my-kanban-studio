-- Add admin and FO roles for brasselet-g@orange.fr
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'brasselet-g@orange.fr'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'fo'::app_role
FROM public.profiles
WHERE email = 'brasselet-g@orange.fr'
ON CONFLICT (user_id, role) DO NOTHING;