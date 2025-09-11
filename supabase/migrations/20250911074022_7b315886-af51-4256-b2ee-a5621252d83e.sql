-- Create a table to track read notifications
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_id TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own notifications" 
ON public.user_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notifications" 
ON public.user_notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.user_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" 
ON public.user_notifications 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_user_notifications_unique 
ON public.user_notifications (user_id, notification_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_notifications_updated_at
BEFORE UPDATE ON public.user_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();