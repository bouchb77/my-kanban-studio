import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Calendar, MessageSquare, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useProjects, useProjectCollaborators, useProjectTasks } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { Project, ProjectTask } from '@/types/project';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EditProjectTaskDialog } from '@/components/EditProjectTaskDialog';
import { InviteCollaboratorDialog } from '@/components/InviteCollaboratorDialog';

const GanttChart: React.FC<{ tasks: ProjectTask[] }> = ({ tasks }) => {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucune tâche à afficher
      </div>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  const earliestStart = new Date(Math.min(...tasks.map(t => new Date(t.start_date).getTime())));
  const latestEnd = new Date(Math.max(...tasks.map(t => new Date(t.end_date).getTime())));
  const totalDays = differenceInDays(latestEnd, earliestStart) + 1;

  const getTaskPosition = (task: ProjectTask) => {
    const startDiff = differenceInDays(new Date(task.start_date), earliestStart);
    const duration = differenceInDays(new Date(task.end_date), new Date(task.start_date)) + 1;
    
    return {
      left: `${(startDiff / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'review': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-muted-foreground mb-4">
        <span>{format(earliestStart, 'dd MMM yyyy', { locale: fr })}</span>
        <span>{format(latestEnd, 'dd MMM yyyy', { locale: fr })}</span>
      </div>
      
      <div className="space-y-3">
        {sortedTasks.map((task) => {
          const position = getTaskPosition(task);
          return (
            <div key={task.id} className="flex items-center space-x-4">
              <div className="w-48 text-sm font-medium truncate">
                {task.title}
              </div>
              
              <div className="flex-1 relative h-8 bg-muted rounded">
                <div
                  className={`absolute top-1 bottom-1 rounded ${getStatusColor(task.status)} flex items-center px-1`}
                  style={position}
                >
                  {Array.from({ length: differenceInDays(new Date(task.end_date), new Date(task.start_date)) + 1 }, (_, index) => (
                    <div
                      key={index}
                      className="w-2 h-4 bg-white/30 border border-white/50 mr-0.5 last:mr-0 rounded-sm"
                    />
                  ))}
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground w-20">
                {differenceInDays(new Date(task.end_date), new Date(task.start_date)) + 1}j
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CreateTaskDialog: React.FC<{ projectId: string; collaborators: any[]; onSuccess: () => void }> = ({ 
  projectId, 
  collaborators, 
  onSuccess 
}) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'review' | 'done'>('todo');
  const [assignees, setAssignees] = useState<string[]>([]);
  const { createTask, assignTask } = useProjectTasks(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;

    const newTask = await createTask({
      project_id: projectId,
      title,
      description: description.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      priority,
      status,
      progress: 0,
      dependencies: []
    });

    if (newTask && assignees.length > 0) {
      await assignTask(newTask.id, assignees);
    }

    if (newTask) {
      setOpen(false);
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setPriority('medium');
      setStatus('todo');
      setAssignees([]);
      onSuccess();
    }
  };

  const toggleAssignment = (userId: string) => {
    setAssignees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle tâche
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle tâche</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Titre de la tâche</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ma nouvelle tâche"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de la tâche..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Date de début</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="endDate">Date de fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priorité</Label>
              <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Élevée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Statut</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="review">En révision</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Assignés</Label>
            <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
              {collaborators.map((collaborator) => (
                <div key={collaborator.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`assignee-${collaborator.user_id}`}
                    checked={assignees.includes(collaborator.user_id)}
                    onCheckedChange={() => toggleAssignment(collaborator.user_id)}
                  />
                  <Label htmlFor={`assignee-${collaborator.user_id}`} className="text-sm">
                    {collaborator.profiles?.full_name || collaborator.profiles?.email || 'Utilisateur'}
                  </Label>
                </div>
              ))}
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

const TaskCard: React.FC<{ task: ProjectTask; onUpdate: () => void; collaborators: any[]; onEdit: (task: ProjectTask) => void }> = ({ task, onUpdate, collaborators, onEdit }) => {
  const [comment, setComment] = useState('');
  const { addComment, updateAssignmentStatus } = useProjectTasks(task.project_id);
  const { user } = useAuth();

  const handleUpdateMyStatus = async (assignmentId: string, status: string, progress: number) => {
    if (user) {
      await updateAssignmentStatus(assignmentId, user.id, { status, progress });
      onUpdate();
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    
    await addComment(task.id, comment);
    setComment('');
    onUpdate();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'review': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{task.title}</CardTitle>
            {task.description && (
              <CardDescription className="mt-1">
                {task.description}
              </CardDescription>
            )}
          </div>
          <div className="flex space-x-2">
            <Badge className={`text-white border-none ${getPriorityColor(task.priority)}`}>
              {task.priority === 'high' ? 'Élevée' : task.priority === 'medium' ? 'Moyenne' : 'Faible'}
            </Badge>
            <Badge className={`text-white border-none ${getStatusColor(task.status)}`}>
              {task.status === 'todo' ? 'À faire' : 
               task.status === 'in_progress' ? 'En cours' :
               task.status === 'review' ? 'En révision' : 'Terminé'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>
                {format(parseISO(task.start_date), 'dd MMM', { locale: fr })} - 
                {format(parseISO(task.end_date), 'dd MMM', { locale: fr })}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>
                {differenceInDays(parseISO(task.end_date), parseISO(task.start_date)) + 1}j
              </span>
            </div>
          </div>
          
          {task.assignments && task.assignments.length > 0 && (
            <div className="flex items-center space-x-1">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                {task.assignments.length} assigné(s)
              </span>
            </div>
          )}
        </div>

        {/* Affichage des assignations individuelles */}
        {task.assignments && task.assignments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Assignations</span>
              <Button size="sm" variant="outline" onClick={() => onEdit(task)}>
                Modifier
              </Button>
            </div>
            
            {task.assignments.map((assignment) => (
              <div key={assignment.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {assignment.profiles?.full_name || assignment.profiles?.email || 'Utilisateur'}
                    </span>
                  </div>
                  <Badge className={`text-white border-none ${getStatusColor(assignment.status?.status || 'todo')}`}>
                    {assignment.status?.status === 'todo' ? 'À faire' : 
                     assignment.status?.status === 'in_progress' ? 'En cours' :
                     assignment.status?.status === 'review' ? 'En révision' : 'Terminé'}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Progression</span>
                    <span className="text-xs text-muted-foreground">{assignment.status?.progress || 0}%</span>
                  </div>
                  <Progress value={assignment.status?.progress || 0} className="h-1" />
                  
                  {user && assignment.user_id === user.id && (
                    <div className="flex items-center space-x-2 pt-2">
                      <Select 
                        value={assignment.status?.status || 'todo'} 
                        onValueChange={(status) => handleUpdateMyStatus(assignment.id, status, assignment.status?.progress || 0)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">À faire</SelectItem>
                          <SelectItem value="in_progress">En cours</SelectItem>
                          <SelectItem value="review">En révision</SelectItem>
                          <SelectItem value="done">Terminé</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={assignment.status?.progress || 0}
                        onChange={(e) => handleUpdateMyStatus(assignment.id, assignment.status?.status || 'todo', Number(e.target.value))}
                        className="w-16 h-8 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progression globale de la tâche */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progression globale</span>
            <span className="text-sm text-muted-foreground">{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-2" />
        </div>

        {task.comments && task.comments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-1 text-sm font-medium">
              <MessageSquare className="w-4 h-4" />
              <span>Commentaires ({task.comments.length})</span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {task.comments.map((comment, index) => (
                <div key={index} className="bg-muted p-2 rounded text-sm">
                  <div className="font-medium text-xs text-muted-foreground mb-1">
                    {comment.profiles?.full_name || 'Utilisateur'} • 
                    {format(parseISO(comment.created_at), 'dd/MM à HH:mm', { locale: fr })}
                  </div>
                  <p>{comment.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleAddComment} className="flex space-x-2">
          <Input
            placeholder="Ajouter un commentaire..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm">
            <MessageSquare className="w-4 h-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { collaborators, refetch: refetchCollaborators } = useProjectCollaborators(id || '');
  const { tasks, refetch: refetchTasks } = useProjectTasks(id || '');
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const handleEditTask = (task: ProjectTask) => {
    setEditingTask(task);
    setShowEditDialog(true);
  };

  const handleInviteCollaborator = () => {
    setShowInviteDialog(true);
  };

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Projet non trouvé</h1>
          <Button className="mt-4" onClick={() => navigate('/projects')}>
            Retour aux projets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge style={{ backgroundColor: project.color, color: 'white' }}>
            {project.status}
          </Badge>
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{collaborators.length}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tasks">Tâches</TabsTrigger>
          <TabsTrigger value="gantt">Diagramme de Gantt</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborateurs</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Tâches du projet</h2>
            <CreateTaskDialog 
              projectId={project.id} 
              collaborators={collaborators}
              onSuccess={refetchTasks}
            />
          </div>

          {tasks.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Aucune tâche</h3>
                    <p className="text-muted-foreground mb-4">
                      Créez votre première tâche pour commencer
                    </p>
                    <CreateTaskDialog 
                      projectId={project.id} 
                      collaborators={collaborators}
                      onSuccess={refetchTasks}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {[...tasks].sort((a, b) => 
                new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
              ).map((task) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdate={refetchTasks} 
                  collaborators={collaborators}
                  onEdit={handleEditTask}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gantt" className="space-y-6">
          <h2 className="text-xl font-semibold">Diagramme de Gantt</h2>
          <Card>
            <CardContent className="p-6">
              <GanttChart tasks={tasks} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collaborators" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Collaborateurs</h2>
            <Button onClick={handleInviteCollaborator}>
              <Plus className="w-4 h-4 mr-2" />
              Inviter
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collaborators.map((collaborator) => (
              <Card key={collaborator.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">
                        {collaborator.profiles?.full_name || 'Utilisateur'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {collaborator.profiles?.email}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {collaborator.role}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <EditProjectTaskDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        task={editingTask}
        collaborators={collaborators}
        onSuccess={refetchTasks}
      />

      <InviteCollaboratorDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        projectId={project.id}
        onSuccess={refetchCollaborators}
      />
    </div>
  );
};

export default ProjectDetailPage;