import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Users, CheckSquare, Clock } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  end_date: string;
  userStatus: string;
}

interface ProjectWithTasks {
  id: string;
  name: string;
  color: string;
  status: string;
  currentTasks: ProjectTask[];
  nextTask: ProjectTask | null;
  progress: number;
}

const statusLabels = {
  planning: { label: 'Planification', color: 'bg-blue-500' },
  active: { label: 'Actif', color: 'bg-green-500' },
  'on_hold': { label: 'En pause', color: 'bg-yellow-500' },
  completed: { label: 'Terminé', color: 'bg-gray-500' },
  cancelled: { label: 'Annulé', color: 'bg-red-500' },
};

export const ProjectsOverview: React.FC = () => {
  const { projects, loading } = useProjects();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projectsWithTasks, setProjectsWithTasks] = useState<ProjectWithTasks[]>([]);

  useEffect(() => {
    const loadProjectTasks = async () => {
      if (!user || !projects.length) return;

      const projectTasksData = await Promise.all(
        projects
          .filter(project => project.status === 'active' || project.status === 'planning')
          .slice(0, 3) // Limiter à 3 projets pour l'affichage
          .map(async (project) => {
            // Récupérer les tâches assignées à l'utilisateur avec leur statut personnel
            const { data: userAssignments } = await supabase
              .from('project_task_assignments')
              .select(`
                task_id,
                project_tasks!inner(*),
                project_task_assignment_status!left(*)
              `)
              .eq('user_id', user.id)
              .eq('project_tasks.project_id', project.id);

            if (!userAssignments?.length) {
              return {
                id: project.id,
                name: project.name,
                color: project.color,
                status: project.status,
                currentTasks: [],
                nextTask: null,
                progress: 0
              };
            }

            // Filtrer les tâches selon le statut personnel de l'utilisateur
            const userTasks = userAssignments
              .map(assignment => {
                const task = assignment.project_tasks;
                const userStatus = assignment.project_task_assignment_status?.[0]?.status || 'todo';
                return { ...task, userStatus };
              })
              .filter(task => task.userStatus !== 'done'); // Exclure les tâches terminées par l'utilisateur

            const currentTasks = userTasks.filter(task => 
              task.userStatus === 'in_progress' || task.userStatus === 'todo'
            );

            const nextTask = userTasks
              .filter(task => task.userStatus === 'todo')
              .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0] || null;

            // Calculer la progression basée sur les tâches de l'utilisateur
            const completedByUser = userAssignments.filter(assignment => 
              assignment.project_task_assignment_status?.[0]?.status === 'done'
            ).length;
            const totalUserTasks = userAssignments.length;
            const progress = totalUserTasks > 0 ? Math.round((completedByUser / totalUserTasks) * 100) : 0;

            return {
              id: project.id,
              name: project.name,
              color: project.color,
              status: project.status,
              currentTasks: currentTasks.slice(0, 3), // Limiter à 3 tâches
              nextTask,
              progress
            };
          })
      );

      setProjectsWithTasks(projectTasksData);
    };

    loadProjectTasks();
  }, [projects, user]);

  if (loading) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle>Projets en cours</CardTitle>
          <CardDescription>Vos projets actifs et leurs tâches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projectsWithTasks.length === 0) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle>Projets en cours</CardTitle>
          <CardDescription>Vos projets actifs et leurs tâches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun projet actif pour le moment</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Projets en cours
        </CardTitle>
        <CardDescription>Vos projets actifs et leurs tâches</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projectsWithTasks.map((project) => {
            const statusInfo = statusLabels[project.status as keyof typeof statusLabels];
            
            return (
              <div 
                key={project.id}
                className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <h4 className="font-medium">{project.name}</h4>
                  </div>
                  <Badge 
                    className="text-white border-none text-xs"
                    style={{ backgroundColor: statusInfo.color }}
                  >
                    {statusInfo.label}
                  </Badge>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                    <span>Progression</span>
                    <span>{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Tâches en cours */}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span>En cours ({project.currentTasks.length})</span>
                    </div>
                    <div className="space-y-1">
                      {project.currentTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucune tâche en cours</p>
                      ) : (
                        project.currentTasks.map((task) => (
                          <div key={task.id} className="text-xs p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                            <div className="font-medium truncate">{task.title}</div>
                            <div className="text-muted-foreground flex items-center justify-between">
                              <span>Priorité: {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🔵'}</span>
                              <span className="text-xs">
                                {task.userStatus === 'in_progress' ? 'En cours' : 'À faire'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Prochaine tâche */}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span>Prochaine tâche</span>
                    </div>
                    {project.nextTask ? (
                      <div className="text-xs p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                        <div className="font-medium truncate">{project.nextTask.title}</div>
                        <div className="text-muted-foreground">
                          Début: {new Date(project.nextTask.start_date).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucune tâche planifiée</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {projects.length > 3 && (
            <div 
              className="text-center py-2 text-sm text-primary hover:text-primary/80 cursor-pointer transition-colors"
              onClick={() => navigate('/projects')}
            >
              Voir tous les projets ({projects.length})
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};