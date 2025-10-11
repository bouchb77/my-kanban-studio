import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, GraduationCap, DollarSign, BarChart3 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface TrainingStats {
  paid_trainings: number;
  total_trainings: number;
  secured_revenue: number;
}

export default function BilanFormateurPage() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [formateur, setFormateur] = useState<string | null>(null);

  // Generate list of years from 2020 to current year
  const years = Array.from(
    { length: new Date().getFullYear() - 2020 + 1 },
    (_, i) => 2020 + i
  ).reverse();

  useEffect(() => {
    const loadFormateur = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('user_fo_sectors')
        .select('formateur')
        .eq('user_id', user.id)
        .maybeSingle();

      setFormateur(data?.formateur || null);
    };

    loadFormateur();
  }, [user]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user || !selectedYear) return;

      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_fo_training_stats', {
          _user_id: user.id,
          _year: selectedYear
        });

        if (error) {
          console.error('Error loading stats:', error);
          return;
        }

        if (data && data.length > 0) {
          setStats({
            paid_trainings: Number(data[0].paid_trainings || 0),
            total_trainings: Number(data[0].total_trainings || 0),
            secured_revenue: Number(data[0].secured_revenue || 0)
          });
        } else {
          setStats({
            paid_trainings: 0,
            total_trainings: 0,
            secured_revenue: 0
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user, selectedYear]);

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== 'fo') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bilan Formateur</h1>
          {formateur && (
            <p className="text-muted-foreground mt-1">Secteur : {formateur}</p>
          )}
        </div>
        <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Formations Payantes
              </CardTitle>
              <GraduationCap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.paid_trainings || 0}</div>
              <p className="text-xs text-muted-foreground">
                Formations avec commandes en {selectedYear}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Formations
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_trainings || 0}</div>
              <p className="text-xs text-muted-foreground">
                Payantes et gratuites en {selectedYear}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                CA Sécurisé
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR'
                }).format(stats?.secured_revenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Moyenne des commandes après formation
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
