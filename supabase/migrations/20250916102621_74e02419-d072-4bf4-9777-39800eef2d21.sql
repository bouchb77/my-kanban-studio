-- Update the orders table structure to use sipi_number instead of company_name
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS company_name;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS sipi_number text NOT NULL DEFAULT '';