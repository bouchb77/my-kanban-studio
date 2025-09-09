import { useState } from "react";
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

// Mock data
const mockTasks: Task[] = [
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
    assignee: "Alice Martin",
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
    assignee: "Bob Dupont",
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
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "4",
    title: "Optimisation des performances",
    description: "Améliorer les temps de chargement de l'application",
    status: "done",
    priority: "medium",
    tags: ["performance", "optimization"],
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: "Charlie Moreau",
  },
];

const TasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const statusLabels = {
    todo: "À faire",
    "in-progress": "En cours",
    review: "En révision",
    done: "Terminé",
  };

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Liste des tâches</h1>
          <p className="text-muted-foreground">Gérez et filtrez vos tâches</p>
        </div>
        <Button style={{ background: "var(--gradient-primary)" }} className="border-0 text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle tâche
        </Button>
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
                <SelectItem value="todo">À faire</SelectItem>
                <SelectItem value="in-progress">En cours</SelectItem>
                <SelectItem value="review">En révision</SelectItem>
                <SelectItem value="done">Terminé</SelectItem>
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
                    checked={selectedTasks.length === filteredTasks.length}
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
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[task.status]}>
                      {statusLabels[task.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColors[task.priority]}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.assignee || (
                      <span className="text-muted-foreground">Non assigné</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.dueDate ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {task.dueDate.toLocaleDateString('fr-FR')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {task.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {task.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{task.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selectedTasks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-dropdown">
          <div className="flex items-center gap-4">
            <span className="font-medium">
              {selectedTasks.length} tâche(s) sélectionnée(s)
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">
                Marquer comme terminé
              </Button>
              <Button variant="secondary" size="sm">
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;