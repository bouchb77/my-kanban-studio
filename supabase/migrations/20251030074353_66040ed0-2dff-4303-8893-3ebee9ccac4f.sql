-- Fix the import_order_details function counting logic
DROP FUNCTION IF EXISTS public.import_order_details(jsonb);

CREATE OR REPLACE FUNCTION public.import_order_details(details_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  detail_record jsonb;
  inserted_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  array_size integer;
  rows_affected integer;
  was_updated boolean;
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

    -- Check if record exists
    SELECT EXISTS(
      SELECT 1 FROM public.order_details 
      WHERE order_number = (detail_record->>'order_number')::text
        AND article_code = (detail_record->>'article_code')::text
    ) INTO was_updated;

    -- Insert or update the order detail with expiration_date
    INSERT INTO public.order_details (
      order_number,
      article_code,
      quantity,
      expiration_date
    )
    VALUES (
      (detail_record->>'order_number')::text,
      (detail_record->>'article_code')::text,
      (detail_record->>'quantity')::integer,
      CASE 
        WHEN detail_record->>'expiration_date' IS NOT NULL AND detail_record->>'expiration_date' != ''
        THEN (detail_record->>'expiration_date')::date
        ELSE NULL
      END
    )
    ON CONFLICT (order_number, article_code) 
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      expiration_date = EXCLUDED.expiration_date,
      updated_at = now()
    WHERE public.order_details.quantity != EXCLUDED.quantity 
       OR public.order_details.expiration_date IS DISTINCT FROM EXCLUDED.expiration_date;

    -- Count operations based on whether record existed and if it was actually updated
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    IF rows_affected > 0 THEN
      IF was_updated THEN
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