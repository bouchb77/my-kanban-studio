-- Add category field to tasks table
ALTER TABLE public.tasks ADD COLUMN category TEXT DEFAULT 'general';

-- Create user_categories table for user-specific category options
CREATE TABLE public.user_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS for user_categories
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for user_categories
CREATE POLICY "Users can view own categories" 
ON public.user_categories 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" 
ON public.user_categories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" 
ON public.user_categories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
ON public.user_categories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_categories_updated_at
BEFORE UPDATE ON public.user_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories for existing users
INSERT INTO public.user_categories (user_id, name, color, "order")
SELECT DISTINCT user_id, 'Général', '#64748b', 0
FROM public.tasks
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;