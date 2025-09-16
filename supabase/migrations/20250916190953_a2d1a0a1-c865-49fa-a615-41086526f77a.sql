-- Corriger le problème de récursion infinie dans les politiques RLS

-- Créer une fonction SECURITY DEFINER pour vérifier si l'utilisateur est approuvé
CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT approved FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Supprimer les anciennes politiques problématiques
DROP POLICY IF EXISTS "Only approved users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only approved users can access tasks" ON public.tasks;
DROP POLICY IF EXISTS "Only approved users can access projects" ON public.projects;

-- Recréer les politiques sans récursion
CREATE POLICY "Users can view profiles if approved or own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  -- L'utilisateur peut voir son propre profil même s'il n'est pas approuvé
  auth.uid() = id 
  OR 
  -- L'utilisateur peut voir les autres profils seulement s'il est approuvé
  public.is_user_approved()
  OR
  -- Les admins peuvent tout voir
  public.is_current_user_admin()
);

-- Pour les tâches, garder les politiques existantes et ajouter la vérification d'approbation
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Users can view own tasks" 
ON public.tasks 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  AND (public.is_user_approved() OR public.is_current_user_admin())
);

CREATE POLICY "Users can insert own tasks" 
ON public.tasks 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND (public.is_user_approved() OR public.is_current_user_admin())
);

CREATE POLICY "Users can update own tasks" 
ON public.tasks 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() = user_id 
  AND (public.is_user_approved() OR public.is_current_user_admin())
);

CREATE POLICY "Users can delete own tasks" 
ON public.tasks 
FOR DELETE 
TO authenticated
USING (
  auth.uid() = user_id 
  AND (public.is_user_approved() OR public.is_current_user_admin())
);

-- Pour les projets, modifier les politiques existantes
DROP POLICY IF EXISTS "Users can view projects they own or collaborate on" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Project owners can update their projects" ON public.projects;
DROP POLICY IF EXISTS "Project owners can delete their projects" ON public.projects;

CREATE POLICY "Users can view projects they own or collaborate on" 
ON public.projects 
FOR SELECT 
TO authenticated
USING (
  (owner_id = auth.uid() OR user_has_project_access(id, auth.uid()))
  AND (public.is_user_approved() OR public.is_current_user_admin())
);

CREATE POLICY "Users can create their own projects" 
ON public.projects 
FOR INSERT 
TO authenticated
WITH CHECK (
  owner_id = auth.uid() 
  AND (public.is_user_approved() OR public.is_current_user_admin())
);

CREATE POLICY "Project owners can update their projects" 
ON public.projects 
FOR UPDATE 
TO authenticated
USING (
  owner_id = auth.uid() 
  AND (public.is_user_approved() OR public.is_current_user_admin())
);

CREATE POLICY "Project owners can delete their projects" 
ON public.projects 
FOR DELETE 
TO authenticated
USING (
  owner_id = auth.uid() 
  AND (public.is_user_approved() OR public.is_current_user_admin())
);