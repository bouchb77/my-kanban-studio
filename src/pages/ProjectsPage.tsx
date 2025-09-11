import React, { useState } from 'react';
import { Plus, Users, Calendar, Clock, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects } from '@/hooks/useProjects';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusLabels = {
  planning: { label: 'Planification', color: 'bg-blue-500' },
  active: { label: 'Actif', color: 'bg-green-500' },
  'on_hold': { label: 'En pause', color: 'bg-yellow-500' },
  completed: { label: 'Terminé', color: 'bg-gray-500' },
  cancelled: { label: 'Annulé', color: 'bg-red-500' },
};

const CreateProjectDialog: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'>('planning');
  const [color, setColor] = useState('#3b82f6');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { createProject } = useProjects();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const success = await createProject({
      name,
      description: description.trim() || undefined,
      status,
      color,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    });

    if (success) {
      setOpen(false);
      setName('');
      setDescription('');
      setStatus('planning');
      setColor('#3b82f6');
      setStartDate('');
      setEndDate('');
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau projet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Créer un nouveau projet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom du projet</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mon nouveau projet"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du projet..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Statut</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="color">Couleur</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-9 p-1 border rounded"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Date de début</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">Date de fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ProjectCard: React.FC<{ project: any }> = ({ project }) => {
  const navigate = useNavigate();
  const statusInfo = statusLabels[project.status as keyof typeof statusLabels];

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
          <div 
            className="w-4 h-4 rounded-full flex-shrink-0 ml-3"
            style={{ backgroundColor: project.color }}
          />
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
  const { projects, loading, refetch } = useProjects();

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Projets</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos projets collaboratifs
          </p>
        </div>
        <CreateProjectDialog onSuccess={refetch} />
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
                <CreateProjectDialog onSuccess={refetch} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;