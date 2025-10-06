-- Créer la table pour les détails de commandes (articles commandés)
CREATE TABLE IF NOT EXISTS public.order_details (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text NOT NULL,
  article_code text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_order_article UNIQUE (order_number, article_code)
);

-- Enable RLS
ALTER TABLE public.order_details ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All authenticated users can view order details"
  ON public.order_details
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert order details"
  ON public.order_details
  FOR INSERT
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Only admins can update order details"
  ON public.order_details
  FOR UPDATE
  USING (is_current_user_admin());

CREATE POLICY "Only admins can delete order details"
  ON public.order_details
  FOR DELETE
  USING (is_current_user_admin());

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_order_details_updated_at
  BEFORE UPDATE ON public.order_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour importer les détails de commandes
CREATE OR REPLACE FUNCTION public.import_order_details(details_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  detail_record jsonb;
  inserted_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can import order details';
  END IF;

  -- Process each detail in the input data
  FOR detail_record IN SELECT * FROM jsonb_array_elements(details_data)
  LOOP
    -- Insert or update the order detail (skip if already exists with same quantity)
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
  result := jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', skipped_count,
    'total', inserted_count + updated_count + skipped_count
  );

  RETURN result;
END;
$$;