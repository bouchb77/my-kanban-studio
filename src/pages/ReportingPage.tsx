import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Calendar as CalendarIcon,
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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  city?: string;
  general_department?: string;
  latitude?: number;
  longitude?: number;
  periodOrders?: number;
  periodAmount?: number;
}

const ReportingPage = () => {
  const { tasks, getTaskStats, loading } = useTasks();
  const { orderStats, loading: ordersLoading, error: ordersError } = useOrders();
  const stats = getTaskStats();
  
  // State for date filters and companies table
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

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

  // Fetch companies with period-specific order data
  const fetchCompaniesWithPeriodData = async () => {
    if (!startDate || !endDate) {
      setCompanies([]);
      return;
    }

    setCompaniesLoading(true);
    try {
      // Fetch all companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, sipi_number, company_name, city, general_department, latitude, longitude');

      if (companiesError) throw companiesError;

      // Fetch orders for the selected period
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('sipi_number, amount')
        .gte('order_date', startDate.toISOString().split('T')[0])
        .lte('order_date', endDate.toISOString().split('T')[0]);

      if (ordersError) throw ordersError;

      // Group orders by SIPI number
      const ordersByCompany = new Map<string, { totalOrders: number; totalAmount: number }>();
      ordersData?.forEach(order => {
        const existing = ordersByCompany.get(order.sipi_number) || { totalOrders: 0, totalAmount: 0 };
        ordersByCompany.set(order.sipi_number, {
          totalOrders: existing.totalOrders + 1,
          totalAmount: existing.totalAmount + (order.amount || 0)
        });
      });

      // Combine companies with their period-specific order data
      const companiesWithPeriodData: Company[] = companiesData?.map(company => {
        const orderData = ordersByCompany.get(company.sipi_number);
        return {
          ...company,
          periodOrders: orderData?.totalOrders || 0,
          periodAmount: orderData?.totalAmount || 0
        };
      }) || [];

      setCompanies(companiesWithPeriodData);
    } catch (error) {
      console.error('Error fetching companies with period data:', error);
    } finally {
      setCompaniesLoading(false);
    }
  };

  // Refetch companies data when dates change
  useEffect(() => {
    fetchCompaniesWithPeriodData();
  }, [startDate, endDate]);

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

      {/* Filtres de période et tableau des entreprises */}
      <Card>
        <CardHeader>
          <CardTitle>Analyse par Période</CardTitle>
          <CardDescription>
            Sélectionnez une période pour analyser les commandes des entreprises
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtres de date */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col space-y-2">
              <Label>Date de début</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex flex-col space-y-2">
              <Label>Date de fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Tableau des entreprises */}
          {startDate && endDate && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">
                Liste des Entreprises - Période du {format(startDate, "dd/MM/yyyy")} au {format(endDate, "dd/MM/yyyy")}
              </h3>
              
              {companiesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chargement des données...
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SIPI</TableHead>
                        <TableHead>Nom de l'entreprise</TableHead>
                        <TableHead>Ville</TableHead>
                        <TableHead>Département</TableHead>
                        <TableHead className="text-right">Commandes période sélectionnée</TableHead>
                        <TableHead className="text-right">Montant période sélectionnée</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucune donnée trouvée pour cette période
                          </TableCell>
                        </TableRow>
                      ) : (
                        companies
                          .filter(company => company.periodOrders && company.periodOrders > 0)
                          .sort((a, b) => (b.periodAmount || 0) - (a.periodAmount || 0))
                          .map((company) => (
                            <TableRow key={company.id}>
                              <TableCell className="font-medium">{company.sipi_number}</TableCell>
                              <TableCell>{company.company_name}</TableCell>
                              <TableCell>{company.city || '-'}</TableCell>
                              <TableCell>{company.general_department || '-'}</TableCell>
                              <TableCell className="text-right font-medium">
                                {company.periodOrders || 0}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {(company.periodAmount || 0).toLocaleString()} €
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
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