-- Modifier get_fo_training_data pour ne pas filtrer sur report_creation_date pour les payantes
CREATE OR REPLACE FUNCTION public.get_fo_training_data(_formateur text, _year integer)
RETURNS TABLE(
  sipi_number text, 
  company_name text, 
  report_creation_date date, 
  paid_orders_count bigint, 
  paid_orders_amount numeric, 
  all_orders_count_year bigint, 
  all_orders_amount_year numeric, 
  avg_order_amount_historical numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH formateur_departments AS (
    -- Get departments for this formateur
    SELECT dm.department_name
    FROM department_management dm
    WHERE dm.formateur = _formateur
  ),
  sector_companies AS (
    -- All companies in the formateur's sector
    SELECT 
      c.sipi_number,
      c.company_name,
      c.report_creation_date::date as report_date
    FROM companies c
    WHERE c.general_department IN (SELECT fd.department_name FROM formateur_departments fd)
  ),
  paid_orders AS (
    -- Companies with FSITE/FSITEJ orders in the year (no report_creation_date filter)
    SELECT 
      o.sipi_number as order_sipi,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(SUM(o.amount), 0) as total_amount
    FROM orders o
    INNER JOIN order_details od ON od.order_number = o.order_number
    WHERE od.article_code IN ('FSITE', 'FSITEJ')
      AND EXTRACT(YEAR FROM o.order_date) = _year
      AND o.sipi_number IN (SELECT sc.sipi_number FROM sector_companies sc)
    GROUP BY o.sipi_number
  ),
  all_orders_year AS (
    -- All orders for sector companies in the year
    SELECT 
      o.sipi_number as order_sipi,
      COUNT(*) as order_count,
      COALESCE(SUM(o.amount), 0) as total_amount
    FROM orders o
    WHERE EXTRACT(YEAR FROM o.order_date) = _year
      AND o.sipi_number IN (SELECT sc.sipi_number FROM sector_companies sc)
    GROUP BY o.sipi_number
  ),
  historical_avg AS (
    -- Average order amount for all time
    SELECT 
      o.sipi_number as order_sipi,
      CASE 
        WHEN COUNT(*) > 0 THEN COALESCE(SUM(o.amount), 0) / COUNT(*)
        ELSE 0
      END as avg_amount
    FROM orders o
    WHERE o.sipi_number IN (SELECT sc.sipi_number FROM sector_companies sc)
    GROUP BY o.sipi_number
  ),
  paid_trainings AS (
    -- Companies with paid orders (formation payante)
    SELECT 
      sc.sipi_number,
      sc.company_name,
      sc.report_date,
      po.order_count as paid_orders_count,
      po.total_amount as paid_orders_amount,
      COALESCE(aoy.order_count, 0) as all_orders_count_year,
      COALESCE(aoy.total_amount, 0) as all_orders_amount_year,
      COALESCE(ha.avg_amount, 0) as avg_order_amount_historical
    FROM paid_orders po
    JOIN sector_companies sc ON sc.sipi_number = po.order_sipi
    LEFT JOIN all_orders_year aoy ON aoy.order_sipi = sc.sipi_number
    LEFT JOIN historical_avg ha ON ha.order_sipi = sc.sipi_number
  ),
  free_trainings AS (
    -- Companies with report_creation_date in year but no paid orders (formation gratuite)
    SELECT 
      sc.sipi_number,
      sc.company_name,
      sc.report_date,
      0::bigint as paid_orders_count,
      0::numeric as paid_orders_amount,
      COALESCE(aoy.order_count, 0) as all_orders_count_year,
      COALESCE(aoy.total_amount, 0) as all_orders_amount_year,
      COALESCE(ha.avg_amount, 0) as avg_order_amount_historical
    FROM sector_companies sc
    LEFT JOIN all_orders_year aoy ON aoy.order_sipi = sc.sipi_number
    LEFT JOIN historical_avg ha ON ha.order_sipi = sc.sipi_number
    WHERE EXTRACT(YEAR FROM sc.report_date) = _year
      AND sc.sipi_number NOT IN (SELECT pt.sipi_number FROM paid_trainings pt)
  )
  -- Combine paid and free trainings
  SELECT * FROM paid_trainings
  UNION ALL
  SELECT * FROM free_trainings
  ORDER BY report_creation_date DESC;
END;
$function$;