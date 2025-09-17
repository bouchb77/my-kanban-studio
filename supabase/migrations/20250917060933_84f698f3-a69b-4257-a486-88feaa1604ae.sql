-- Add unique constraint on sipi_number for contacts table
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_sipi_number_unique UNIQUE (sipi_number);