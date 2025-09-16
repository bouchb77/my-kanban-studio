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
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-red-500">PAGE REPORTING SIMPLIFIÉE POUR TEST CARTE</h1>
      <div className="bg-blue-500 p-4 text-white mb-4">
        Avant le composant carte
      </div>
      <CompaniesMap />
      <div className="bg-green-500 p-4 text-white mt-4">
        Après le composant carte
      </div>
    </div>
  );
};

export default ReportingPage;