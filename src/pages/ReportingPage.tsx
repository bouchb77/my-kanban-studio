import React, { useMemo, useState } from "react";
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
  AlertTriangle,
  ShoppingCart,
  Euro,
  Users
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
import { useOrders } from "@/hooks/useOrders";
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
  const { orderStats, loading: ordersLoading, error: ordersError } = useOrders();
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reporting</h1>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Statistiques des commandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Toutes années confondues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAmount.toLocaleString()} €</div>
            <p className="text-xs text-muted-foreground">
              Montant total des commandes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Années Actives</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.length}</div>
            <p className="text-xs text-muted-foreground">
              Périodes avec commandes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moyenne par Année</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orderStats.length > 0 ? Math.round(totalOrders / orderStats.length).toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Commandes par an
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tableau détaillé par année */}
      <Card>
        <CardHeader>
          <CardTitle>Détail par Année</CardTitle>
          <CardDescription>
            Statistiques détaillées des commandes par année
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderStats.map((stat, index) => (
              <div key={stat.year} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Badge variant="outline">{stat.year}</Badge>
                  <div>
                    <p className="font-medium">{stat.totalOrders} commandes</p>
                    <p className="text-sm text-muted-foreground">
                      {stat.totalAmount.toLocaleString()} € de chiffre d'affaires
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {stat.totalOrders > 0 ? Math.round(stat.totalAmount / stat.totalOrders).toLocaleString() : 0} €
                  </p>
                  <p className="text-sm text-muted-foreground">Montant moyen</p>
                </div>
              </div>
            ))}
            {orderStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucune donnée de commande disponible
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Carte des entreprises */}
      <Card>
        <CardHeader>
          <CardTitle>Localisation des Entreprises</CardTitle>
        <CardDescription>
          Répartition géographique des entreprises clientes
        </CardDescription>
        </CardHeader>
        <CardContent>
          <CompaniesMap clientTypeFilter="all" />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportingPage;