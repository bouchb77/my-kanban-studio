-- Mise à jour des politiques RLS pour permettre l'accès public aux données des entreprises pour le reporting
DROP POLICY IF EXISTS "Anyone can view companies for reporting" ON companies;

-- Créer une politique pour permettre à tous (authentifiés et non-authentifiés) de voir les entreprises
CREATE POLICY "Public access to companies for reporting" 
ON companies 
FOR SELECT 
TO anon, authenticated
USING (true);