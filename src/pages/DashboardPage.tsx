import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  Plus,
  MoreVertical,
  CalendarX
} from "lucide-react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { ViewTaskDialog } from "@/components/ViewTaskDialog";
import { useState } from "react";
import { useTasks } from "@/hooks/useTasks";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const DashboardPage = () => {
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isViewTaskOpen, setIsViewTaskOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<any>(null);
  const { getTaskStats, getRecentTasks, getOverdueTasks, loading } = useTasks();
  
  const stats = getTaskStats();
  const recentTasks = getRecentTasks();
  const overdueTasks = getOverdueTasks();

  const handleViewTask = (task: any) => {
    setViewingTask(task);
    setIsViewTaskOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Aperçu de vos tâches et projets</p>
        </div>
        <Button 
          onClick={() => setIsCreateTaskOpen(true)}
          style={{ background: "var(--gradient-primary)" }} 
          className="border-0 text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle tâche
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tâches complétées</CardTitle>
            <CheckSquare className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completionRate}% de taux de completion
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En cours</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">
              {stats.inReview} en révision
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En retard</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">
              À traiter en priorité
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productivité</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.total} tâches au total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tâches en retard */}
        <Card className="shadow-card border-0 border-l-4 border-l-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <CalendarX className="w-4 h-4" />
              Tâches en retard
            </CardTitle>
            <CardDescription>Échéances dépassées à traiter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <div className="text-center text-muted-foreground">Chargement...</div>
              ) : overdueTasks.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 text-success" />
                  <p className="text-sm">Aucune tâche en retard !</p>
                </div>
              ) : (
                overdueTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="flex flex-col gap-2 p-3 bg-destructive/5 rounded-lg border border-destructive/10 cursor-pointer hover:bg-destructive/10 transition-colors"
                    onClick={() => handleViewTask(task)}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium line-clamp-2 flex-1">{task.title}</p>
                      <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 ml-2" />
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>Échéance: {new Date(task.due_date).toLocaleDateString('fr-FR')}</span>
                      <span className="text-destructive font-medium">
                        {formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress par projet */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Progression des projets</CardTitle>
            <CardDescription>Avancement de vos projets actifs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Site Web E-commerce</span>
                <span className="text-sm text-muted-foreground">75%</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Application Mobile</span>
                <span className="text-sm text-muted-foreground">45%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Refonte Design</span>
                <span className="text-sm text-muted-foreground">90%</span>
              </div>
              <Progress value={90} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Tâches récentes */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Tâches récentes</CardTitle>
            <CardDescription>Dernières activités</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-muted-foreground">Chargement...</div>
              ) : recentTasks.length === 0 ? (
                <div className="text-center text-muted-foreground">Aucune tâche récente</div>
              ) : (
                recentTasks.map((task, index) => (
                  <div key={task.id} className="flex items-center justify-between py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        task.status === 'done' ? 'bg-status-done text-success' :
                        task.status === 'in-progress' ? 'bg-status-progress text-primary' :
                        task.status === 'review' ? 'bg-status-review text-warning' :
                        'bg-status-todo text-muted-foreground'
                      }`}>
                        {task.status === 'done' ? 'Terminé' :
                         task.status === 'in-progress' ? 'En cours' :
                         task.status === 'review' ? 'En révision' : 'À faire'}
                      </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem onClick={() => handleViewTask(task)}>Ouvrir</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => console.log('Modifier:', task.title)}>Modifier</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => console.log('Supprimer:', task.title)}>Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <CreateTaskDialog 
        open={isCreateTaskOpen} 
        onOpenChange={setIsCreateTaskOpen} 
      />
      
      <ViewTaskDialog 
        open={isViewTaskOpen} 
        onOpenChange={setIsViewTaskOpen} 
        task={viewingTask}
      />
    </div>
  );
};

export default DashboardPage;