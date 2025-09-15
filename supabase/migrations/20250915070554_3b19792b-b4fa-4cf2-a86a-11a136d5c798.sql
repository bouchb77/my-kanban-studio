-- Create orders table for import reporting
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  order_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access only
CREATE POLICY "Only admins can view orders" 
ON public.orders 
FOR SELECT 
USING (is_current_user_admin());

CREATE POLICY "Only admins can insert orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (is_current_user_admin());

CREATE POLICY "Only admins can update orders" 
ON public.orders 
FOR UPDATE 
USING (is_current_user_admin());

CREATE POLICY "Only admins can delete orders" 
ON public.orders 
FOR DELETE 
USING (is_current_user_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_orders_order_number ON public.orders(order_number);
CREATE INDEX idx_orders_company_name ON public.orders(company_name);
CREATE INDEX idx_orders_order_date ON public.orders(order_date);