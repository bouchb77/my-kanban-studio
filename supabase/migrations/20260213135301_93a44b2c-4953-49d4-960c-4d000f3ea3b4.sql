
-- Create companies_de table for German companies
CREATE TABLE public.companies_de (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  address1 text,
  address2 text,
  city text,
  postal_code text,
  country text DEFAULT 'DE',
  latitude numeric,
  longitude numeric,
  geocoded_address text,
  geocoding_date timestamptz,
  quality text,
  region text,
  contact_name text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies_de ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All authenticated users can view companies_de"
  ON public.companies_de FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert companies_de"
  ON public.companies_de FOR INSERT
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Only admins can update companies_de"
  ON public.companies_de FOR UPDATE
  USING (is_current_user_admin());

CREATE POLICY "Only admins can delete companies_de"
  ON public.companies_de FOR DELETE
  USING (is_current_user_admin());

-- Trigger for updated_at
CREATE TRIGGER update_companies_de_updated_at
  BEFORE UPDATE ON public.companies_de
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
