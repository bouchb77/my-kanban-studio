
-- Fix all ambiguous sipi_number references in get_fo_training_data
DROP FUNCTION IF EXISTS public.get_fo_training_data(text, integer);

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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH formateur_departments AS (
    -- Get departments for this formateur
    SELECT department_name
    FROM department_management
    WHERE formateur = _formateur
  ),
  trained_companies AS (
    -- Get companies with report_creation_date in the selected year
    SELECT 
      c.sipi_number,
      c.company_name,
      c.report_creation_date::date as report_date
    FROM companies c
    WHERE c.general_department IN (SELECT department_name FROM formateur_departments)
      AND EXTRACT(YEAR FROM c.report_creation_date) = _year
  ),
  paid_orders AS (
    -- Get orders with FSITE/FSITEJ articles in the year
    SELECT 
      o.sipi_number as order_sipi,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(SUM(o.amount), 0) as total_amount
    FROM orders o
    INNER JOIN order_details od ON od.order_number = o.order_number
    WHERE od.article_code IN ('FSITE', 'FSITEJ')
      AND EXTRACT(YEAR FROM o.order_date) = _year
      AND o.sipi_number IN (SELECT tc.sipi_number FROM trained_companies tc)
    GROUP BY o.sipi_number
  ),
  all_orders_year AS (
    -- Get ALL orders for trained companies in the year
    SELECT 
      o.sipi_number as order_sipi,
      COUNT(*) as order_count,
      COALESCE(SUM(o.amount), 0) as total_amount
    FROM orders o
    WHERE EXTRACT(YEAR FROM o.order_date) = _year
      AND o.sipi_number IN (SELECT tc.sipi_number FROM trained_companies tc)
    GROUP BY o.sipi_number
  ),
  historical_avg AS (
    -- Calculate average order amount for all time
    SELECT 
      o.sipi_number as order_sipi,
      CASE 
        WHEN COUNT(*) > 0 THEN COALESCE(SUM(o.amount), 0) / COUNT(*)
        ELSE 0
      END as avg_amount
    FROM orders o
    WHERE o.sipi_number IN (SELECT tc.sipi_number FROM trained_companies tc)
    GROUP BY o.sipi_number
  )
  SELECT 
    tc.sipi_number,
    tc.company_name,
    tc.report_date,
    COALESCE(po.order_count, 0) as paid_orders_count,
    COALESCE(po.total_amount, 0) as paid_orders_amount,
    COALESCE(aoy.order_count, 0) as all_orders_count_year,
    COALESCE(aoy.total_amount, 0) as all_orders_amount_year,
    COALESCE(ha.avg_amount, 0) as avg_order_amount_historical
  FROM trained_companies tc
  LEFT JOIN paid_orders po ON po.order_sipi = tc.sipi_number
  LEFT JOIN all_orders_year aoy ON aoy.order_sipi = tc.sipi_number
  LEFT JOIN historical_avg ha ON ha.order_sipi = tc.sipi_number
  ORDER BY tc.report_date DESC;
END;
$$;
