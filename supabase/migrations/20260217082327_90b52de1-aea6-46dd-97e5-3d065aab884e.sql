-- Add sipi_number column
ALTER TABLE public.companies_de ADD COLUMN sipi_number text;

-- Drop unwanted columns
ALTER TABLE public.companies_de 
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS geocoded_address,
  DROP COLUMN IF EXISTS geocoding_date,
  DROP COLUMN IF EXISTS quality,
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone;