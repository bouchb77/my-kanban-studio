-- Create companies table for SIPI data
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sipi_number text NOT NULL UNIQUE,
  company_name text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own companies" 
ON public.companies 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own companies" 
ON public.companies 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own companies" 
ON public.companies 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();