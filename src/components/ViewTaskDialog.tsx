import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock, User, Flag, Tag } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Task } from "@/types/task";
import { useUserColumns } from "@/hooks/useUserSettings";

interface ViewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onEdit?: (task: Task) => void;
}

export function ViewTaskDialog({ open, onOpenChange, task, onEdit }: ViewTaskDialogProps) {
  const { columns } = useUserColumns();

  // Default columns as fallback
  const defaultColumns = [
    { status: "todo", title: "À faire", color: "#64748b" },
    { status: "in-progress", title: "En cours", color: "#3b82f6" },
    { status: "review", title: "En révision", color: "#f59e0b" },
    { status: "done", title: "Terminé", color: "#10b981" },
  ];

  const availableColumns = columns.length > 0 ? columns : defaultColumns;
  const currentColumn = availableColumns.find(col => col.status === task?.status);

  const priorityLabels = {
    low: "Faible",
    medium: "Moyenne", 
    high: "Élevée",
  };

  const priorityColors = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-warning/20 text-warning-foreground",
    high: "bg-destructive/20 text-destructive-foreground",
  };

  if (!task) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Détails de la tâche</span>
            {onEdit && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(task);
                }}
              >
                Modifier
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

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Flag className="w-4 h-4" />
                Statut
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: currentColumn?.color || "#64748b" }}
                />
                <span className="font-medium">{currentColumn?.title || task.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Flag className="w-4 h-4" />
                Priorité
              </div>
              <Badge variant="outline" className={priorityColors[task.priority]}>
                {priorityLabels[task.priority]}
              </Badge>
            </div>
          </div>

          {/* Due Date and Assignee */}
          <div className="grid grid-cols-2 gap-4">
            {task.dueDate && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Date d'échéance
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{format(task.dueDate, "PPP", { locale: fr })}</span>
                </div>
              </div>
            )}

            {task.assignee && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="w-4 h-4" />
                  Assigné à
                </div>
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs">
                      {task.assignee.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{task.assignee}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tag className="w-4 h-4" />
                Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
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
                {format(task.createdAt, "PPpp", { locale: fr })}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="w-4 h-4" />
                Modifiée le
              </div>
              <span className="text-sm">
                {format(task.updatedAt, "PPpp", { locale: fr })}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}