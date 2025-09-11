import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Settings, Clock } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Project } from '@/types/project';
import { EditProjectDialog } from '@/components/EditProjectDialog';
import { CreateProjectTrigger } from '@/components/CreateProjectDialog';

const statusLabels = {
  planning: { label: 'Planification', color: 'bg-blue-500' },
  active: { label: 'Actif', color: 'bg-green-500' },
  'on_hold': { label: 'En pause', color: 'bg-yellow-500' },
  completed: { label: 'Terminé', color: 'bg-gray-500' },
  cancelled: { label: 'Annulé', color: 'bg-red-500' },
};

const ProjectCard: React.FC<{ project: any; onEdit: (project: Project) => void }> = ({ project, onEdit }) => {
  const navigate = useNavigate();
  const statusInfo = statusLabels[project.status as keyof typeof statusLabels];

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(project);
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1">{project.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {project.description || 'Aucune description'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <Badge 
            className="text-white border-none"
            style={{ backgroundColor: statusInfo.color }}
          >
            {statusInfo.label}
          </Badge>
          
          <div className="flex items-center space-x-3 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>1</span>
            </div>
          </div>
        </div>

        {(project.start_date || project.end_date) && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
            <Calendar className="w-4 h-4" />
            <span>
              {project.start_date && format(new Date(project.start_date), 'dd MMM', { locale: fr })}
              {project.start_date && project.end_date && ' - '}
              {project.end_date && format(new Date(project.end_date), 'dd MMM yyyy', { locale: fr })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Créé le {format(new Date(project.created_at), 'dd/MM/yyyy', { locale: fr })}
          </span>
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>
              {format(new Date(project.updated_at), 'dd/MM', { locale: fr })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProjectsPage: React.FC = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const navigate = useNavigate();
  const { projects, loading, refetch } = useProjects();

  const handleCreateProject = () => {
    setShowCreateDialog(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowEditDialog(true);
  };

  const handleProjectCreated = () => {
    setShowCreateDialog(false);
    refetch();
  };

  const handleProjectUpdated = () => {
    setShowEditDialog(false);
    setEditingProject(null);
    refetch();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Projets</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Trier les projets par statut avec les actifs en haut
  const sortedProjects = [...projects].sort((a, b) => {
    const statusOrder = {
      'active': 0,
      'planning': 1,
      'on_hold': 2,
      'completed': 3,
      'cancelled': 4
    };
    
    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 5;
    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 5;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // Si même statut, trier par date de mise à jour décroissante
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Projets</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos projets collaboratifs
          </p>
        </div>
        <CreateProjectTrigger onSuccess={refetch} />
      </div>

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Aucun projet</h3>
                <p className="text-muted-foreground mb-4">
                  Créez votre premier projet pour commencer à collaborer
                </p>
        <CreateProjectTrigger onSuccess={refetch} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} onEdit={handleEditProject} />
          ))}
        </div>
      )}

      <EditProjectDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        project={editingProject}
        onSuccess={handleProjectUpdated}
      />
    </div>
  );
};

export default ProjectsPage;