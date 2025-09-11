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
      console.log('Loading projects for user:', user.id);
      // Récupérer d'abord les projets sans les collaborateurs
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Projects query error:', projectsError);
        throw projectsError;
      }
      
      console.log('Projects loaded:', projectsData?.length || 0);
      setProjects(projectsData as Project[] || []);
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
      console.log('Creating project:', projectData);
      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          owner_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Project creation error:', error);
        throw error;
      }

      console.log('Project created:', data);

      // Add owner as collaborator
      const { error: collaboratorError } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: data.id,
          user_id: user.id,
          role: 'owner'
        });

      if (collaboratorError) {
        console.error('Collaborator creation error:', collaboratorError);
        // Don't throw here, project is still created
      }

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
      // Récupérer les collaborateurs avec les profils associés
      const { data: collaboratorsData, error: collaboratorsError } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', projectId);

      if (collaboratorsError) throw collaboratorsError;

      // Récupérer les profils des collaborateurs
      if (collaboratorsData && collaboratorsData.length > 0) {
        const userIds = collaboratorsData.map(c => c.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        if (profilesError) {
          console.warn('Could not load profiles:', profilesError);
        }

        // Combiner collaborateurs et profils
        const collaboratorsWithProfiles = collaboratorsData.map(collaborator => ({
          ...collaborator,
          profiles: profilesData?.find(profile => profile.id === collaborator.user_id)
        }));

        setCollaborators(collaboratorsWithProfiles as ProjectCollaborator[] || []);
      } else {
        setCollaborators([]);
      }
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

      // Check if user is already a collaborator
      const { data: existingCollaborator } = await supabase
        .from('project_collaborators')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', profiles.id)
        .single();

      if (existingCollaborator) {
        toast({
          title: "Erreur",
          description: "Cet utilisateur est déjà collaborateur",
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
      // Récupérer les tâches d'abord
      const { data: tasksData, error: tasksError } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true });

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // Récupérer les affectations
      const taskIds = tasksData.map(t => t.id);
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('project_task_assignments')
        .select('*')
        .in('task_id', taskIds);

      if (assignmentsError) {
        console.warn('Could not load assignments:', assignmentsError);
      }

      // Récupérer les statuts d'assignation
      const assignmentIds = assignmentsData?.map(a => a.id) || [];
      const { data: assignmentStatusData, error: assignmentStatusError } = await supabase
        .from('project_task_assignment_status')
        .select('*')
        .in('assignment_id', assignmentIds);

      if (assignmentStatusError) {
        console.warn('Could not load assignment status:', assignmentStatusError);
      }

      // Récupérer les commentaires
      const { data: commentsData, error: commentsError } = await supabase
        .from('project_task_comments')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.warn('Could not load comments:', commentsError);
      }

      // Récupérer les profils des utilisateurs concernés
      const allUserIds = new Set<string>();
      assignmentsData?.forEach(a => allUserIds.add(a.user_id));
      commentsData?.forEach(c => allUserIds.add(c.user_id));

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.warn('Could not load profiles:', profilesError);
      }

      // Combiner toutes les données
      const tasksWithDetails = tasksData.map(task => ({
        ...task,
        assignments: assignmentsData?.filter(a => a.task_id === task.id).map(assignment => ({
          ...assignment,
          profiles: profilesData?.find(p => p.id === assignment.user_id),
          status: assignmentStatusData?.find(s => s.assignment_id === assignment.id && s.user_id === assignment.user_id)
        })) || [],
        comments: commentsData?.filter(c => c.task_id === task.id).map(comment => ({
          ...comment,
          profiles: profilesData?.find(p => p.id === comment.user_id)
        })) || []
      }));

      setTasks(tasksWithDetails as ProjectTask[] || []);
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

        const { data: insertedAssignments, error } = await supabase
          .from('project_task_assignments')
          .insert(assignments)
          .select();

        if (error) throw error;

        // Create default status for each assignment
        if (insertedAssignments) {
          const statusEntries = insertedAssignments.map(assignment => ({
            assignment_id: assignment.id,
            user_id: assignment.user_id,
            status: 'todo' as const,
            progress: 0
          }));

          await supabase
            .from('project_task_assignment_status')
            .insert(statusEntries);
        }
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

  const updateAssignmentStatus = async (assignmentId: string, userId: string, updates: { status?: string; progress?: number }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('project_task_assignment_status')
        .upsert({
          assignment_id: assignmentId,
          user_id: userId,
          ...updates
        }, {
          onConflict: 'assignment_id,user_id'
        });

      if (error) throw error;

      await loadTasks();
      toast({
        title: "Succès",
        description: "Statut mis à jour",
      });
    } catch (error) {
      console.error('Error updating assignment status:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('delete_project_task', { task_uuid: taskId });

      if (error) throw error;
      if (!data) {
        throw new Error('Vous n\'avez pas les droits pour supprimer cette tâche');
      }

      await loadTasks();
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  };

  const checkIsProjectAdmin = async (projectId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .rpc('user_is_project_admin', { 
          project_uuid: projectId, 
          user_uuid: user.id 
        });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
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
    updateAssignmentStatus,
    deleteTask,
    checkIsProjectAdmin,
    refetch: loadTasks
  };
};