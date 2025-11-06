-- Correction de la fonction get_company_stats_optimized pour éviter la multiplication des montants
DROP FUNCTION IF EXISTS get_company_stats_optimized(numeric);

CREATE OR REPLACE FUNCTION get_company_stats_optimized(max_threshold numeric DEFAULT 999999999)
RETURNS TABLE(
  company_id uuid,
  sipi_number text,
  company_name text,
  amount_2023 numeric,
  amount_2024 numeric,
  amount_2025 numeric,
  max_amount numeric,
  latitude numeric,
  longitude numeric,
  address1 text,
  city text,
  general_department text,
  quality text,
  next_renewal date,
  has_training boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH company_orders AS (
    -- Agrégation des commandes par entreprise et par année civile
    -- SANS jointure avec order_details pour éviter la multiplication
    SELECT 
      c.id as company_id,
      c.sipi_number,
      c.company_name,
      c.latitude,
      c.longitude,
      c.address1,
      c.city,
      c.general_department,
      c.quality,
      -- Année 2023
      COALESCE(SUM(o.amount) FILTER (
        WHERE EXTRACT(YEAR FROM o.order_date) = 2023
      ), 0) as year_2023,
      -- Année 2024
      COALESCE(SUM(o.amount) FILTER (
        WHERE EXTRACT(YEAR FROM o.order_date) = 2024
      ), 0) as year_2024,
      -- Année 2025
      COALESCE(SUM(o.amount) FILTER (
        WHERE EXTRACT(YEAR FROM o.order_date) = 2025
      ), 0) as year_2025
    FROM public.companies c
    LEFT JOIN public.orders o ON o.sipi_number = c.sipi_number
    GROUP BY c.id, c.sipi_number, c.company_name, c.latitude, c.longitude, 
             c.address1, c.city, c.general_department, c.quality
  ),
  training_check AS (
    -- Détection des formations dans une CTE séparée
    SELECT 
      c.sipi_number,
      bool_or(od.article_code IN ('FSITE', 'FSITEJ')) as has_training_orders
    FROM public.companies c
    INNER JOIN public.orders o ON o.sipi_number = c.sipi_number
    INNER JOIN public.order_details od ON od.order_number = o.order_number
    GROUP BY c.sipi_number
  ),
  renewal_dates AS (
    -- Calcul de la prochaine date de renouvellement par entreprise
    SELECT 
      c.sipi_number,
      MIN(od.expiration_date) FILTER (
        WHERE od.expiration_date > CURRENT_DATE
      ) as next_renewal_date
    FROM public.companies c
    INNER JOIN public.orders o ON o.sipi_number = c.sipi_number
    INNER JOIN public.order_details od ON od.order_number = o.order_number
    WHERE od.expiration_date IS NOT NULL
    GROUP BY c.sipi_number
  )
  SELECT 
    co.company_id,
    co.sipi_number,
    co.company_name,
    co.year_2023 as amount_2023,
    co.year_2024 as amount_2024,
    co.year_2025 as amount_2025,
    GREATEST(co.year_2023, co.year_2024, co.year_2025) as max_amount,
    co.latitude,
    co.longitude,
    co.address1,
    co.city,
    co.general_department,
    co.quality,
    rd.next_renewal_date as next_renewal,
    COALESCE(tc.has_training_orders, false) as has_training
  FROM company_orders co
  LEFT JOIN renewal_dates rd ON rd.sipi_number = co.sipi_number
  LEFT JOIN training_check tc ON tc.sipi_number = co.sipi_number
  WHERE (co.year_2023 > 0 OR co.year_2024 > 0 OR co.year_2025 > 0)
    AND co.year_2023 <= max_threshold
    AND co.year_2024 <= max_threshold
    AND co.year_2025 <= max_threshold
  ORDER BY max_amount DESC;
END;
$$;