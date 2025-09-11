import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock, User, Flag, Users, CheckCircle, Trash2 } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ProjectTask } from "@/types/project";
import { useProjectTasks } from "@/hooks/useProjects";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ViewProjectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTask | null;
  onTaskDeleted?: () => void;
}

export function ViewProjectTaskDialog({ open, onOpenChange, task, onTaskDeleted }: ViewProjectTaskDialogProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteTask, checkIsProjectAdmin } = useProjectTasks(task?.project_id || '');

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (task?.project_id) {
        const adminStatus = await checkIsProjectAdmin(task.project_id);
        setIsAdmin(adminStatus);
      }
    };
    checkAdminStatus();
  }, [task?.project_id, checkIsProjectAdmin]);

  const handleDeleteTask = async () => {
    if (!task) return;
    
    setIsDeleting(true);
    try {
      await deleteTask(task.id);
      toast({
        title: "Tâche supprimée",
        description: "La tâche a été supprimée avec succès.",
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
      onTaskDeleted?.();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la tâche. Vous n'avez peut-être pas les droits nécessaires.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  if (!task) {
    return null;
  }

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'À faire';
      case 'in_progress': return 'En cours';
      case 'review': return 'En révision';
      case 'done': return 'Terminé';
      default: return status;
    }
  };

  const globalProgress = task.assignments && task.assignments.length > 0 
    ? task.assignments.reduce((sum, assignment) => sum + (assignment.status?.progress || 0), 0) / task.assignments.length
    : task.progress;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Détails de la tâche</span>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Title and Description */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{task.title}</h2>
            {task.description && (
              <div className="text-muted-foreground bg-muted/30 p-3 rounded-md">
                <p className="whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
          </div>

          {/* Status, Priority, and Dates */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Flag className="w-4 h-4" />
                Statut
              </div>
              <Badge className={`text-white border-none ${getStatusColor(task.status)}`}>
                {getStatusLabel(task.status)}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Flag className="w-4 h-4" />
                Priorité
              </div>
              <Badge className={`text-white border-none ${getPriorityColor(task.priority)}`}>
                {task.priority === 'high' ? 'Élevée' : task.priority === 'medium' ? 'Moyenne' : 'Faible'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Date de début
              </div>
              <span className="text-sm">
                {format(parseISO(task.start_date), 'dd MMM yyyy', { locale: fr })}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Date de fin
              </div>
              <span className="text-sm">
                {format(parseISO(task.end_date), 'dd MMM yyyy', { locale: fr })}
              </span>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="w-4 h-4" />
              Durée
            </div>
            <span className="text-sm">
              {differenceInDays(parseISO(task.end_date), parseISO(task.start_date)) + 1} jours
            </span>
          </div>

          {/* Global Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle className="w-4 h-4" />
                Progression globale
              </div>
              <span className="text-sm text-muted-foreground">{Math.round(globalProgress)}%</span>
            </div>
            <Progress value={globalProgress} className="h-2" />
          </div>

          {/* Collaborators Progress */}
          {task.assignments && task.assignments.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Users className="w-5 h-5" />
                Avancement par collaborateur ({task.assignments.length})
              </div>
              
              <div className="space-y-4">
                {task.assignments.map((assignment) => (
                  <div key={assignment.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-sm">
                            {(assignment.profiles?.full_name || assignment.profiles?.email || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {assignment.profiles?.full_name || assignment.profiles?.email || 'Utilisateur'}
                          </div>
                          {assignment.profiles?.email && assignment.profiles?.full_name && (
                            <div className="text-sm text-muted-foreground">
                              {assignment.profiles.email}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={`text-white border-none ${getStatusColor(assignment.status?.status || 'todo')}`}>
                          {getStatusLabel(assignment.status?.status || 'todo')}
                        </Badge>
                        <span className="text-sm text-muted-foreground min-w-[3rem] text-right">
                          {assignment.status?.progress || 0}%
                        </span>
                      </div>
                    </div>
                    
                    <Progress value={assignment.status?.progress || 0} className="h-2" />
                    
                    {assignment.status?.updated_at && (
                      <div className="text-xs text-muted-foreground">
                        Dernière mise à jour: {format(parseISO(assignment.status.updated_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section */}
          {task.comments && task.comments.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Users className="w-5 h-5" />
                Commentaires ({task.comments.length})
              </div>
              
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {task.comments.map((comment, index) => (
                  <div key={index} className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">
                        {comment.profiles?.full_name || comment.profiles?.email || 'Utilisateur'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(comment.created_at), 'dd MMM à HH:mm', { locale: fr })}
                      </div>
                    </div>
                    <p className="text-sm">{comment.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="w-4 h-4" />
                Créée le
              </div>
              <span className="text-sm">
                {format(parseISO(task.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="w-4 h-4" />
                Modifiée le
              </div>
              <span className="text-sm">
                {format(parseISO(task.updated_at), "dd MMM yyyy à HH:mm", { locale: fr })}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la tâche</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible et supprimera également tous les commentaires et assignations liés à cette tâche.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}