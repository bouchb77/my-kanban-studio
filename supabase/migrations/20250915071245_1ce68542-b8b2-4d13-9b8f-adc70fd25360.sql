-- Add new columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS address1 TEXT,
ADD COLUMN IF NOT EXISTS address2 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS general_department TEXT,
ADD COLUMN IF NOT EXISTS quality TEXT,
ADD COLUMN IF NOT EXISTS last_order_date DATE,
ADD COLUMN IF NOT EXISTS client_blocked_date DATE,
ADD COLUMN IF NOT EXISTS training_date DATE,
ADD COLUMN IF NOT EXISTS report_creation_date DATE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_companies_city ON public.companies(city);
CREATE INDEX IF NOT EXISTS idx_companies_postal_code ON public.companies(postal_code);
CREATE INDEX IF NOT EXISTS idx_companies_last_order_date ON public.companies(last_order_date);