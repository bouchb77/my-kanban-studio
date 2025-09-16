import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Calendar,
  Clock,
  CheckSquare,
  AlertTriangle
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useTasks } from "@/hooks/useTasks";
import { useMemo } from "react";
import CompaniesMap from "@/components/CompaniesMap";

// Mock data
const weeklyData = [
  { name: "Lun", completed: 4, created: 6 },
  { name: "Mar", completed: 6, created: 8 },
  { name: "Mer", completed: 8, created: 5 },
  { name: "Jeu", completed: 5, created: 7 },
  { name: "Ven", completed: 9, created: 10 },
  { name: "Sam", completed: 3, created: 2 },
  { name: "Dim", completed: 2, created: 1 },
];

const statusData = [
  { name: "À faire", value: 12, color: "#94a3b8" },
  { name: "En cours", value: 8, color: "#3b82f6" },
  { name: "En révision", value: 5, color: "#eab308" },
  { name: "Terminé", value: 24, color: "#22c55e" },
];

const productivityData = [
  { week: "S1", tasks: 12, productivity: 85 },
  { week: "S2", tasks: 15, productivity: 92 },
  { week: "S3", tasks: 18, productivity: 78 },
  { week: "S4", tasks: 14, productivity: 87 },
];

const ReportingPage = () => {
  const { tasks, getTaskStats, loading } = useTasks();
  const stats = getTaskStats();

  const statusData = useMemo(() => [
    { name: "À faire", value: stats.todo, color: "hsl(var(--muted-foreground))" },
    { name: "En cours", value: stats.inProgress, color: "hsl(var(--primary))" },
    { name: "En révision", value: stats.inReview, color: "hsl(var(--warning))" },
    { name: "Terminé", value: stats.completed, color: "hsl(var(--success))" },
  ], [stats]);

  const weeklyData = useMemo(() => {
    // Generate data for the last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    return last7Days.map(date => {
      const dayTasks = tasks.filter(task => {
        const taskDate = new Date(task.created_at);
        return taskDate.toDateString() === date.toDateString();
      });
      
      const completedTasks = tasks.filter(task => {
        const taskDate = new Date(task.updated_at);
        return taskDate.toDateString() === date.toDateString() && task.status === 'done';
      });

      return {
        name: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        created: dayTasks.length,
        completed: completedTasks.length
      };
    });
  }, [tasks]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Chargement des données...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reporting</h1>
            <p className="text-muted-foreground">Analysez votre productivité et progression</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select defaultValue="7days">
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">7 derniers jours</SelectItem>
              <SelectItem value="30days">30 derniers jours</SelectItem>
              <SelectItem value="3months">3 derniers mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tâches cette semaine</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <CheckSquare className="w-3 h-3 mr-1" />
              {stats.completed} terminées
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <div className="flex items-center text-xs text-success mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              Taux de réussite
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temps moyen/tâche</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4h</div>
            <div className="flex items-center text-xs text-destructive mt-1">
              <TrendingDown className="w-3 h-3 mr-1" />
              -8% vs mois dernier
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tâches en retard</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <div className="flex items-center text-xs text-destructive mt-1">
              <AlertTriangle className="w-3 h-3 mr-1" />
              À traiter en priorité
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activité hebdomadaire */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Activité hebdomadaire</CardTitle>
            <CardDescription>Tâches créées vs tâches terminées</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="created" fill="hsl(var(--primary))" name="Créées" />
                <Bar dataKey="completed" fill="hsl(var(--success))" name="Terminées" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribution par statut */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Distribution par statut</CardTitle>
            <CardDescription>Répartition actuelle de vos tâches</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tendances et analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Évolution de la productivité */}
        <Card className="lg:col-span-2 shadow-card border-0">
          <CardHeader>
            <CardTitle>Évolution de la productivité</CardTitle>
            <CardDescription>Performance au cours des dernières semaines</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="productivity" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  name="Productivité (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Objectifs et progrès */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Objectifs mensuels</CardTitle>
            <CardDescription>Progression vers vos objectifs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Tâches complétées</span>
                <span className="text-sm text-muted-foreground">24/30</span>
              </div>
              <Progress value={80} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Projets livrés</span>
                <span className="text-sm text-muted-foreground">2/3</span>
              </div>
              <Progress value={67} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Délais respectés</span>
                <span className="text-sm text-muted-foreground">90%</span>
              </div>
              <Progress value={90} className="h-2" />
            </div>

            <div className="pt-4 space-y-2">
              <Badge className="w-full justify-center bg-success/20 text-success-foreground">
                🎯 Objectif principal: 87% atteint
              </Badge>
              <Badge variant="outline" className="w-full justify-center">
                📈 Tendance: En progression
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Carte des entreprises */}
      <CompaniesMap />

      {/* Recommandations */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle>Recommandations et insights</CardTitle>
          <CardDescription>Analyses automatiques pour améliorer votre productivité</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="font-medium text-success">Performance élevée</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Votre productivité a augmenté de 12% cette semaine. Continuez ainsi !
              </p>
            </div>

            <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-warning" />
                <span className="font-medium text-warning">Planification</span>
              </div>
              <p className="text-sm text-muted-foreground">
                3 tâches arrivent à échéance cette semaine. Priorisez-les.
              </p>
            </div>

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">Équilibre</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Répartissez mieux vos tâches sur la semaine pour éviter les pics.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportingPage;