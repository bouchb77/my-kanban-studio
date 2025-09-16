-- Modifier les politiques RLS de la table orders pour permettre à tous les utilisateurs authentifiés de consulter les données de reporting

-- Supprimer l'ancienne politique restrictive
DROP POLICY IF EXISTS "Only admins can view orders" ON public.orders;

-- Créer une nouvelle politique qui permet à tous les utilisateurs authentifiés de voir les commandes (en lecture seule)
CREATE POLICY "All authenticated users can view orders for reporting" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (true);

-- Garder les restrictions d'écriture pour les admins seulement
-- (les autres politiques restent inchangées)