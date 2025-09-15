-- Add GPS coordinates columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS geocoded_address TEXT,
ADD COLUMN IF NOT EXISTS geocoding_date TIMESTAMP WITH TIME ZONE;

-- Create index for geographic queries
CREATE INDEX IF NOT EXISTS idx_companies_coordinates ON public.companies(latitude, longitude);

-- Create policy for public access to view companies (for reporting)
CREATE POLICY "Anyone can view companies for reporting" 
ON public.companies 
FOR SELECT 
USING (true);