-- Add SIPI and company name fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN sipi_number text,
ADD COLUMN company_name text;