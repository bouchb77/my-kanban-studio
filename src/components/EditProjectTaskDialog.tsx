import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ProjectTask, ProjectCollaborator } from '@/types/project';
import { useProjectTasks } from '@/hooks/useProjects';
import { format } from 'date-fns';

interface EditProjectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTask | null;
  collaborators: ProjectCollaborator[];
  onSuccess: () => void;
}

export const EditProjectTaskDialog: React.FC<EditProjectTaskDialogProps> = ({
  open,
  onOpenChange,
  task,
  collaborators,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'review' | 'done'>('todo');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const { updateTask, assignTask } = useProjectTasks(task?.project_id || '');

  useEffect(() => {
    if (task && open) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStartDate(format(new Date(task.start_date), 'yyyy-MM-dd'));
      setEndDate(format(new Date(task.end_date), 'yyyy-MM-dd'));
      setPriority(task.priority);
      setStatus(task.status);
      setProgress(task.progress);
      setAssignedUserIds(task.assignments?.map(a => a.user_id) || []);
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    try {
      // Update task details
      await updateTask(task.id, {
        title,
        description: description.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        priority,
        status,
        progress
      });

      // Update assignments
      await assignTask(task.id, assignedUserIds);

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const toggleAssignment = (userId: string) => {
    setAssignedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Modifier la tâche</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Titre de la tâche</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la tâche"
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
              <Label htmlFor="status">Statut global</Label>
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
            <Label htmlFor="progress">Progression globale (%)</Label>
            <Input
              id="progress"
              type="number"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </div>

          <div>
            <Label>Assignés</Label>
            <div className="space-y-2 mt-2">
              {collaborators.map((collaborator) => (
                <div key={collaborator.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`assignee-${collaborator.user_id}`}
                    checked={assignedUserIds.includes(collaborator.user_id)}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit">Modifier</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};