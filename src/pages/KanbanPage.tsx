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
import { useUserColumns, useUserCustomFields } from "@/hooks/useUserSettings";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { ViewTaskDialog } from "@/components/ViewTaskDialog";
import { useUserViewPreferences } from "@/hooks/useUserViewPreferences";
import { PriorityFlag } from "@/components/PriorityFlag";
import { useUserCategories } from "@/hooks/useUserCategories";
import CompanyDetailDialog from "@/components/CompanyDetailDialog";
import { useEncryptedTasks } from "@/hooks/useEncryptedTasks";

// Default columns as fallback
const defaultColumns = [
  { id: "todo", title: "À faire", status: "todo" as const, color: "#64748b", order: 0 },
  { id: "in-progress", title: "En cours", status: "in-progress" as const, color: "#3b82f6", order: 1 },
  { id: "review", title: "En révision", status: "review" as const, color: "#f59e0b", order: 2 },
  { id: "done", title: "Terminé", status: "done" as const, color: "#10b981", order: 3 },
];

function TaskCard({
  task,
  onOpen,
  onEdit,
  onMove,
  onDelete,
  userColumns,
  visibleFields,
  customFields,
  onCompanyClick
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMove: (task: Task, status: Task["status"]) => void;
  onDelete: (task: Task) => void;
  userColumns: any[];
  visibleFields: string[];
  customFields: any[];
  onCompanyClick: (companyName: string, sipiNumber?: string) => void;
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
      className="shadow-task hover:shadow-card transition-shadow bg-card"
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div 
              {...attributes}
              {...listeners}
              className="flex-1 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-start gap-2">
                <PriorityFlag priority={task.priority} size="sm" />
                <h3 className="font-medium text-sm line-clamp-2">{task.title}</h3>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto ml-2 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40 z-[9999] bg-popover border shadow-md">
                <DropdownMenuItem onSelect={() => onOpen(task)}>Ouvrir</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(task)}>Modifier</DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Déplacer vers</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {userColumns.map((col) => (
                        <DropdownMenuItem key={col.status} onSelect={() => onMove(task, col.status)}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: col.color }}
                            />
                            {col.title}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onSelect={() => onDelete(task)}>
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {task.description && visibleFields.includes('description') && (
            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}

          {task.tags?.length && visibleFields.includes('tags') ? (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between text-xs">
            {visibleFields.includes('priority') && (
              <Badge variant="outline" className={priorityColors[task.priority]}>
                {task.priority}
              </Badge>
            )}

            {task.dueDate && visibleFields.includes('dueDate') && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {task.dueDate.toLocaleDateString("fr-FR", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            )}
          </div>

          {task.assignee && visibleFields.includes('assignee') && (
            <div className="flex items-center gap-2">
              <Avatar className="w-5 h-5">
                <AvatarFallback className="text-xs">
                  {task.assignee.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">{task.assignee}</span>
            </div>
          )}

          {visibleFields.includes('sipiNumber') && task.sipiNumber && (
            <div className="text-xs">
              <span className="text-muted-foreground">SIPI: </span>
              <span className="text-foreground">{task.sipiNumber}</span>
            </div>
          )}

          {visibleFields.includes('companyName') && task.companyName && (
            <div className="text-xs">
              <span className="text-muted-foreground">Société: </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCompanyClick(task.companyName!, task.sipiNumber);
                }}
                className="text-primary hover:underline cursor-pointer"
              >
                {task.companyName}
              </button>
            </div>
          )}

          {/* Custom Fields */}
          {customFields.map((field) => {
            const fieldKey = `custom_field_${field.id}`;
            if (!visibleFields.includes(fieldKey)) return null;
            
            const fieldValue = task.customFields?.[field.id];
            if (!fieldValue) return null;

            return (
              <div key={field.id} className="text-xs">
                <span className="font-medium text-muted-foreground">{field.name}: </span>
                {field.type === 'checkbox' ? (
                  <span className={fieldValue ? "text-success" : "text-muted-foreground"}>
                    {fieldValue ? "✓" : "✗"}
                  </span>
                ) : field.type === 'date' ? (
                  <span className="text-foreground">
                    {new Date(fieldValue).toLocaleDateString('fr-FR')}
                  </span>
                ) : (
                  <span className="text-foreground">{String(fieldValue)}</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanCell({
  column,
  category,
  tasks,
  onOpen,
  onEdit,
  onMove,
  onDelete,
  userColumns,
  visibleFields,
  customFields,
  onCompanyClick
}: {
  column: any;
  category: any;
  tasks: Task[];
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMove: (task: Task, status: Task["status"]) => void;
  onDelete: (task: Task) => void;
  userColumns: any[];
  visibleFields: string[];
  customFields: any[];
  onCompanyClick: (companyName: string, sipiNumber?: string) => void;
}) {
  const cellTasks = tasks
    .filter((task) => task.status === column.status && task.category === category.name)
    .sort((a, b) => {
      const dateA = a.dueDate || a.createdAt;
      const dateB = b.dueDate || b.createdAt;
      return dateA.getTime() - dateB.getTime();
    });
  const { setNodeRef: setDroppableRef } = useDroppable({ id: `${column.status}-${category.name}` });

  return (
    <div className="border border-border/50 rounded-lg p-3 min-h-[200px] bg-card/50">
      <SortableContext items={cellTasks.map((t) => t.id)} strategy={rectSortingStrategy}>
        <div ref={setDroppableRef} className="space-y-2">
          {cellTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              onEdit={onEdit}
              onMove={onMove}
              onDelete={onDelete}
              userColumns={userColumns}
              visibleFields={visibleFields}
              customFields={customFields}
              onCompanyClick={onCompanyClick}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

const KanbanPage = () => {
  const { columns: userColumns, loading: columnsLoading } = useUserColumns();
  const { customFields } = useUserCustomFields();
  const { preferences: kanbanPreferences } = useUserViewPreferences('kanban');
  const { categories: userCategories } = useUserCategories();
  
  const { 
    tasks, 
    loading,
    updateTask,
    deleteTask: deleteEncryptedTask 
  } = useEncryptedTasks();
  
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [isViewTaskOpen, setIsViewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  
  // Company detail dialog state
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});
  
  const { toast } = useToast();

  // System columns that are always present
  const systemColumns = [
    { id: "done", title: "Terminée", status: "done" as const, color: "#22c55e", order: 999, system: true }
  ];
  
  // Combine user columns with system columns
  const allColumns = [...userColumns, ...systemColumns].sort((a, b) => a.order - b.order);
  const columns = allColumns.length > 0 ? allColumns : defaultColumns;
  
  // Use user categories or fall back to default
  const categories = userCategories.length > 0 ? userCategories : [{ id: '1', name: 'Général', color: '#64748b', order: 0 }];

  // Get visible fields for cards (default to showing all if not set)
  const visibleFields = kanbanPreferences?.visible_columns || ['title', 'description', 'tags', 'priority', 'dueDate', 'assignee'];

  // Load department management data
  const loadDepartmentManagement = async () => {
    try {
      const { data, error } = await supabase
        .from('department_management')
        .select('*');
      
      if (error) {
        console.error('Error loading department management:', error);
        return;
      }
      
      const departmentMap = data?.reduce((acc, dept) => {
        acc[dept.department_name] = dept;
        return acc;
      }, {}) || {};
      
      setDepartmentManagement(departmentMap);
    } catch (error) {
      console.error('Error loading department management:', error);
    }
  };

  // Handle company name click - load from encrypted service
  const handleCompanyClick = async (companyName: string, sipiNumber?: string) => {
    if (!companyName) return;
    
    try {
      // Use the encrypted companies service via edge function
      const { data, error } = await supabase.functions.invoke('encrypted-companies', {
        body: {
          method: 'SELECT',
          body: null
        }
      });
      
      if (error) {
        console.error('Error loading companies:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les détails de l'entreprise",
          variant: "destructive"
        });
        return;
      }
      
      // Find matching company
      const companies = data?.data || [];
      let matchingCompany = companies.find((c: any) => 
        c.company_name === companyName && (!sipiNumber || c.sipi_number === sipiNumber)
      );
      
      if (matchingCompany) {
        setSelectedCompany(matchingCompany);
        setCompanyDetailOpen(true);
      } else {
        toast({
          title: "Information",
          description: "Aucune information détaillée trouvée pour cette entreprise",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error loading company:', error);
    }
  };

  useEffect(() => {
    loadDepartmentManagement();
  }, []);

  const handleOpenTask = (task: Task) => {
    setViewingTask(task);
    setIsViewTaskOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsEditTaskOpen(true);
  };

  const handleEditFromView = (task: Task) => {
    setViewingTask(null);
    setIsViewTaskOpen(false);
    setEditingTask(task);
    setIsEditTaskOpen(true);
  };

  const handleMoveTask = async (task: Task, status: Task["status"]) => {
    const success = await updateTask(task.id, { status });
    if (!success) {
      toast({ title: "Erreur", description: "Déplacement non sauvegardé", variant: "destructive" });
    }
  };

  const handleDeleteTask = async (task: Task) => {
    const success = await deleteEncryptedTask(task.id);
    if (!success) {
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
    let targetCategory: string | null = null;

    // Handle drop on cell (status-category combination)
    if (overId.includes('-')) {
      const [status, category] = overId.split('-');
      if (columns.some((c) => c.status === status)) {
        targetStatus = status as Task["status"];
        targetCategory = category;
      }
    } else if (columns.some((c) => c.status === overId)) {
      targetStatus = overId as Task["status"];
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
        targetCategory = overTask.category;
      }
    }

    if (!targetStatus) return;

    const updates: any = { status: targetStatus };
    if (targetCategory) updates.category = targetCategory;
    
    const success = await updateTask(taskId, updates);
    if (!success) {
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
        <div className="space-y-4 overflow-x-auto pb-6">
          {/* Column headers */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `200px repeat(${columns.length}, 1fr)` }}>
            <div></div> {/* Empty cell for category column */}
            {columns.map((column) => (
              <div key={column.id || column.status} className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: column.color }}
                  />
                  <h2 className="font-semibold text-foreground">{column.title}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {tasks.filter(t => t.status === column.status).length}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Category rows with task cells */}
          {categories.map((category) => (
            <div key={category.id} className="grid gap-2" style={{ gridTemplateColumns: `200px repeat(${columns.length}, 1fr)` }}>
              {/* Category header */}
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border-l-4" style={{ borderColor: category.color }}>
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: category.color }}
                />
                <h3 className="font-medium text-foreground">{category.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {tasks.filter(t => t.category === category.name).length}
                </Badge>
              </div>

              {/* Task cells for each status in this category */}
              {columns.map((column) => (
                <KanbanCell
                  key={`${category.id}-${column.id || column.status}`}
                  column={column}
                  category={category}
                  tasks={tasks}
                  onOpen={handleOpenTask}
                  onEdit={handleEditTask}
                  onMove={handleMoveTask}
                  onDelete={handleDeleteTask}
                  userColumns={columns}
                  visibleFields={visibleFields}
                  customFields={customFields}
                  onCompanyClick={handleCompanyClick}
                />
              ))}
            </div>
          ))}
        </div>

        <DragOverlay>{activeTask ? (
          <TaskCard 
            task={activeTask} 
            onOpen={() => {}} 
            onEdit={() => {}} 
            onMove={() => {}} 
            onDelete={() => {}} 
            userColumns={columns}
            visibleFields={visibleFields}
            customFields={customFields}
            onCompanyClick={() => {}}
          />
        ) : null}</DragOverlay>
      </DndContext>

      <ViewTaskDialog
        open={isViewTaskOpen}
        onOpenChange={setIsViewTaskOpen}
        task={viewingTask}
        onEdit={handleEditFromView}
      />

      <EditTaskDialog
        open={isEditTaskOpen}
        onOpenChange={setIsEditTaskOpen}
        task={editingTask}
        onTaskUpdated={() => {}} // No need to refresh, hook handles it
      />

      <CompanyDetailDialog
        company={selectedCompany}
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        departmentManagement={departmentManagement}
      />
    </div>
  );
};

export default KanbanPage;
