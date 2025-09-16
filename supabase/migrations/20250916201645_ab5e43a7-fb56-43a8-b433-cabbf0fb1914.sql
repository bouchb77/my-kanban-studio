-- Create contacts table for storing contact information
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sipi_number TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users to view contacts
CREATE POLICY "All authenticated users can view contacts" 
ON public.contacts 
FOR SELECT 
USING (true);

-- Only admins can insert, update and delete contacts
CREATE POLICY "Only admins can insert contacts" 
ON public.contacts 
FOR INSERT 
WITH CHECK (is_current_user_admin());

CREATE POLICY "Only admins can update contacts" 
ON public.contacts 
FOR UPDATE 
USING (is_current_user_admin());

CREATE POLICY "Only admins can delete contacts" 
ON public.contacts 
FOR DELETE 
USING (is_current_user_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on sipi_number for faster lookups
CREATE INDEX idx_contacts_sipi_number ON public.contacts(sipi_number);