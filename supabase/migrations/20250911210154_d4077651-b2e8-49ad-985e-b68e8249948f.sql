-- Supprimer d'abord le trigger, puis la fonction, puis recréer les deux avec le search_path correct
DROP TRIGGER IF EXISTS trigger_notify_collaborators_on_comment ON public.project_task_comments;
DROP FUNCTION IF EXISTS public.notify_project_collaborators_on_comment();

CREATE OR REPLACE FUNCTION public.notify_project_collaborators_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  project_uuid uuid;
  collaborator_record RECORD;
  notification_message text;
  task_title text;
BEGIN
  -- Récupérer l'ID du projet et le titre de la tâche
  SELECT pt.project_id, pt.title 
  INTO project_uuid, task_title
  FROM public.project_tasks pt 
  WHERE pt.id = NEW.task_id;
  
  -- Créer le message de notification
  notification_message := 'Nouveau commentaire sur la tâche "' || task_title || '"';
  
  -- Notifier tous les collaborateurs du projet (sauf l'auteur du commentaire)
  FOR collaborator_record IN 
    SELECT DISTINCT pc.user_id
    FROM public.project_collaborators pc
    WHERE pc.project_id = project_uuid 
    AND pc.user_id != NEW.user_id
    
    UNION
    
    -- Inclure aussi le propriétaire du projet (sauf si c'est l'auteur du commentaire)
    SELECT p.owner_id
    FROM public.projects p
    WHERE p.id = project_uuid 
    AND p.owner_id != NEW.user_id
  LOOP
    -- Insérer une notification pour chaque collaborateur
    INSERT INTO public.user_notifications (
      user_id,
      notification_id,
      created_at,
      read
    )
    VALUES (
      collaborator_record.user_id,
      'comment_' || NEW.id::text,
      NOW(),
      false
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Recréer le trigger
CREATE TRIGGER trigger_notify_collaborators_on_comment
  AFTER INSERT ON public.project_task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_project_collaborators_on_comment();