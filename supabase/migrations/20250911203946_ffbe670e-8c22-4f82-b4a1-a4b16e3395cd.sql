-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- Insert admin role for the specified user
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Get user ID from email (assuming profiles table has email)
    SELECT id INTO admin_user_id 
    FROM public.profiles 
    WHERE email = 'brasselet-g@orange.fr';
    
    -- If user exists, make them admin
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role) 
        VALUES (admin_user_id, 'admin'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;

-- Update companies table policies to make it admin-only for modifications, but readable by all authenticated users
DROP POLICY IF EXISTS "Users can delete their own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can insert their own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;

-- New policies for companies
CREATE POLICY "All authenticated users can view companies" 
ON public.companies 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert companies" 
ON public.companies 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Only admins can update companies" 
ON public.companies 
FOR UPDATE 
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Only admins can delete companies" 
ON public.companies 
FOR DELETE 
TO authenticated
USING (public.is_current_user_admin());

-- Remove user_id column from companies table as it's no longer needed
ALTER TABLE public.companies DROP COLUMN IF EXISTS user_id;

-- Add RLS policies for user_roles table
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Only admins can manage roles" 
ON public.user_roles 
FOR ALL 
TO authenticated
USING (public.is_current_user_admin());