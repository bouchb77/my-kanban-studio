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
import { encryptedCompaniesService } from '@/services/encryptedCompaniesService';

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
      if (!user || !selectedYear || !formateur) return;

      setLoading(true);
      try {
        // Load aggregate stats
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
            secured_revenue: Number(data[0].secured_revenue || 0),
            secured_revenue_avg: 0
          });
        } else {
          setStats({
            paid_trainings: 0,
            total_trainings: 0,
            secured_revenue: 0,
            secured_revenue_avg: 0
          });
        }

        // Get departments for this formateur
        const { data: depts } = await supabase
          .from('department_management')
          .select('department_name')
          .eq('formateur', formateur);

        const departmentNames = depts?.map(d => d.department_name) || [];

        if (departmentNames.length === 0) {
          setPaidCompanies([]);
          setAllCompanies([]);
          setFreeCompanies([]);
          return;
        }

        // Load all companies using encrypted service
        const allEncryptedCompanies = await encryptedCompaniesService.getAllCompanies();
        
        // Filter companies by departments
        const departmentCompanies = allEncryptedCompanies.filter(company => 
          departmentNames.includes(company.generalDepartment || '')
        );

        // Get order details for all companies (based on order_date and FSITE/FSITEJ articles)
        const companiesWithOrdersData = await Promise.all(
          departmentCompanies.map(async (company) => {
            // Get orders with FSITE or FSITEJ articles
            const { data: orderDetails } = await supabase
              .from('order_details')
              .select('order_number, article_code')
              .in('article_code', ['FSITE', 'FSITEJ']);

            const relevantOrderNumbers = orderDetails?.map(od => od.order_number) || [];

            if (relevantOrderNumbers.length === 0) {
              return {
                sipi_number: company.sipiNumber,
                company_name: company.companyName,
                training_date: company.trainingDate?.toISOString().split('T')[0] || '',
                total_orders: 0,
                total_amount: 0
              };
            }

            const { data: orders } = await supabase
              .from('orders')
              .select('amount, order_date, order_number')
              .eq('sipi_number', company.sipiNumber)
              .in('order_number', relevantOrderNumbers)
              .gte('order_date', `${selectedYear}-01-01`)
              .lte('order_date', `${selectedYear}-12-31`);

            const totalAmount = orders?.reduce((sum, o) => sum + Number(o.amount), 0) || 0;
            return {
              sipi_number: company.sipiNumber,
              company_name: company.companyName,
              training_date: company.trainingDate?.toISOString().split('T')[0] || '',
              total_orders: orders?.length || 0,
              total_amount: totalAmount
            };
          })
        );

        // Get ALL orders for companies (for free training stats)
        const companiesWithAllOrdersData = await Promise.all(
          departmentCompanies.map(async (company) => {
            const { data: orders } = await supabase
              .from('orders')
              .select('amount, order_date')
              .eq('sipi_number', company.sipiNumber)
              .gte('order_date', `${selectedYear}-01-01`)
              .lte('order_date', `${selectedYear}-12-31`);

            const totalAmount = orders?.reduce((sum, o) => sum + Number(o.amount), 0) || 0;
            return {
              sipi_number: company.sipiNumber,
              total_orders_all: orders?.length || 0,
              total_amount_all: totalAmount
            };
          })
        );

        // Get ALL orders for companies (all years) for average calculation
        const companiesWithHistoricalOrders = await Promise.all(
          departmentCompanies.map(async (company) => {
            const { data: allOrders } = await supabase
              .from('orders')
              .select('amount')
              .eq('sipi_number', company.sipiNumber);

            const totalAmount = allOrders?.reduce((sum, o) => sum + Number(o.amount), 0) || 0;
            const orderCount = allOrders?.length || 0;
            const avgAmount = orderCount > 0 ? totalAmount / orderCount : 0;
            
            return {
              sipi_number: company.sipiNumber,
              avg_order_amount: avgAmount
            };
          })
        );

        // Formations payantes: companies with orders in the year (based on order_date)
        const paidTrainings = companiesWithOrdersData
          .filter(c => c.total_orders && c.total_orders > 0)
          .sort((a, b) => new Date(b.training_date).getTime() - new Date(a.training_date).getTime());

        // All companies with report_creation_date in the year
        const trainedCompanies = departmentCompanies
          .filter(company => 
            company.reportCreationDate &&
            company.reportCreationDate.getFullYear() === selectedYear
          )
          .map(company => {
            const orderData = companiesWithOrdersData.find(c => c.sipi_number === company.sipiNumber);
            const allOrderData = companiesWithAllOrdersData.find(c => c.sipi_number === company.sipiNumber);
            return {
              sipi_number: company.sipiNumber,
              company_name: company.companyName,
              training_date: company.reportCreationDate.toISOString().split('T')[0],
              total_orders: orderData?.total_orders || 0,
              total_amount: orderData?.total_amount || 0,
              total_orders_all: allOrderData?.total_orders_all || 0,
              total_amount_all: allOrderData?.total_amount_all || 0
            };
          })
          .sort((a, b) => new Date(b.training_date).getTime() - new Date(a.training_date).getTime());

        // Formations gratuites: trained companies not in paid trainings
        const paidSipiNumbers = new Set(paidTrainings.map(c => c.sipi_number));
        const freeTrainings = trainedCompanies.filter(c => !paidSipiNumbers.has(c.sipi_number));

        // Calculate total secured revenue (sum of all orders from ALL trained companies)
        const totalSecuredRevenue = trainedCompanies.reduce(
          (sum, company) => sum + (company.total_amount_all || 0), 
          0
        );

        // Calculate secured revenue based on average order amount
        const trainedSipiNumbers = new Set(trainedCompanies.map(c => c.sipi_number));
        const totalSecuredRevenueAvg = companiesWithHistoricalOrders
          .filter(c => trainedSipiNumbers.has(c.sipi_number))
          .reduce((sum, company) => sum + (company.avg_order_amount || 0), 0);

        // Update stats with calculated secured revenue
        if (stats) {
          setStats({
            ...stats,
            secured_revenue: totalSecuredRevenue,
            secured_revenue_avg: totalSecuredRevenueAvg
          });
        }

        setPaidCompanies(paidTrainings);
        setAllCompanies(trainedCompanies);
        setFreeCompanies(freeTrainings);
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
