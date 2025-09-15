-- Create function to import orders data
CREATE OR REPLACE FUNCTION public.import_orders(orders_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record jsonb;
  inserted_count integer := 0;
  updated_count integer := 0;
  result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can import orders';
  END IF;

  -- Process each order in the input data
  FOR order_record IN SELECT * FROM jsonb_array_elements(orders_data)
  LOOP
    -- Insert or update the order
    INSERT INTO public.orders (
      order_number, 
      company_name, 
      amount, 
      order_date, 
      status
    )
    VALUES (
      (order_record->>'order_number')::text,
      (order_record->>'company_name')::text,
      (order_record->>'amount')::numeric,
      (order_record->>'order_date')::date,
      (order_record->>'status')::text
    )
    ON CONFLICT (order_number) 
    DO UPDATE SET 
      company_name = EXCLUDED.company_name,
      amount = EXCLUDED.amount,
      order_date = EXCLUDED.order_date,
      status = EXCLUDED.status,
      updated_at = now();

    -- Count operations
    IF FOUND THEN
      updated_count := updated_count + 1;
    ELSE
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  -- Return result
  result := jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );

  RETURN result;
END;
$$;