-- Create table for user view preferences (columns visibility and order)
CREATE TABLE public.user_view_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'table', -- 'table', 'kanban', etc.
  visible_columns JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of column IDs that are visible  
  column_order JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array defining column order
  column_widths JSONB NOT NULL DEFAULT '{}'::jsonb, -- Object with column widths
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, view_type)
);

-- Enable Row Level Security
ALTER TABLE public.user_view_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for user view preferences
CREATE POLICY "Users can view own view preferences" 
ON public.user_view_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own view preferences" 
ON public.user_view_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own view preferences" 
ON public.user_view_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own view preferences" 
ON public.user_view_preferences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_view_preferences_updated_at
BEFORE UPDATE ON public.user_view_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();