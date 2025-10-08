-- Fix Security Issues

-- 1. Remove public access policy on companies table
DROP POLICY IF EXISTS "Public access to companies for reporting" ON public.companies;

-- 2. Restrict department_management access to admins only
DROP POLICY IF EXISTS "All authenticated users can view department management" ON public.department_management;

CREATE POLICY "Only admins can view department management"
ON public.department_management FOR SELECT
USING (is_current_user_admin());

-- 3. Add input validation to import_orders function
CREATE OR REPLACE FUNCTION public.import_orders(orders_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  order_record jsonb;
  inserted_count integer := 0;
  updated_count integer := 0;
  array_size integer;
BEGIN
  -- Check admin status
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can import orders';
  END IF;

  -- Validate input is an array
  IF jsonb_typeof(orders_data) != 'array' THEN
    RAISE EXCEPTION 'Input must be a JSON array';
  END IF;
  
  -- Limit array size to prevent DoS
  array_size := jsonb_array_length(orders_data);
  IF array_size > 10000 THEN
    RAISE EXCEPTION 'Maximum 10,000 orders per import';
  END IF;

  -- Process each order with validation
  FOR order_record IN SELECT * FROM jsonb_array_elements(orders_data)
  LOOP
    -- Validate required fields exist
    IF NOT (order_record ? 'order_number' AND 
            order_record ? 'sipi_number' AND
            order_record ? 'amount' AND
            order_record ? 'order_date') THEN
      RAISE EXCEPTION 'Missing required fields in order record';
    END IF;
    
    -- Validate data types and constraints
    IF length(order_record->>'order_number') > 255 THEN
      RAISE EXCEPTION 'Order number too long';
    END IF;
    
    IF (order_record->>'amount')::numeric < 0 THEN
      RAISE EXCEPTION 'Amount cannot be negative';
    END IF;

    -- Insert or update the order
    INSERT INTO public.orders (
      order_number, 
      sipi_number, 
      amount, 
      order_date, 
      status
    )
    VALUES (
      (order_record->>'order_number')::text,
      (order_record->>'sipi_number')::text,
      (order_record->>'amount')::numeric,
      (order_record->>'order_date')::date,
      COALESCE((order_record->>'status')::text, 'pending')
    )
    ON CONFLICT (order_number) 
    DO UPDATE SET 
      sipi_number = EXCLUDED.sipi_number,
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
  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );
END;
$function$;

-- 4. Add input validation to import_order_details function
CREATE OR REPLACE FUNCTION public.import_order_details(details_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  detail_record jsonb;
  inserted_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  array_size integer;
BEGIN
  -- Check admin status
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can import order details';
  END IF;

  -- Validate input is an array
  IF jsonb_typeof(details_data) != 'array' THEN
    RAISE EXCEPTION 'Input must be a JSON array';
  END IF;
  
  -- Limit array size to prevent DoS
  array_size := jsonb_array_length(details_data);
  IF array_size > 50000 THEN
    RAISE EXCEPTION 'Maximum 50,000 order details per import';
  END IF;

  -- Process each detail with validation
  FOR detail_record IN SELECT * FROM jsonb_array_elements(details_data)
  LOOP
    -- Validate required fields exist
    IF NOT (detail_record ? 'order_number' AND 
            detail_record ? 'article_code' AND
            detail_record ? 'quantity') THEN
      RAISE EXCEPTION 'Missing required fields in order detail record';
    END IF;
    
    -- Validate data constraints
    IF length(detail_record->>'order_number') > 255 THEN
      RAISE EXCEPTION 'Order number too long';
    END IF;
    
    IF length(detail_record->>'article_code') > 255 THEN
      RAISE EXCEPTION 'Article code too long';
    END IF;
    
    IF (detail_record->>'quantity')::integer < 0 THEN
      RAISE EXCEPTION 'Quantity cannot be negative';
    END IF;

    -- Insert or update the order detail
    INSERT INTO public.order_details (
      order_number,
      article_code,
      quantity
    )
    VALUES (
      (detail_record->>'order_number')::text,
      (detail_record->>'article_code')::text,
      (detail_record->>'quantity')::integer
    )
    ON CONFLICT (order_number, article_code) 
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      updated_at = now()
    WHERE public.order_details.quantity != EXCLUDED.quantity;

    -- Count operations
    IF FOUND THEN
      IF (SELECT quantity FROM public.order_details 
          WHERE order_number = (detail_record->>'order_number')::text 
          AND article_code = (detail_record->>'article_code')::text) 
          = (detail_record->>'quantity')::integer THEN
        updated_count := updated_count + 1;
      ELSE
        inserted_count := inserted_count + 1;
      END IF;
    ELSE
      skipped_count := skipped_count + 1;
    END IF;
  END LOOP;

  -- Return result
  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', skipped_count,
    'total', inserted_count + updated_count + skipped_count
  );
END;
$function$;

-- 5. Create server-side company filtering RPC function
CREATE OR REPLACE FUNCTION get_companies_by_articles(
  article_codes text[] DEFAULT NULL,
  lis_only boolean DEFAULT NULL
)
RETURNS SETOF companies
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT c.*
  FROM companies c
  WHERE (
    -- LIS only filter
    (lis_only IS NULL OR lis_only = FALSE) OR
    (lis_only = TRUE AND EXISTS (
      SELECT 1 FROM orders o
      JOIN order_details od ON od.order_number = o.order_number
      WHERE o.sipi_number = c.sipi_number
      GROUP BY o.sipi_number
      HAVING array_agg(DISTINCT od.article_code) = ARRAY['LIS']
    ))
  )
  AND (
    -- Article filter
    article_codes IS NULL OR
    EXISTS (
      SELECT 1 FROM orders o
      JOIN order_details od ON od.order_number = o.order_number
      WHERE o.sipi_number = c.sipi_number
      AND od.article_code = ANY(article_codes)
    )
  )
  ORDER BY c.company_name;
END;
$$;

-- 6. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_order_details_article ON order_details(article_code);
CREATE INDEX IF NOT EXISTS idx_orders_sipi ON orders(sipi_number);
CREATE INDEX IF NOT EXISTS idx_order_details_order_number ON order_details(order_number);