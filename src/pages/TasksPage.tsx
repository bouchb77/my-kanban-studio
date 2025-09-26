import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  Trash2,
  Check
} from "lucide-react";
import { Task } from "@/types/task";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { InlineEditField } from "@/components/InlineEditField";
import { ColumnManager } from "@/components/ColumnManager";
import { useUserColumns, useUserCustomFields } from "@/hooks/useUserSettings";
import { useUserViewPreferences } from "@/hooks/useUserViewPreferences";
import { PriorityFlag } from "@/components/PriorityFlag";
import { useUserCategories } from "@/hooks/useUserCategories";
import CompanyDetailDialog from "@/components/CompanyDetailDialog";
import { useEncryptedTasks } from "@/hooks/useEncryptedTasks";

const TasksPage = () => {
  const { columns } = useUserColumns();
  const { customFields } = useUserCustomFields();
  const { preferences } = useUserViewPreferences('table');
  const { categories } = useUserCategories();
  const { 
    tasks, 
    loading, 
    updateTaskField, 
    deleteTask: deleteEncryptedTask 
  } = useEncryptedTasks();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'today' | 'this_week' | 'no_due'>('all');
  const { toast } = useToast();
  const { user } = useAuth();


// Available columns for dynamic table rendering  
const systemColumns = [
  { id: 'select', label: 'Sélection', required: true },
  { id: 'title', label: 'Titre', required: true },
  { id: 'status', label: 'Statut', required: true },
  { id: 'priority', label: 'Priorité', required: true },
  { id: 'category', label: 'Catégorie', required: false },
  { id: 'assignee', label: 'Assigné à', required: false },
  { id: 'dueDate', label: 'Échéance', required: false },
  { id: 'tags', label: 'Tags', required: false },
  { id: 'sipi_number', label: 'Numéro SIPI', required: false },
  { id: 'company_name', label: 'Société', required: false },
  { id: 'actions', label: 'Actions', required: true },
];

  const customFieldColumns = customFields.map(field => ({
    id: `custom_field_${field.id}`,
    label: field.name,
    required: false,
    field: field
  }));

  const allAvailableColumns = [...systemColumns, ...customFieldColumns];

  // Get visible columns with defaults
  const getVisibleColumns = () => {
    if (preferences?.visible_columns && preferences.visible_columns.length > 0) {
      return preferences.visible_columns.filter(id => 
        allAvailableColumns.find(col => col.id === id)
      );
    }
    return allAvailableColumns
      .filter(col => col.required || ['title', 'status', 'priority', 'dueDate'].includes(col.id))
      .map(col => col.id);
  };

  // Get column order with defaults
  const getColumnOrder = () => {
    if (preferences?.column_order && preferences.column_order.length > 0) {
      return preferences.column_order.filter(id => 
        allAvailableColumns.find(col => col.id === id)
      );
    }
    return allAvailableColumns.map(col => col.id);
  };

  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [orderedVisibleColumns, setOrderedVisibleColumns] = useState<any[]>([]);
  
  // Company detail dialog state
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});

  // Update visible columns when preferences change
  useEffect(() => {
    const visible = getVisibleColumns();
    const order = getColumnOrder();
    
    setVisibleColumns(visible);
    
    // Get ordered visible columns for rendering
    const orderedVisible = allAvailableColumns
      .filter(col => visible.includes(col.id))
      .sort((a, b) => {
        const aIndex = order.indexOf(a.id);
        const bIndex = order.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    
    setOrderedVisibleColumns(orderedVisible);
  }, [preferences, customFields.length]);

  // Default columns as fallback for status filter
  const defaultColumns = [
    { status: "todo", title: "À faire" },
    { status: "in-progress", title: "En cours" },
    { status: "review", title: "En révision" },
    { status: "done", title: "Terminée" },
  ];

  // System status columns that are always present
  const systemStatusColumns = [
    { status: "done", title: "Terminée" }
  ];
  
  // Determine available columns: user columns + system columns, or defaults if no user columns
  let availableColumns;
  if (columns.length > 0) {
    // User has custom columns, add system columns if not present
    const hasTerminee = columns.some(col => col.status === "done");
    availableColumns = hasTerminee ? columns : [...columns, ...systemStatusColumns];
  } else {
    // No custom columns, use defaults (which already include Terminée)
    availableColumns = defaultColumns;
  }
  
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

  // Fonction pour obtenir la couleur d'un statut depuis les colonnes utilisateur
  const getStatusColor = (status: string) => {
    const column = availableColumns.find(col => col.status === status);
    if (column && (column as any).color) {
      // Convertir la couleur hex en style inline avec opacité pour le background
      const color = (column as any).color;
      return {
        backgroundColor: `${color}20`, // 20 en hex = ~12% opacité
        borderColor: `${color}40`,
        color: color
      };
    }
    // Fallback vers les couleurs par défaut
    const defaultColors = {
      todo: { backgroundColor: '#64748b20', borderColor: '#64748b40', color: '#64748b' },
      "in-progress": { backgroundColor: '#3b82f620', borderColor: '#3b82f640', color: '#3b82f6' },
      review: { backgroundColor: '#f59e0b20', borderColor: '#f59e0b40', color: '#f59e0b' },
      done: { backgroundColor: '#10b98120', borderColor: '#10b98140', color: '#10b981' },
    };
    return defaultColors[status as keyof typeof defaultColors] || defaultColors.todo;
  };

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

  // Handle company name click
  const handleCompanyClick = async (companyName: string, sipiNumber?: string) => {
    if (!companyName) return;
    
    try {
      let query = supabase
        .from('companies')
        .select('*')
        .eq('company_name', companyName);
      
      if (sipiNumber) {
        query = query.eq('sipi_number', sipiNumber);
      }
      
      const { data, error } = await query.limit(1).single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading company:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les détails de l'entreprise",
          variant: "destructive"
        });
        return;
      }
      
      if (data) {
        setSelectedCompany(data);
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
  }, [user]);

  // Set up real-time updates - now we don't need this since we're using encrypted functions
  // Real-time updates would need to be handled differently with encryption

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                      (statusFilter === "active" && task.status !== 'done') ||
                      task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
    const endOfToday = new Date(now); endOfToday.setHours(23,59,59,999);
    const endOfWeek = new Date(startOfToday); endOfWeek.setDate(endOfWeek.getDate() + 7);

    let matchesDue = true;
    const due = task.dueDate ? new Date(task.dueDate) : null;
    if (dueFilter === 'overdue') {
      matchesDue = !!due && due < startOfToday && task.status !== 'done';
    } else if (dueFilter === 'today') {
      matchesDue = !!due && due >= startOfToday && due <= endOfToday;
    } else if (dueFilter === 'this_week') {
      matchesDue = !!due && due >= startOfToday && due <= endOfWeek;
    } else if (dueFilter === 'no_due') {
      matchesDue = !due;
    }
    
    return matchesSearch && matchesStatus && matchesPriority && matchesDue;
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

  // Render table cell based on column type
  const renderTableCell = (column: any, task: Task) => {
    switch (column.id) {
      case 'select':
        return (
          <TableCell key="select">
            <Checkbox
              checked={selectedTasks.includes(task.id)}
              onCheckedChange={() => toggleTaskSelection(task.id)}
            />
          </TableCell>
        );
      
      case 'title':
        return (
          <TableCell key="title">
            <div className="flex items-center gap-2">
              <PriorityFlag priority={task.priority} size="sm" />
              <div className="flex-1">
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
              </div>
            </div>
          </TableCell>
        );
      
      case 'status':
        return (
          <TableCell key="status">
            <InlineEditField
              value={task.status}
              onSave={(value) => handleInlineEdit(task.id, "status", value)}
              type="select"
              options={availableColumns.map(col => ({
                value: col.status,
                label: col.title,
                color: (col as any).color
              }))}
              displayValue={
                <Badge 
                  className="border-none hover:opacity-70 transition-opacity cursor-pointer"
                  style={getStatusColor(task.status)}
                >
                  {statusLabels[task.status]}
                </Badge>
              }
            />
          </TableCell>
        );
      
      case 'priority':
        return (
          <TableCell key="priority">
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
        );
      
      case 'assignee':
        return (
          <TableCell key="assignee">
            <InlineEditField
              value={task.assignee || ""}
              onSave={(value) => handleInlineEdit(task.id, "assignee", value)}
              type="text"
              placeholder="Non assigné"
            />
          </TableCell>
        );
      
      case 'dueDate':
        return (
          <TableCell key="dueDate">
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
        );
      
      case 'tags':
        return (
          <TableCell key="tags">
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
        );
      
      case 'category':
        const categoryData = categories.find(cat => cat.name === task.category);
        return (
          <TableCell key="category">
            <InlineEditField
              value={task.category || "general"}
              onSave={(value) => handleInlineEdit(task.id, "category", value)}
              type="select"
              options={categories.length > 0 ? categories.map(cat => ({
                value: cat.name,
                label: cat.name,
                color: cat.color
              })) : [{ value: "general", label: "Général" }]}
              displayValue={
                <Badge 
                  className="border-none hover:opacity-70 transition-opacity cursor-pointer"
                  style={{
                    backgroundColor: categoryData?.color || '#6b7280',
                    color: '#ffffff'
                  }}
                >
                  {task.category || "Général"}
                </Badge>
              }
            />
          </TableCell>
        );
      
      case 'sipi_number':
        return (
          <TableCell key="sipi_number">
            {task.sipiNumber || '-'}
          </TableCell>
        );
      
      case 'company_name':
        return (
          <TableCell key="company_name">
            {task.companyName ? (
              <button
                onClick={() => handleCompanyClick(task.companyName!, task.sipiNumber)}
                className="text-primary hover:underline cursor-pointer"
              >
                {task.companyName}
              </button>
            ) : (
              '-'
            )}
          </TableCell>
        );
      
      case 'actions':
        return (
          <TableCell key="actions">
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
        );
      
      default:
        // Custom field
        if (column.id.startsWith('custom_field_') && column.field) {
          const field = column.field;
          const fieldValue = task.customFields?.[field.id];

          if (field.type === 'checkbox') {
            return (
              <TableCell key={column.id}>
                <Switch
                  checked={Boolean(fieldValue)}
                  onCheckedChange={(checked) => handleInlineEdit(task.id, `custom_${field.id}`, checked)}
                />
              </TableCell>
            );
          }

          if (field.type === 'select') {
            return (
              <TableCell key={column.id}>
                <InlineEditField
                  value={fieldValue || ""}
                  onSave={(value) => handleInlineEdit(task.id, `custom_${field.id}`, value)}
                  type="select"
                  options={field.options?.map((opt: string) => ({ value: opt, label: opt })) || []}
                  placeholder={`Aucun ${field.name.toLowerCase()}`}
                />
              </TableCell>
            );
          }

          if (field.type === 'date') {
            return (
              <TableCell key={column.id}>
                <InlineEditField
                  value={fieldValue || null}
                  onSave={(value) => handleInlineEdit(task.id, `custom_${field.id}`, value)}
                  type="date"
                  placeholder={`Aucune date`}
                  displayValue={fieldValue ? new Date(fieldValue).toLocaleDateString('fr-FR') : "-"}
                />
              </TableCell>
            );
          }

          // text or number fallback as text
          return (
            <TableCell key={column.id}>
              <InlineEditField
                value={fieldValue ?? ""}
                onSave={(value) => handleInlineEdit(task.id, `custom_${field.id}`, value)}
                type="text"
                placeholder={`Aucun ${field.name.toLowerCase()}`}
              />
            </TableCell>
          );
        }
        return <TableCell key={column.id}>-</TableCell>;
    }
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
      } else if (field === "category") {
        updateData.category = value || "general";
      } else if (field.startsWith("custom_")) {
        // Handle custom fields
        const fieldId = field.replace("custom_", "");
        const currentTask = tasks.find(t => t.id === taskId);
        const currentCustomFields = currentTask?.customFields || {};
        
        updateData.custom_fields = {
          ...currentCustomFields,
          [fieldId]: value instanceof Date ? value.toISOString() : value
        };
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
                <SelectItem value="active">Actives (sauf terminées)</SelectItem>
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Plus de filtres
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50 bg-popover text-popover-foreground shadow-dropdown w-56">
                <DropdownMenuItem onSelect={() => setDueFilter('all')} className={dueFilter==='all' ? 'font-medium' : ''}>
                  Toutes échéances
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDueFilter('overdue')} className={dueFilter==='overdue' ? 'font-medium' : ''}>
                  En retard
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDueFilter('today')} className={dueFilter==='today' ? 'font-medium' : ''}>
                  Aujourd'hui
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDueFilter('this_week')} className={dueFilter==='this_week' ? 'font-medium' : ''}>
                  Cette semaine
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDueFilter('no_due')} className={dueFilter==='no_due' ? 'font-medium' : ''}>
                  Sans échéance
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                {orderedVisibleColumns.map((column) => (
                  <TableHead key={column.id} className={column.id === 'select' || column.id === 'actions' ? "w-12" : ""}>
                    {column.id === 'title' ? (
                      <Button variant="ghost" className="h-auto p-0 font-semibold">
                        {column.label}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    ) : column.id === 'select' ? (
                      <Checkbox
                        checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                        onCheckedChange={toggleAllTasks}
                      />
                    ) : (
                      column.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-surface-variant/50">
                  {orderedVisibleColumns.map((column) => renderTableCell(column, task))}
                </TableRow>
              ))}
              {filteredTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={orderedVisibleColumns.length} className="text-center py-6 text-muted-foreground">
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
        onTaskCreated={() => {}} // No need to refresh, hook handles it
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

export default TasksPage;