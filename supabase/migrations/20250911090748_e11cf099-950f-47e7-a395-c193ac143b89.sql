-- Create table to store calendar URLs for users
CREATE TABLE public.user_calendar_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ics_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own calendar settings" 
ON public.user_calendar_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar settings" 
ON public.user_calendar_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar settings" 
ON public.user_calendar_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar settings" 
ON public.user_calendar_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_calendar_settings_updated_at
BEFORE UPDATE ON public.user_calendar_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();