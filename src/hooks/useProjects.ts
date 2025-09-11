import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, ProjectCollaborator, ProjectTask } from '@/types/project';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadProjects = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_collaborators!inner(
            role,
            profiles(full_name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data as Project[] || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les projets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (projectData: Omit<Project, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          owner_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as collaborator
      await supabase
        .from('project_collaborators')
        .insert({
          project_id: data.id,
          user_id: user.id,
          role: 'owner'
        });

      await loadProjects();
      toast({
        title: "Succès",
        description: "Projet créé avec succès",
      });
      
      return data;
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le projet",
        variant: "destructive",
      });
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      await loadProjects();
      toast({
        title: "Succès",
        description: "Projet mis à jour",
      });
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le projet",
        variant: "destructive",
      });
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      await loadProjects();
      toast({
        title: "Succès",
        description: "Projet supprimé",
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le projet",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    refetch: loadProjects
  };
};

export const useProjectCollaborators = (projectId: string) => {
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadCollaborators = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('project_collaborators')
        .select(`
          *,
          profiles(full_name, email)
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      setCollaborators(data as ProjectCollaborator[] || []);
    } catch (error) {
      console.error('Error loading collaborators:', error);
    } finally {
      setLoading(false);
    }
  };

  const inviteCollaborator = async (email: string, role: 'admin' | 'member' | 'viewer' = 'member') => {
    try {
      // Find user by email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (profileError || !profiles) {
        toast({
          title: "Erreur",
          description: "Utilisateur non trouvé",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: projectId,
          user_id: profiles.id,
          role
        });

      if (error) throw error;

      await loadCollaborators();
      toast({
        title: "Succès",
        description: "Collaborateur invité",
      });
    } catch (error) {
      console.error('Error inviting collaborator:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'inviter le collaborateur",
        variant: "destructive",
      });
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;

      await loadCollaborators();
      toast({
        title: "Succès",
        description: "Collaborateur retiré",
      });
    } catch (error) {
      console.error('Error removing collaborator:', error);
      toast({
        title: "Erreur",
        description: "Impossible de retirer le collaborateur",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadCollaborators();
  }, [projectId]);

  return {
    collaborators,
    loading,
    inviteCollaborator,
    removeCollaborator,
    refetch: loadCollaborators
  };
};

export const useProjectTasks = (projectId: string) => {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadTasks = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          project_task_assignments(
            *,
            profiles(full_name, email)
          ),
          project_task_comments(
            *,
            profiles(full_name, email)
          )
        `)
        .eq('project_id', projectId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setTasks(data as ProjectTask[] || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (taskData: Omit<ProjectTask, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'assignments' | 'comments'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .insert({
          ...taskData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      await loadTasks();
      toast({
        title: "Succès",
        description: "Tâche créée",
      });
      
      return data;
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche",
        variant: "destructive",
      });
    }
  };

  const updateTask = async (taskId: string, updates: Partial<ProjectTask>) => {
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      await loadTasks();
      toast({
        title: "Succès",
        description: "Tâche mise à jour",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la tâche",
        variant: "destructive",
      });
    }
  };

  const addComment = async (taskId: string, comment: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('project_task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          comment
        });

      if (error) throw error;

      await loadTasks();
      toast({
        title: "Succès",
        description: "Commentaire ajouté",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le commentaire",
        variant: "destructive",
      });
    }
  };

  const assignTask = async (taskId: string, userIds: string[]) => {
    try {
      // Remove existing assignments
      await supabase
        .from('project_task_assignments')
        .delete()
        .eq('task_id', taskId);

      // Add new assignments
      if (userIds.length > 0) {
        const assignments = userIds.map(userId => ({
          task_id: taskId,
          user_id: userId
        }));

        const { error } = await supabase
          .from('project_task_assignments')
          .insert(assignments);

        if (error) throw error;
      }

      await loadTasks();
      toast({
        title: "Succès",
        description: "Affectations mises à jour",
      });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les affectations",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    addComment,
    assignTask,
    refetch: loadTasks
  };
};