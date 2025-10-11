import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, GraduationCap, DollarSign, BarChart3 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface TrainingStats {
  paid_trainings: number;
  total_trainings: number;
  secured_revenue: number;
  secured_revenue_avg: number;
}

interface TrainingCompany {
  sipi_number: string;
  company_name: string;
  training_date: string;
  total_orders?: number;
  total_amount?: number;
  total_orders_all?: number;
  total_amount_all?: number;
}

export default function BilanFormateurPage() {
  const { user } = useAuth();
  const { roles, loading: roleLoading } = useUserRole();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [formateur, setFormateur] = useState<string | null>(null);
  const [paidCompanies, setPaidCompanies] = useState<TrainingCompany[]>([]);
  const [allCompanies, setAllCompanies] = useState<TrainingCompany[]>([]);
  const [freeCompanies, setFreeCompanies] = useState<TrainingCompany[]>([]);

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
      if (!user || !selectedYear || !formateur) {
        console.log('Missing required data:', { user: !!user, selectedYear, formateur });
        return;
      }

      setLoading(true);
      try {
        console.log('Loading stats for:', { formateur, selectedYear });
        
        // Load summary stats using optimized function
        const { data: summaryData, error: summaryError } = await supabase.rpc('get_fo_training_summary', {
          _formateur: formateur,
          _year: selectedYear
        });

        if (summaryError) {
          console.error('Error loading summary:', summaryError);
          return;
        }

        // Load detailed training data using optimized function
        const { data: trainingData, error: trainingError } = await supabase.rpc('get_fo_training_data', {
          _formateur: formateur,
          _year: selectedYear
        });

        if (trainingError) {
          console.error('Error loading training data:', trainingError);
          return;
        }

        console.log('Data loaded:', { 
          summaryCount: summaryData?.length, 
          trainingCount: trainingData?.length 
        });

        // Set summary stats
        if (summaryData && summaryData.length > 0) {
          setStats({
            paid_trainings: Number(summaryData[0].total_paid_trainings || 0),
            total_trainings: Number(summaryData[0].total_all_trainings || 0),
            secured_revenue: Number(summaryData[0].secured_revenue || 0),
            secured_revenue_avg: Number(summaryData[0].secured_revenue_avg || 0)
          });
        } else {
          setStats({
            paid_trainings: 0,
            total_trainings: 0,
            secured_revenue: 0,
            secured_revenue_avg: 0
          });
        }

        // Transform training data to match component structure
        const allCompaniesData: TrainingCompany[] = (trainingData || []).map(row => ({
          sipi_number: row.sipi_number,
          company_name: row.company_name,
          training_date: row.report_creation_date,
          total_orders: Number(row.paid_orders_count || 0),
          total_amount: Number(row.paid_orders_amount || 0),
          total_orders_all: Number(row.all_orders_count_year || 0),
          total_amount_all: Number(row.all_orders_amount_year || 0)
        }));

        // Paid trainings: companies with orders
        const paidTrainings = allCompaniesData.filter(c => c.total_orders && c.total_orders > 0);

        // Free trainings: companies without paid orders
        const paidSipiNumbers = new Set(paidTrainings.map(c => c.sipi_number));
        const freeTrainings = allCompaniesData.filter(c => !paidSipiNumbers.has(c.sipi_number));

        setPaidCompanies(paidTrainings);
        setAllCompanies(allCompaniesData);
        setFreeCompanies(freeTrainings);

        console.log('Stats set:', {
          paid: paidTrainings.length,
          free: freeTrainings.length,
          total: allCompaniesData.length
        });

      } catch (error) {
        console.error('Error loading training data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user, selectedYear, formateur]);

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!roles.includes('fo')) {
    return <Navigate to="/dashboard" replace />;
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
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Formations Payantes
                </CardTitle>
                <GraduationCap className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{paidCompanies.length}</div>
                <p className="text-xs text-muted-foreground">
                  Basé sur date commande SIPI
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Formations Payantes ou Gratuites
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{freeCompanies.length}</div>
                <p className="text-xs text-muted-foreground">
                  Basé sur date formation (rapport SIPI), hors formations payantes
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
                  Total des commandes des entreprises formées
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  CA Sécurisé (Montant Moyen)
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(stats?.secured_revenue_avg || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Somme des montants moyens par entreprise formée
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="paid" className="space-y-4">
            <TabsList>
              <TabsTrigger value="paid">Formations Payantes ({paidCompanies.length})</TabsTrigger>
              <TabsTrigger value="free">Formations Payantes ou Gratuites ({freeCompanies.length})</TabsTrigger>
              <TabsTrigger value="all">Toutes les Formations ({allCompanies.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="paid" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Entreprises Formées avec Commandes</CardTitle>
                </CardHeader>
                <CardContent>
                  {paidCompanies.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Aucune entreprise formée avec commande en {selectedYear}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SIPI</TableHead>
                          <TableHead>Entreprise</TableHead>
                          <TableHead>Date Formation</TableHead>
                          <TableHead className="text-right">Nb Commandes</TableHead>
                          <TableHead className="text-right">CA Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paidCompanies.map((company) => (
                          <TableRow key={company.sipi_number}>
                            <TableCell className="font-mono">{company.sipi_number}</TableCell>
                            <TableCell>{company.company_name}</TableCell>
                            <TableCell>
                              {new Date(company.training_date).toLocaleDateString('fr-FR')}
                            </TableCell>
                            <TableCell className="text-right">{company.total_orders}</TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(company.total_amount || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="free" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Entreprises Formées (Payantes ou Gratuites)</CardTitle>
                </CardHeader>
                <CardContent>
                  {freeCompanies.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Aucune entreprise formée sans commande en {selectedYear}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SIPI</TableHead>
                          <TableHead>Entreprise</TableHead>
                          <TableHead>Date Formation</TableHead>
                          <TableHead className="text-right">Nb Commandes</TableHead>
                          <TableHead className="text-right">CA Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {freeCompanies.map((company) => (
                          <TableRow key={company.sipi_number}>
                            <TableCell className="font-mono">{company.sipi_number}</TableCell>
                            <TableCell>{company.company_name}</TableCell>
                            <TableCell>
                              {new Date(company.training_date).toLocaleDateString('fr-FR')}
                            </TableCell>
                            <TableCell className="text-right">
                              {company.total_orders_all || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(company.total_amount_all || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Toutes les Entreprises Formées</CardTitle>
                </CardHeader>
                <CardContent>
                  {allCompanies.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Aucune entreprise formée en {selectedYear}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SIPI</TableHead>
                          <TableHead>Entreprise</TableHead>
                          <TableHead>Date Formation</TableHead>
                          <TableHead className="text-right">Nb Commandes</TableHead>
                          <TableHead className="text-right">CA Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allCompanies.map((company) => (
                          <TableRow key={company.sipi_number}>
                            <TableCell className="font-mono">{company.sipi_number}</TableCell>
                            <TableCell>{company.company_name}</TableCell>
                            <TableCell>
                              {new Date(company.training_date).toLocaleDateString('fr-FR')}
                            </TableCell>
                            <TableCell className="text-right">
                              {company.total_orders_all || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(company.total_amount_all || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
