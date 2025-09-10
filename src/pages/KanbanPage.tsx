import { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, useDroppable } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, MoreVertical, Calendar, User } from "lucide-react";
import { Task } from "@/types/task";

// Mock data
const initialTasks: Task[] = [
  {
    id: "1",
    title: "Implémenter l'authentification",
    description: "Configurer Supabase auth avec email/password",
    status: "todo",
    priority: "high",
    tags: ["auth", "backend"],
    createdAt: new Date(),
    updatedAt: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: "2",
    title: "Design système de notifications",
    description: "Créer l'interface utilisateur pour les notifications",
    status: "in-progress",
    priority: "medium",
    tags: ["ui", "design"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    title: "Tests unitaires",
    description: "Écrire les tests pour les composants principaux",
    status: "review",
    priority: "low",
    tags: ["tests", "quality"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const columns = [
  { id: "todo", title: "À faire", status: "todo" as const },
  { id: "in-progress", title: "En cours", status: "in-progress" as const },
  { id: "review", title: "En révision", status: "review" as const },
  { id: "done", title: "Terminé", status: "done" as const },
];

function TaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-warning/20 text-warning-foreground",
    high: "bg-destructive/20 text-destructive-foreground",
  };

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
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-1 h-auto"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Options pour:', task.title);
              }}
            >
              <MoreVertical className="w-3 h-3" />
            </Button>
          </div>
          
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <Badge variant="outline" className={priorityColors[task.priority]}>
              {task.priority}
            </Badge>
            
            {task.dueDate && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {task.dueDate.toLocaleDateString('fr-FR', { 
                  month: 'short', 
                  day: 'numeric' 
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

function KanbanColumn({ column, tasks }: { column: typeof columns[0], tasks: Task[] }) {
  const columnTasks = tasks.filter(task => task.status === column.status);
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

      <SortableContext items={columnTasks.map(t => t.id)} strategy={rectSortingStrategy}>
        <div ref={setDroppableRef} className="space-y-3 min-h-96">
          {columnTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

const KanbanPage = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    let targetStatus: Task['status'] | null = null;

    // If dropped over a column container
    if (columns.some(c => c.status === overId)) {
      targetStatus = overId as Task['status'];
    } else {
      // If dropped over another task, keep within that task's column
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) targetStatus = overTask.status;
    }

    if (!targetStatus) return;

    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, status: targetStatus!, updatedAt: new Date() }
          : task
      )
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Kanban</h1>
        <p className="text-muted-foreground">Gérez vos tâches visuellement</p>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-6">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasks}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanPage;