-- Ajouter la colonne expiration_date dans order_details
ALTER TABLE public.order_details
ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- Créer un index pour optimiser les recherches par date d'expiration
CREATE INDEX IF NOT EXISTS idx_order_details_expiration_date 
ON public.order_details(expiration_date) 
WHERE expiration_date IS NOT NULL;

-- Commentaire sur la colonne
COMMENT ON COLUMN public.order_details.expiration_date IS 'Date d''expiration du produit commandé';