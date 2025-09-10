import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, MoreVertical, Calendar } from "lucide-react";
import { Task } from "@/types/task";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Columns definition (ids used as droppable areas)
const columns = [
  { id: "todo", title: "À faire", status: "todo" as const },
  { id: "in-progress", title: "En cours", status: "in-progress" as const },
  { id: "review", title: "En révision", status: "review" as const },
  { id: "done", title: "Terminé", status: "done" as const },
];

function TaskCard({
  task,
  onOpen,
  onEdit,
  onMove,
  onDelete,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMove: (task: Task, status: Task["status"]) => void;
  onDelete: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const priorityColors = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-warning/20 text-warning-foreground",
    high: "bg-destructive/20 text-destructive-foreground",
  } as const;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="shadow-task cursor-grab active:cursor-grabbing hover:shadow-card transition-shadow"
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="font-medium text-sm line-clamp-2">{task.title}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40 z-50">
                <DropdownMenuItem onSelect={() => onOpen(task)}>Ouvrir</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(task)}>Modifier</DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Déplacer vers</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => onMove(task, "todo")}>À faire</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(task, "in-progress")}>En cours</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(task, "review")}>En révision</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(task, "done")}>Terminé</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onSelect={() => onDelete(task)}>
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}

          {task.tags?.length ? (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between text-xs">
            <Badge variant="outline" className={priorityColors[task.priority]}>
              {task.priority}
            </Badge>

            {task.dueDate && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {task.dueDate.toLocaleDateString("fr-FR", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            )}
          </div>

          {task.assignee && (
            <div className="flex items-center gap-2">
              <Avatar className="w-5 h-5">
                <AvatarFallback className="text-xs">
                  {task.assignee.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">{task.assignee}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  column,
  tasks,
  onOpen,
  onEdit,
  onMove,
  onDelete,
}: {
  column: typeof columns[0];
  tasks: Task[];
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMove: (task: Task, status: Task["status"]) => void;
  onDelete: (task: Task) => void;
}) {
  const columnTasks = tasks.filter((task) => task.status === column.status);
  const { setNodeRef: setDroppableRef } = useDroppable({ id: column.status });

  return (
    <div className="flex-1 min-w-80">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground">{column.title}</h2>
          <Badge variant="secondary" className="text-xs">
            {columnTasks.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <SortableContext items={columnTasks.map((t) => t.id)} strategy={rectSortingStrategy}>
        <div ref={setDroppableRef} className="space-y-3 min-h-96">
          {columnTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              onEdit={onEdit}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

const KanbanPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const { toast } = useToast();

  // Map DB row to Task type
  const mapDbTask = (row: any): Task => ({
    id: String(row.id),
    title: row.title,
    description: row.description || undefined,
    status: (row.status as Task["status"]) ?? "todo",
    priority: (["low", "medium", "high"].includes(row.priority)
      ? row.priority
      : "medium") as Task["priority"],
    tags: row.tags ?? [],
    assignee: row.assignee || undefined,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  });

  // Load tasks from Supabase (only user's tasks)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        toast({ title: "Erreur", description: "Chargement des tâches échoué", variant: "destructive" });
        return;
      }
      if (mounted && data) setTasks(data.map(mapDbTask));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenTask = (task: Task) => {
    toast({ title: "Ouvrir la tâche", description: task.title });
  };

  const handleEditTask = (task: Task) => {
    toast({ title: "Éditer la tâche", description: `${task.title} — bientôt disponible` });
  };

  const handleMoveTask = async (task: Task, status: Task["status"]) => {
    const snapshot = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status, updatedAt: new Date() } : t)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) {
      setTasks(snapshot);
      toast({ title: "Erreur", description: "Déplacement non sauvegardé", variant: "destructive" });
    }
  };

  const handleDeleteTask = async (task: Task) => {
    const snapshot = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      setTasks(snapshot);
      toast({ title: "Erreur", description: "Suppression non sauvegardée", variant: "destructive" });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    let targetStatus: Task["status"] | null = null;

    if (columns.some((c) => c.status === overId)) {
      targetStatus = overId as Task["status"];
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetStatus = overTask.status;
    }

    if (!targetStatus) return;

    const snapshot = tasks;
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: targetStatus!, updatedAt: new Date() } : task))
    );

    const { error } = await supabase.from("tasks").update({ status: targetStatus }).eq("id", taskId);
    if (error) {
      setTasks(snapshot);
      toast({ title: "Erreur", description: "Déplacement non sauvegardé", variant: "destructive" });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Kanban</h1>
        <p className="text-muted-foreground">Gérez vos tâches visuellement</p>
      </div>

      <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-6">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasks}
              onOpen={handleOpenTask}
              onEdit={handleEditTask}
              onMove={handleMoveTask}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>

        <DragOverlay>{activeTask ? (
          <TaskCard task={activeTask} onOpen={() => {}} onEdit={() => {}} onMove={() => {}} onDelete={() => {}} />
        ) : null}</DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanPage;
