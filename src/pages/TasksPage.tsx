import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Calendar, 
  ArrowUpDown,
  Edit,
  Trash2
} from "lucide-react";
import { Task } from "@/types/task";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { InlineEditField } from "@/components/InlineEditField";
import { ColumnManager } from "@/components/ColumnManager";
import { useUserColumns } from "@/hooks/useUserSettings";

const TasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { columns } = useUserColumns();

  // Default columns as fallback
  const defaultColumns = [
    { status: "todo", title: "À faire" },
    { status: "in-progress", title: "En cours" },
    { status: "review", title: "En révision" },
    { status: "done", title: "Terminé" },
  ];

  const availableColumns = columns.length > 0 ? columns : defaultColumns;
  
  // Create dynamic status labels from user columns
  const statusLabels = availableColumns.reduce((acc, col) => {
    acc[col.status] = col.title;
    return acc;
  }, {} as Record<string, string>);

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

  const statusColors = {
    todo: "bg-status-todo text-muted-foreground",
    "in-progress": "bg-status-progress text-primary",
    review: "bg-status-review text-warning",
    done: "bg-status-done text-success",
  };

  // Map DB row to Task type (same as kanban)
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

  // Load tasks from Supabase
  const loadTasks = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error(error);
        toast({ 
          title: "Erreur", 
          description: "Impossible de charger les tâches", 
          variant: "destructive" 
        });
        return;
      }
      
      if (data) {
        setTasks(data.map(mapDbTask));
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({ 
        title: "Erreur", 
        description: "Erreur lors du chargement", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  // Set up real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          loadTasks(); // Reload tasks on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleAllTasks = () => {
    setSelectedTasks(
      selectedTasks.length === filteredTasks.length 
        ? [] 
        : filteredTasks.map(task => task.id)
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    
    if (error) {
      toast({ 
        title: "Erreur", 
        description: "Impossible de supprimer la tâche", 
        variant: "destructive" 
      });
    } else {
      toast({ title: "Tâche supprimée" });
      setSelectedTasks(prev => prev.filter(id => id !== taskId));
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsEditTaskOpen(true);
  };

  const handleInlineEdit = async (taskId: string, field: string, value: any) => {
    try {
      const updateData: any = {};
      
      if (field === "title") {
        updateData.title = value;
      } else if (field === "status") {
        updateData.status = value;
      } else if (field === "priority") {
        updateData.priority = value;
      } else if (field === "assignee") {
        updateData.assignee = value || null;
      } else if (field === "dueDate") {
        updateData.due_date = value ? value.toISOString() : null;
      } else if (field === "tags") {
        updateData.tags = Array.isArray(value) ? value : [];
      }

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);

      if (error) {
        console.error("Error updating task:", error);
        toast({
          title: "Erreur",
          description: "Impossible de modifier la tâche",
          variant: "destructive",
        });
        throw error;
      }

      toast({
        title: "Tâche modifiée",
        description: "La modification a été sauvegardée",
      });
    } catch (error) {
      throw error;
    }
  };

  const handleBulkComplete = async () => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done" })
      .in("id", selectedTasks);
    
    if (error) {
      toast({ 
        title: "Erreur", 
        description: "Impossible de marquer les tâches comme terminées", 
        variant: "destructive" 
      });
    } else {
      toast({ title: `${selectedTasks.length} tâche(s) marquée(s) comme terminée(s)` });
      setSelectedTasks([]);
    }
  };

  const handleBulkDelete = async () => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .in("id", selectedTasks);
    
    if (error) {
      toast({ 
        title: "Erreur", 
        description: "Impossible de supprimer les tâches", 
        variant: "destructive" 
      });
    } else {
      toast({ title: `${selectedTasks.length} tâche(s) supprimée(s)` });
      setSelectedTasks([]);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des tâches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Liste des tâches</h1>
          <p className="text-muted-foreground">Gérez et filtrez vos tâches</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => setIsCreateTaskOpen(true)}
            style={{ background: "var(--gradient-primary)" }} 
            className="border-0 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle tâche
          </Button>
          <ColumnManager />
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="text-lg">Filtres et recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher des tâches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {availableColumns.map((column) => (
                  <SelectItem key={column.status} value={column.status}>
                    {column.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les priorités</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Élevée</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Plus de filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks table */}
      <Card className="shadow-card border-0">
        <CardContent className="p-0">
          <Table>
            <TableCaption>
              {filteredTasks.length} tâche(s) trouvée(s)
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                    onCheckedChange={toggleAllTasks}
                  />
                </TableHead>
                <TableHead>
                  <Button variant="ghost" className="h-auto p-0 font-semibold">
                    Titre
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Assigné à</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-surface-variant/50">
                  <TableCell>
                    <Checkbox
                      checked={selectedTasks.includes(task.id)}
                      onCheckedChange={() => toggleTaskSelection(task.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineEditField
                      value={task.title}
                      onSave={(value) => handleInlineEdit(task.id, "title", value)}
                      type="text"
                      placeholder="Titre de la tâche"
                    />
                    {task.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1 mt-1">
                        {task.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <InlineEditField
                      value={task.status}
                      onSave={(value) => handleInlineEdit(task.id, "status", value)}
                      type="select"
                      options={availableColumns.map(col => ({
                        value: col.status,
                        label: col.title,
                        color: (col as any).color
                      }))}
                      displayValue={statusLabels[task.status]}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineEditField
                      value={task.priority}
                      onSave={(value) => handleInlineEdit(task.id, "priority", value)}
                      type="select"
                      options={[
                        { value: "low", label: "Faible" },
                        { value: "medium", label: "Moyenne" },
                        { value: "high", label: "Élevée" },
                      ]}
                      displayValue={priorityLabels[task.priority]}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineEditField
                      value={task.assignee || ""}
                      onSave={(value) => handleInlineEdit(task.id, "assignee", value)}
                      type="text"
                      placeholder="Non assigné"
                    />
                  </TableCell>
                  <TableCell>
                    <InlineEditField
                      value={task.dueDate}
                      onSave={(value) => handleInlineEdit(task.id, "dueDate", value)}
                      type="date"
                      placeholder="Aucune date"
                      displayValue={
                        task.dueDate ? task.dueDate.toLocaleDateString('fr-FR') : "-"
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <InlineEditField
                      value={task.tags || []}
                      onSave={(value) => handleInlineEdit(task.id, "tags", value)}
                      type="tags"
                      placeholder="Aucun tag"
                      displayValue={
                        task.tags && task.tags.length > 0 
                          ? task.tags.slice(0, 2).join(", ") + (task.tags.length > 2 ? `... (+${task.tags.length - 2})` : "")
                          : "Aucun tag"
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleEditTask(task)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onSelect={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Aucune tâche trouvée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selectedTasks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-dropdown z-50">
          <div className="flex items-center gap-4">
            <span className="font-medium">
              {selectedTasks.length} tâche(s) sélectionnée(s)
            </span>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleBulkComplete}
              >
                Marquer comme terminé
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleBulkDelete}
              >
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateTaskDialog 
        open={isCreateTaskOpen} 
        onOpenChange={setIsCreateTaskOpen} 
        onTaskCreated={loadTasks}
      />

      <EditTaskDialog 
        open={isEditTaskOpen} 
        onOpenChange={setIsEditTaskOpen} 
        task={editingTask}
        onTaskUpdated={loadTasks}
      />
    </div>
  );
};

export default TasksPage;