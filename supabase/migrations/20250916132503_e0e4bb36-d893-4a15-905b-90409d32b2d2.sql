-- Create a table for department management information
CREATE TABLE public.department_management (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_name TEXT NOT NULL UNIQUE,
  responsable_bo TEXT,
  ct TEXT,
  formateur TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.department_management ENABLE ROW LEVEL SECURITY;

-- Create policies for viewing department management data
CREATE POLICY "All authenticated users can view department management" 
ON public.department_management 
FOR SELECT 
USING (true);

-- Only admins can modify department management data
CREATE POLICY "Only admins can insert department management" 
ON public.department_management 
FOR INSERT 
WITH CHECK (is_current_user_admin());

CREATE POLICY "Only admins can update department management" 
ON public.department_management 
FOR UPDATE 
USING (is_current_user_admin());

CREATE POLICY "Only admins can delete department management" 
ON public.department_management 
FOR DELETE 
USING (is_current_user_admin());

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_department_management_updated_at
BEFORE UPDATE ON public.department_management
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();