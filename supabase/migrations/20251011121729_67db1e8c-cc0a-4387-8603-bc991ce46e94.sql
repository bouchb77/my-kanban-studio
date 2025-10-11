
-- Add admin and fo roles for brasselet-g@orange.fr
INSERT INTO public.user_roles (user_id, role)
SELECT '229e8265-72a1-4b38-a3d5-8bc1d0d14c45'::uuid, role
FROM unnest(ARRAY['admin'::app_role, 'fo'::app_role]) AS role
ON CONFLICT (user_id, role) DO NOTHING;
