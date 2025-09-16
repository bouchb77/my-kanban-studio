-- Ajouter un système d'approbation pour les nouveaux utilisateurs

-- Ajouter une colonne approved à la table profiles
ALTER TABLE public.profiles 
ADD COLUMN approved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN approved_by UUID REFERENCES public.profiles(id);

-- Créer une nouvelle politique RLS pour que seuls les utilisateurs approuvés puissent accéder aux données
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Only approved users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  -- L'utilisateur peut voir son propre profil même s'il n'est pas approuvé
  auth.uid() = id 
  OR 
  -- L'utilisateur peut voir les autres profils seulement s'il est approuvé
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true))
  OR
  -- Les admins peuvent tout voir
  public.is_current_user_admin()
);

-- Mettre à jour la fonction handle_new_user pour créer des utilisateurs non approuvés par défaut
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, approved)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name', false);
  RETURN new;
END;
$$;

-- Ajouter des politiques pour les autres tables pour que seuls les utilisateurs approuvés puissent y accéder
CREATE POLICY "Only approved users can access tasks" 
ON public.tasks 
FOR ALL 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  OR public.is_current_user_admin()
);

CREATE POLICY "Only approved users can access projects" 
ON public.projects 
FOR ALL 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  OR public.is_current_user_admin()
);

-- Fonction pour approuver un utilisateur (réservée aux admins)
CREATE OR REPLACE FUNCTION public.approve_user(user_id_to_approve UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que l'utilisateur actuel est admin
  IF NOT public.is_current_user_admin() THEN
    RETURN FALSE;
  END IF;
  
  -- Approuver l'utilisateur
  UPDATE public.profiles 
  SET 
    approved = true,
    approved_at = now(),
    approved_by = auth.uid()
  WHERE id = user_id_to_approve;
  
  RETURN FOUND;
END;
$$;