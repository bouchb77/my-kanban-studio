-- Create table for company comments
CREATE TABLE public.company_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_comments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view comments"
ON public.company_comments
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create comments"
ON public.company_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id AND (is_user_approved() OR is_current_user_admin()));

CREATE POLICY "Users can update their own comments"
ON public.company_comments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.company_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_company_comments_updated_at
BEFORE UPDATE ON public.company_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_company_comments_company_id ON public.company_comments(company_id);
CREATE INDEX idx_company_comments_user_id ON public.company_comments(user_id);