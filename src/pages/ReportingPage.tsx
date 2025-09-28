import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Calendar as CalendarIcon,
  Clock,
  CheckSquare,
  AlertTriangle,
  ShoppingCart,
  Euro,
  Users,
  Activity
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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEncryptedTasks } from "@/hooks/useEncryptedTasks";
import { useOrders } from "@/hooks/useOrders";
import CompaniesMap from "@/components/CompaniesMap";

const ReportingPage = () => {
  const { tasks, loading } = useEncryptedTasks();
  const { orderStats, loading: ordersLoading, error: ordersError } = useOrders();
  
  // State for date filters
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  // Calculate task statistics
  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'done').length;
    const inProgress = tasks.filter(task => task.status === 'in-progress').length;
    const todo = tasks.filter(task => task.status === 'todo').length;
    const inReview = tasks.filter(task => task.status === 'review').length;
    const overdue = tasks.filter(task => {
      if (!task.dueDate || task.status === 'done') return false;
      return new Date(task.dueDate) < new Date();
    }).length;

    return { total, completed, inProgress, todo, inReview, overdue };
  };

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
        const taskDate = new Date(task.createdAt);
        return taskDate.toDateString() === date.toDateString();
      });
      
      const completedTasks = tasks.filter(task => {
        const taskDate = new Date(task.updatedAt);
        return taskDate.toDateString() === date.toDateString() && task.status === 'done';
      });

      return {
        name: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        date: format(date, 'dd/MM'),
        created: dayTasks.length,
        completed: completedTasks.length
      };
    });
  }, [tasks]);

  // Activity heatmap data (last 30 days)
  const heatmapData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      
      const dayActivity = tasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate.toDateString() === date.toDateString();
      }).length;

      // Calculate intensity (0-4 levels)
      const maxActivity = Math.max(...Array.from({ length: 30 }, (_, j) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - j));
        return tasks.filter(t => new Date(t.createdAt).toDateString() === d.toDateString()).length;
      }));
      
      const intensity = maxActivity === 0 ? 0 : Math.ceil((dayActivity / maxActivity) * 4);

      return {
        date: date.toISOString().split('T')[0],
        day: date.getDate(),
        activity: dayActivity,
        intensity,
        dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()]
      };
    });

    return last30Days;
  }, [tasks]);

  // Calculs des totaux
  const totalOrders = orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0);
  const totalAmount = orderStats.reduce((sum, stat) => sum + stat.totalAmount, 0);

  if (loading || ordersLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Chargement des données...</div>
      </div>
    );
  }

  const getHeatmapColor = (intensity: number) => {
    const colors = [
      'hsl(var(--muted))',
      'hsl(var(--primary) / 0.2)',
      'hsl(var(--primary) / 0.4)',
      'hsl(var(--primary) / 0.7)',
      'hsl(var(--primary))'
    ];
    return colors[intensity] || colors[0];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reporting</h1>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Statistiques principales - deux colonnes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Colonne 1: Statistiques des commandes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Statistiques des Commandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Commandes</span>
                </div>
                <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Chiffre d'Affaires</span>
                </div>
                <div className="text-2xl font-bold">{totalAmount.toLocaleString()} €</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Années Actives</span>
                </div>
                <div className="text-2xl font-bold">{orderStats.length}</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Moyenne/An</span>
                </div>
                <div className="text-2xl font-bold">
                  {orderStats.length > 0 ? Math.round(totalOrders / orderStats.length).toLocaleString() : 0}
                </div>
              </div>
            </div>

            {/* Détail par année - version compacte */}
            <div className="mt-6 space-y-3">
              <h4 className="font-medium text-sm">Détail par Année</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {orderStats.map((stat) => (
                  <div key={stat.year} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="text-xs">{stat.year}</Badge>
                      <div>
                        <p className="font-medium text-sm">{stat.totalOrders} commandes</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.totalAmount.toLocaleString()} €
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        {stat.totalOrders > 0 ? Math.round(stat.totalAmount / stat.totalOrders).toLocaleString() : 0} €
                      </p>
                      <p className="text-xs text-muted-foreground">Moy.</p>
                    </div>
                  </div>
                ))}
                {orderStats.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Aucune donnée disponible
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colonne 2: Activité des tâches avec carte de chaleur */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activité des Tâches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Statistiques des tâches */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Tâches</span>
                </div>
                <div className="text-2xl font-bold">{stats.total}</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">En cours</span>
                </div>
                <div className="text-2xl font-bold text-primary">{stats.inProgress}</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-success" />
                  <span className="text-sm text-muted-foreground">Terminées</span>
                </div>
                <div className="text-2xl font-bold text-success">{stats.completed}</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">En retard</span>
                </div>
                <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
              </div>
            </div>

            {/* Carte de chaleur d'activité */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Activité des 30 derniers jours</h4>
              <div className="grid grid-cols-10 gap-1">
                {heatmapData.map((day, index) => (
                  <div
                    key={day.date}
                    className="aspect-square rounded-sm border transition-all hover:scale-110 cursor-pointer"
                    style={{ 
                      backgroundColor: getHeatmapColor(day.intensity),
                      borderColor: 'hsl(var(--border))'
                    }}
                    title={`${day.date}: ${day.activity} tâches créées`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Moins</span>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map(level => (
                    <div
                      key={level}
                      className="w-2 h-2 rounded-sm border"
                      style={{ 
                        backgroundColor: getHeatmapColor(level),
                        borderColor: 'hsl(var(--border))'
                      }}
                    />
                  ))}
                </div>
                <span>Plus</span>
              </div>
            </div>

            {/* Graphique de progression hebdomadaire */}
            <div className="mt-6">
              <h4 className="font-medium text-sm mb-3">Activité de la semaine</h4>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="created" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="completed" fill="hsl(var(--success))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques détaillés */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Répartition des statuts */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par Statut</CardTitle>
            <CardDescription>Distribution des tâches par statut</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tendance hebdomadaire détaillée */}
        <Card>
          <CardHeader>
            <CardTitle>Tendance Hebdomadaire</CardTitle>
            <CardDescription>Création vs Completion des tâches</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="created" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Créées"
                />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  name="Terminées"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Carte des entreprises */}
      <Card>
        <CardHeader>
          <CardTitle>Localisation des Entreprises</CardTitle>
          <CardDescription>
            Répartition géographique des entreprises clientes avec filtres et tableau détaillé
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompaniesMap 
            clientTypeFilter="all" 
            startDate={startDate}
            endDate={endDate}
            onDateChange={{ setStartDate, setEndDate }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportingPage;