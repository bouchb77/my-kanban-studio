-- Fonction optimisée pour calculer les statistiques des entreprises avec leurs commandes
-- Cette fonction remplace le traitement côté client et améliore drastiquement les performances

CREATE OR REPLACE FUNCTION public.get_company_stats_optimized(max_threshold numeric DEFAULT 999999999)
RETURNS TABLE (
  company_id uuid,
  sipi_number text,
  company_name text,
  year1 integer,
  year2 integer,
  amount1 numeric,
  amount2 numeric,
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH company_orders AS (
    -- Agrégation des commandes par entreprise et par période
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
      -- Période 2023-2024 (01/01/2023 au 31/12/2024)
      COALESCE(SUM(o.amount) FILTER (
        WHERE o.order_date >= '2023-01-01'::date 
        AND o.order_date <= '2024-12-31'::date
      ), 0) as period_2023_2024,
      -- Période 2024-2025 (01/01/2024 au 31/12/2025)
      COALESCE(SUM(o.amount) FILTER (
        WHERE o.order_date >= '2024-01-01'::date 
        AND o.order_date <= '2025-12-31'::date
      ), 0) as period_2024_2025,
      -- Détection des formations (FSITE ou FSITEJ)
      bool_or(od.article_code IN ('FSITE', 'FSITEJ')) as has_training_orders
    FROM public.companies c
    LEFT JOIN public.orders o ON o.sipi_number = c.sipi_number
    LEFT JOIN public.order_details od ON od.order_number = o.order_number
    WHERE c.latitude IS NOT NULL 
      AND c.longitude IS NOT NULL
    GROUP BY c.id, c.sipi_number, c.company_name, c.latitude, c.longitude, 
             c.address1, c.city, c.general_department, c.quality
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
    2023 as year1,
    2024 as year2,
    co.period_2023_2024 as amount1,
    co.period_2024_2025 as amount2,
    GREATEST(co.period_2023_2024, co.period_2024_2025) as max_amount,
    co.latitude,
    co.longitude,
    co.address1,
    co.city,
    co.general_department,
    co.quality,
    rd.next_renewal_date as next_renewal,
    COALESCE(co.has_training_orders, false) as has_training
  FROM company_orders co
  LEFT JOIN renewal_dates rd ON rd.sipi_number = co.sipi_number
  WHERE (co.period_2023_2024 > 0 OR co.period_2024_2025 > 0)
    AND co.period_2023_2024 <= max_threshold
    AND co.period_2024_2025 <= max_threshold
  ORDER BY max_amount DESC;
END;
$$;

-- Ajouter un commentaire pour documenter la fonction
COMMENT ON FUNCTION public.get_company_stats_optimized IS 
'Calcule les statistiques des entreprises avec leurs commandes sur deux périodes (2023-2024 et 2024-2025), 
inclut la prochaine date de renouvellement et détecte les formations. Optimisé pour les performances.';
