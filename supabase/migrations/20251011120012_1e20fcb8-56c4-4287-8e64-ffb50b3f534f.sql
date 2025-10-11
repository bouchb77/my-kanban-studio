-- Drop existing enum and recreate with new roles
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('admin', 'bo', 'ct', 'fo');

-- Recreate user_roles table with new enum
DROP TABLE IF EXISTS public.user_roles CASCADE;
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create table for FO sector assignments
CREATE TABLE public.user_fo_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  formateur TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id)
);

ALTER TABLE public.user_fo_sectors ENABLE ROW LEVEL SECURITY;

-- Recreate security definer function with new roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
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
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Policies for user_roles
CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policies for user_fo_sectors
CREATE POLICY "Only admins can manage FO sectors"
ON public.user_fo_sectors
FOR ALL
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Users can view their own FO sector"
ON public.user_fo_sectors
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Function to get FO users with their sectors
CREATE OR REPLACE FUNCTION public.get_fo_training_stats(
  _user_id UUID,
  _year INTEGER
)
RETURNS TABLE (
  paid_trainings BIGINT,
  total_trainings BIGINT,
  secured_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _formateur TEXT;
BEGIN
  -- Get the formateur for this user
  SELECT formateur INTO _formateur
  FROM user_fo_sectors
  WHERE user_id = _user_id;

  IF _formateur IS NULL THEN
    RETURN QUERY
    SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT c.id) FILTER (WHERE c.training_date IS NOT NULL AND EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.sipi_number = c.sipi_number 
      AND EXTRACT(YEAR FROM o.order_date) = _year
      AND o.amount > 0
    ))::BIGINT as paid_trainings,
    COUNT(DISTINCT c.id) FILTER (WHERE c.training_date IS NOT NULL)::BIGINT as total_trainings,
    COALESCE(AVG(o.amount) FILTER (WHERE c.training_date IS NOT NULL), 0) as secured_revenue
  FROM companies c
  LEFT JOIN orders o ON o.sipi_number = c.sipi_number 
    AND EXTRACT(YEAR FROM o.order_date) = _year
  LEFT JOIN department_management dm ON dm.department_name = c.general_department
  WHERE dm.formateur = _formateur
    AND EXTRACT(YEAR FROM c.training_date) = _year;
END;
$$;