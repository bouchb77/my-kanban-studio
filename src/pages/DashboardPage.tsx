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
import { ProjectsOverview } from "@/components/ProjectsOverview";
import { useState } from "react";
import { useEncryptedTasks } from "@/hooks/useEncryptedTasks";
import { useUserColumns } from "@/hooks/useUserSettings";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const DashboardPage = () => {
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isViewTaskOpen, setIsViewTaskOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<any>(null);
  const { tasks, loading } = useEncryptedTasks();
  
  // Identifier les statuts de colonnes terminées (même logique que dans useTasks)
  const getCompletedStatuses = () => {
    const completedStatuses = ['done'];
    const completedKeywords = ['terminé', 'terminée', 'fini', 'fait', 'complete', 'achevé', 'réalisé'];
    columns.forEach(column => {
      const columnTitle = column.title.toLowerCase();
      if (completedKeywords.some(keyword => columnTitle.includes(keyword))) {
        completedStatuses.push(column.status);
      }
    });
    return completedStatuses;
  };
  
  // Implement the stats functions locally since useEncryptedTasks doesn't have them
  const getTaskStats = () => {
    if (!tasks || tasks.length === 0) {
      return { total: 0, completed: 0, inProgress: 0, inReview: 0, overdue: 0, completionRate: 0 };
    }

    const completedStatuses = getCompletedStatuses();
    const now = new Date();
    
    const completed = tasks.filter(task => completedStatuses.includes(task.status)).length;
    const inProgress = tasks.filter(task => task.status === 'in-progress').length;
    const inReview = tasks.filter(task => task.status === 'review').length;
    const overdue = tasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate < now && !completedStatuses.includes(task.status);
    }).length;
    
    const completionRate = Math.round((completed / tasks.length) * 100);
    
    return {
      total: tasks.length,
      completed,
      inProgress,
      inReview,
      overdue,
      completionRate
    };
  };

  const getRecentTasks = (limit = 5) => {
    if (!tasks) return [];
    return [...tasks]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  };

  const getOverdueTasks = (limit = 10) => {
    if (!tasks) return [];
    const now = new Date();
    const completedStatuses = getCompletedStatuses();
    
    return tasks
      .filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate < now && !completedStatuses.includes(task.status);
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, limit);
  };
  const { columns } = useUserColumns();
  
  const stats = getTaskStats();
  const recentTasks = getRecentTasks();
  const overdueTasks = getOverdueTasks();

  const mapToViewTask = (t: any) => {
    const parseDate = (d: any) => {
      if (!d) return new Date();
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? new Date() : dt;
    };
    return {
      id: String(t.id),
      title: t.title,
      description: t.description || undefined,
      status: t.status,
      priority: t.priority,
      assignee: t.assignee || undefined,
      dueDate: t.due_date ? parseDate(t.due_date) : undefined,
      tags: Array.isArray(t.tags) ? t.tags : [],
      createdAt: parseDate(t.created_at),
      updatedAt: parseDate(t.updated_at),
      customFields: (t as any).custom_fields || {},
      sipiNumber: t.sipi_number,
      companyName: t.company_name,
    };
  };

  const handleViewTask = (task: any) => {
    setViewingTask(mapToViewTask(task));
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

      {/* Projets Overview */}
      <div className="mb-6">
        <ProjectsOverview />
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
                overdueTasks.map((task) => {
                  // Sécuriser la date avant de l'utiliser
                  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                  const isValidDate = dueDate && !isNaN(dueDate.getTime());
                  
                  return (
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
                        <span>
                          Échéance: {isValidDate ? dueDate.toLocaleDateString('fr-FR') : 'Date invalide'}
                        </span>
                        <span className="text-destructive font-medium">
                          {isValidDate ? 
                            formatDistanceToNow(dueDate, { addSuffix: true, locale: fr }) : 
                            'Date invalide'
                          }
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Planning des tâches sur 50 jours */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Planning (20 jours passés + 30 jours à venir)</CardTitle>
            <CardDescription>Vue d'ensemble des échéances et planification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                // Générer 20 jours passés + aujourd'hui + 30 jours futurs
                const days = [];
                const today = new Date();
                
                // Commencer 20 jours avant aujourd'hui
                for (let i = -20; i <= 30; i++) {
                  const date = new Date(today);
                  date.setDate(today.getDate() + i);
                  
                  // Trouver les tâches pour ce jour
                  const dayTasks = tasks.filter(task => {
                    if (!task.dueDate) return false;
                    const taskDate = new Date(task.dueDate);
                    if (isNaN(taskDate.getTime())) return false;
                    
                    // Exclure les tâches terminées si elles sont en retard
                    const isOverdue = taskDate < today;
                    const completedStatuses = getCompletedStatuses();
                    if (isOverdue && completedStatuses.includes(task.status)) return false;
                    
                    return taskDate.toDateString() === date.toDateString();
                  });
                  
                  days.push({ date, tasks: dayTasks });
                }
                
                return (
                  <div className="space-y-4">
                    {/* Navigation par semaines */}
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {(() => {
                        // Organiser les jours par semaines
                        const weeks = [];
                        let currentWeek = [];
                        
                        days.forEach((day, index) => {
                          // Si c'est lundi ou le premier jour, commencer une nouvelle semaine
                          if (day.date.getDay() === 1 || index === 0) {
                            // Ajouter des cases vides au début si nécessaire
                            if (index === 0) {
                              const startDay = day.date.getDay();
                              for (let i = 0; i < startDay; i++) {
                                currentWeek.push(null);
                              }
                            }
                            
                            if (currentWeek.length > 0) {
                              weeks.push([...currentWeek]);
                            }
                            currentWeek = [day];
                          } else {
                            currentWeek.push(day);
                          }
                        });
                        
                        // Ajouter la dernière semaine
                        if (currentWeek.length > 0) {
                          weeks.push(currentWeek);
                        }
                        
                        return (
                          <div className="space-y-2">
                            {/* Headers des jours */}
                            <div className="grid grid-cols-7 gap-1 text-xs">
                              {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day) => (
                                <div key={day} className="p-2 text-center font-medium text-muted-foreground bg-muted/30 rounded">
                                  {day}
                                </div>
                              ))}
                            </div>
                            
                            {/* Semaines avec séparateurs de mois */}
                            {weeks.map((week, weekIndex) => {
                              // Vérifier si cette semaine commence un nouveau mois
                              const firstDayOfWeek = week.find(day => day !== null);
                              const showMonthHeader = firstDayOfWeek && (
                                weekIndex === 0 || 
                                (weeks[weekIndex - 1] && weeks[weekIndex - 1].find(day => day !== null)?.date.getMonth() !== firstDayOfWeek.date.getMonth())
                              );
                              
                              return (
                                <div key={weekIndex}>
                                  {/* Header de mois */}
                                  {showMonthHeader && (
                                    <div className="mb-2 mt-4 first:mt-0">
                                      <div className="flex items-center gap-2">
                                        <div className="h-px bg-border flex-1"></div>
                                        <div className="px-3 py-1 bg-primary/10 text-primary font-semibold text-sm rounded-full border border-primary/20">
                                          {firstDayOfWeek.date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                                        </div>
                                        <div className="h-px bg-border flex-1"></div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="grid grid-cols-7 gap-1 text-xs">
                                {week.map((day, dayIndex) => {
                                  if (!day) {
                                    return (
                                      <div key={`empty-${weekIndex}-${dayIndex}`} className="p-1 h-16 border border-transparent">
                                      </div>
                                    );
                                  }
                                  
                                  const { date, tasks } = day;
                                  const isToday = date.toDateString() === today.toDateString();
                                  const isPast = date < today && !isToday;
                                  
                                  return (
                                    <div 
                                      key={date.toISOString()} 
                                      className={`p-1 h-16 border border-border/20 rounded relative overflow-hidden ${
                                        isToday 
                                          ? 'bg-orange-100 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700' 
                                          : isPast 
                                            ? 'bg-muted/10 hover:bg-muted/20' 
                                            : 'hover:bg-muted/20'
                                      }`}
                                    >
                                      <div className={`font-medium ${
                                        isToday 
                                          ? 'text-orange-600 dark:text-orange-400' 
                                          : isPast 
                                            ? 'text-muted-foreground' 
                                            : 'text-foreground'
                                      }`}>
                                        {date.getDate()}
                                      </div>
                                      
                                      {tasks.length > 0 && (
                                        <div className="absolute bottom-0 left-0 right-0 space-y-0.5">
                                           {tasks.slice(0, 2).map((task) => {
                                             const taskDate = new Date(task.dueDate!);
                                             const isOverdue = taskDate < today;
                                             const completedStatuses = getCompletedStatuses();
                                             const isCompleted = completedStatuses.includes(task.status);
                                            
                                            return (
                                              <div 
                                                key={task.id}
                                                className={`text-xs p-0.5 rounded cursor-pointer truncate ${
                                                  isCompleted
                                                    ? 'bg-success/20 text-success hover:bg-success/30'
                                                    : isOverdue 
                                                      ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' 
                                                      : 'bg-primary/20 text-primary hover:bg-primary/30'
                                                }`}
                                                onClick={() => handleViewTask(task)}
                                                title={task.title}
                                              >
                                                {task.title}
                                              </div>
                                            );
                                          })}
                                          
                                          {tasks.length > 2 && (
                                            <div className="text-xs text-muted-foreground text-center">
                                              +{tasks.length - 2} autre{tasks.length - 2 > 1 ? 's' : ''}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                 })}
                                   </div>
                                 </div>
                               );
                             })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
              
              <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-primary/20 rounded"></div>
                  <span>Tâches planifiées</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-destructive/20 rounded"></div>
                  <span>Tâches en retard</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-success/20 rounded"></div>
                  <span>Tâches terminées</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-100 border border-orange-300 dark:bg-orange-900/20 dark:border-orange-700 rounded"></div>
                  <span>Aujourd'hui</span>
                </div>
              </div>
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
                recentTasks.map((task, index) => {
                  const updatedDate = task.updatedAt ? new Date(task.updatedAt) : null;
                  const isValidUpdatedDate = updatedDate && !isNaN(updatedDate.getTime());
                  
                  return (
                    <div key={task.id} className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {isValidUpdatedDate ? 
                            formatDistanceToNow(updatedDate, { addSuffix: true, locale: fr }) :
                            'Date inconnue'
                          }
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
                  );
                })
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