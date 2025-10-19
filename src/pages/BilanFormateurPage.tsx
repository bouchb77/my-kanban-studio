import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { encryptedCompaniesService } from '@/services/encryptedCompaniesService';
import { useTrainingDevelopment } from '@/hooks/useTrainingDevelopment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, GraduationCap, DollarSign, BarChart3, TrendingUp } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import CompanyDetailDialog from '@/components/CompanyDetailDialog';

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
  const [userSector, setUserSector] = useState<string | null>(null); // Secteur attribué à l'utilisateur
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState<string | null>(null); // Secteur sélectionné pour affichage
  const [paidCompanies, setPaidCompanies] = useState<TrainingCompany[]>([]);
  const [allCompanies, setAllCompanies] = useState<TrainingCompany[]>([]);
  const [freeCompanies, setFreeCompanies] = useState<TrainingCompany[]>([]);
  const [totalFsiteOrders, setTotalFsiteOrders] = useState<number>(0);
  const [totalFsiteAmount, setTotalFsiteAmount] = useState<number>(0);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});

  // Hook pour le calcul du développement - utilise le secteur sélectionné
  const { metrics: developmentMetrics, loading: devLoading } = useTrainingDevelopment(
    selectedSector || '', 
    selectedYear
  );

  // Generate list of years from 2020 to current year
  const years = Array.from(
    { length: new Date().getFullYear() - 2020 + 1 },
    (_, i) => 2020 + i
  ).reverse();

  useEffect(() => {
    const loadFormateur = async () => {
      if (!user) return;

      console.log('Loading formateur for user:', user.id);
      const { data, error } = await supabase
        .from('user_fo_sectors')
        .select('formateur')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading formateur:', error);
      }
      
      console.log('Formateur data:', data);
      const sector = data?.formateur || null;
      console.log('User sector value:', sector, 'Type:', typeof sector);
      setUserSector(sector);
      
      // Si le secteur est "tous", charger tous les secteurs disponibles
      if (sector === 'tous') {
        console.log('Sector is "tous", loading all sectors...');
        const { data: sectors, error: sectorsError } = await supabase
          .from('department_management')
          .select('formateur')
          .order('formateur');
        
        if (sectorsError) {
          console.error('Error loading sectors:', sectorsError);
        }
        
        console.log('Raw sectors data:', sectors);
        // Filtrer les valeurs invalides (-, vide, null) et ne garder que les vrais formateurs
        const uniqueSectors = [...new Set(
          sectors?.map(s => s.formateur)
            .filter(f => f && f.trim() !== '' && f !== '-') || []
        )];
        console.log('Unique sectors (filtered):', uniqueSectors);
        setAvailableSectors(uniqueSectors);
        
        // Sélectionner "Tous les secteurs" par défaut
        console.log('Setting selected sector to: _tous_');
        setSelectedSector('_tous_');
        setFormateur('_tous_');
      } else {
        // Secteur spécifique
        console.log('Sector is specific:', sector);
        setFormateur(sector);
        setSelectedSector(sector);
      }
    };

    loadFormateur();
  }, [user]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user || !selectedYear || !selectedSector) {
        console.log('Missing required data:', { user: !!user, selectedYear, selectedSector });
        return;
      }

      setLoading(true);
      try {
        console.log('Loading stats for:', { formateur: selectedSector, selectedYear });
        
        // Si "tous les secteurs" est sélectionné, on agrège les données de tous les formateurs
        if (selectedSector === '_tous_') {
          // Charger tous les formateurs disponibles
          const { data: sectors } = await supabase
            .from('department_management')
            .select('formateur')
            .order('formateur');
          
          const allFormateurs = [...new Set(
            sectors?.map(s => s.formateur)
              .filter(f => f && f.trim() !== '' && f !== '-') || []
          )];

          let totalPaidTrainings = 0;
          let totalAllTrainings = 0;
          let totalSecuredRevenue = 0;
          let totalSecuredRevenueAvg = 0;
          const allTrainingData: any[] = [];

          // Agréger les données de tous les formateurs
          for (const formateurName of allFormateurs) {
            const { data: formateurSummary } = await supabase.rpc('get_fo_training_summary', {
              _formateur: formateurName,
              _year: selectedYear
            });

            const { data: formateurTraining } = await supabase.rpc('get_fo_training_data', {
              _formateur: formateurName,
              _year: selectedYear
            });

            if (formateurSummary && formateurSummary.length > 0) {
              totalPaidTrainings += Number(formateurSummary[0].total_paid_trainings || 0);
              totalAllTrainings += Number(formateurSummary[0].total_all_trainings || 0);
              totalSecuredRevenue += Number(formateurSummary[0].secured_revenue || 0);
              totalSecuredRevenueAvg += Number(formateurSummary[0].secured_revenue_avg || 0);
            }

            if (formateurTraining) {
              allTrainingData.push(...formateurTraining);
            }
          }

          // Set summary stats
          setStats({
            paid_trainings: totalPaidTrainings,
            total_trainings: totalAllTrainings,
            secured_revenue: totalSecuredRevenue,
            secured_revenue_avg: totalSecuredRevenueAvg
          });

          // Get all decrypted companies
          const allCompanies = await encryptedCompaniesService.getAllCompanies();
          
          // Create a map for quick lookup of decrypted company names
          const companyMap = new Map(
            allCompanies.map(c => [c.sipiNumber, c.companyName])
          );

          // Dédupliquer les données par SIPI (on prend la dernière entrée pour chaque SIPI)
          const sipiMap = new Map();
          allTrainingData.forEach(row => {
            const existing = sipiMap.get(row.sipi_number);
            if (!existing || new Date(row.report_creation_date) > new Date(existing.report_creation_date)) {
              sipiMap.set(row.sipi_number, row);
            }
          });

          // Transform training data to match component structure with decrypted names
          const allCompaniesData: TrainingCompany[] = Array.from(sipiMap.values()).map(row => ({
            sipi_number: row.sipi_number,
            company_name: companyMap.get(row.sipi_number) || row.company_name,
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
          
          console.log('Stats set (tous les secteurs):', {
            paid: paidTrainings.length,
            free: freeTrainings.length,
            total: allCompaniesData.length
          });
        } else {
          // Load summary stats using optimized function for a specific formateur
          const { data: summaryData, error: summaryError } = await supabase.rpc('get_fo_training_summary', {
            _formateur: selectedSector,
            _year: selectedYear
          });

          if (summaryError) {
            console.error('Error loading summary:', summaryError);
            return;
          }

          // Load detailed training data using optimized function
          const { data: trainingData, error: trainingError } = await supabase.rpc('get_fo_training_data', {
            _formateur: selectedSector,
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

          // Get all decrypted companies
          const allCompanies = await encryptedCompaniesService.getAllCompanies();
          
          // Create a map for quick lookup of decrypted company names
          const companyMap = new Map(
            allCompanies.map(c => [c.sipiNumber, c.companyName])
          );

          // Transform training data to match component structure with decrypted names
          const allCompaniesData: TrainingCompany[] = (trainingData || []).map(row => ({
            sipi_number: row.sipi_number,
            company_name: companyMap.get(row.sipi_number) || row.company_name,
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
          
          console.log('Stats set (specific formateur):', {
            paid: paidTrainings.length,
            free: freeTrainings.length,
            total: allCompaniesData.length
          });
        }

        // Calculate total FSITE and FSITEJ orders for the year - filtered by sector
        if (selectedSector === '_tous_') {
          // Pour "tous les secteurs", prendre TOUTES les commandes FSITE/FSITEJ de l'année
          // 1. Get all orders for the year
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('order_number, order_date, amount')
            .gte('order_date', `${selectedYear}-01-01`)
            .lte('order_date', `${selectedYear}-12-31`);

          if (ordersError) {
            console.error('Error loading orders:', ordersError);
          }

          const orderNumbers = orders?.map(o => o.order_number) || [];

          // 2. Get FSITE/FSITEJ order details for these orders
          const { data: orderDetails, error: orderDetailsError } = await supabase
            .from('order_details')
            .select('order_number, quantity, article_code')
            .in('order_number', orderNumbers)
            .or('article_code.ilike.FSITE%,article_code.ilike.FSITEJ%');

          if (orderDetailsError) {
            console.error('Error loading order details:', orderDetailsError);
          }

          // 3. Calculate totals
          const orderMap = new Map((orders || []).map(o => [o.order_number, o]));
          const matchedOrders = (orderDetails || [])
            .filter(od => orderMap.has(od.order_number))
            .map(od => ({
              ...od,
              order: orderMap.get(od.order_number)
            }));

          const totalOrders = matchedOrders.reduce((sum, item) => sum + (item.quantity || 1), 0);
          const totalAmount = matchedOrders.reduce((sum, item) => sum + (item.order?.amount || 0), 0);
          
          setTotalFsiteOrders(totalOrders);
          setTotalFsiteAmount(totalAmount);
        } else {
          // Pour un secteur spécifique, filtrer par département
          // 1. Get departments for specific formateur
          const { data: depts } = await supabase
            .from('department_management')
            .select('department_name')
            .eq('formateur', selectedSector);
          
          const sectorDepartmentNames = depts?.map(d => d.department_name) || [];

          // 2. Get companies (SIPI numbers) in these departments
          const { data: sectorCompanies } = await supabase
            .from('companies')
            .select('sipi_number')
            .in('general_department', sectorDepartmentNames);

          const sectorSipiNumbers = sectorCompanies?.map(c => c.sipi_number) || [];

          // 3. Get orders for these companies in the selected year
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('order_number, order_date, amount, sipi_number')
            .in('sipi_number', sectorSipiNumbers)
            .gte('order_date', `${selectedYear}-01-01`)
            .lte('order_date', `${selectedYear}-12-31`);

          if (ordersError) {
            console.error('Error loading orders:', ordersError);
          }

          const orderNumbers = orders?.map(o => o.order_number) || [];

          // 4. Get FSITE/FSITEJ order details for these orders
          const { data: orderDetails, error: orderDetailsError } = await supabase
            .from('order_details')
            .select('order_number, quantity, article_code')
            .in('order_number', orderNumbers)
            .or('article_code.ilike.FSITE%,article_code.ilike.FSITEJ%');

          if (orderDetailsError) {
            console.error('Error loading order details:', orderDetailsError);
          }

          // 5. Calculate totals
          const orderMap = new Map((orders || []).map(o => [o.order_number, o]));
          const matchedOrders = (orderDetails || [])
            .filter(od => orderMap.has(od.order_number))
            .map(od => ({
              ...od,
              order: orderMap.get(od.order_number)
            }));

          const totalOrders = matchedOrders.reduce((sum, item) => sum + (item.quantity || 1), 0);
          const totalAmount = matchedOrders.reduce((sum, item) => sum + (item.order?.amount || 0), 0);
          
          setTotalFsiteOrders(totalOrders);
          setTotalFsiteAmount(totalAmount);
        }

        // Load department management data
        const { data: deptData, error: deptError } = await supabase
          .from('department_management')
          .select('*');

        if (!deptError && deptData) {
          const deptMap: Record<string, any> = {};
          deptData.forEach(dept => {
            deptMap[dept.department_name] = dept;
          });
          setDepartmentManagement(deptMap);
        }

      } catch (error) {
        console.error('Error loading training data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user, selectedYear, selectedSector]);

  const handleCompanyClick = async (sipiNumber: string, companyName: string) => {
    // Load full company data
    const { data: companyData } = await supabase
      .from('companies')
      .select('*')
      .eq('sipi_number', sipiNumber)
      .maybeSingle();

    if (companyData) {
      setSelectedCompany({
        ...companyData,
        company_name: companyName // Use decrypted name
      });
      setCompanyDetailOpen(true);
    }
  };

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
          {userSector && (
            <p className="text-muted-foreground mt-1">
              {userSector === 'tous' ? 'Accès à tous les secteurs' : `Secteur : ${userSector}`}
            </p>
          )}
        </div>
        <div className="flex gap-4">
          {userSector === 'tous' && availableSectors.length > 0 && (
            <Select value={selectedSector || ''} onValueChange={(value) => {
              console.log('Sector changed to:', value);
              setSelectedSector(value);
              setFormateur(value);
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Choisir un secteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_tous_">
                  Tous les secteurs
                </SelectItem>
                {availableSectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Commandes FSITE + FSITEJ
                </CardTitle>
                <GraduationCap className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalFsiteOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Nombre total de commandes formations sur l'année
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Montant Total FSITE + FSITEJ
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(totalFsiteAmount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Chiffre d'affaires total des formations sur l'année
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Développement Généré par les Formations
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Analyse du développement pour toutes les formations (payantes et gratuites) - Comparaison des quantités commandées 2 ans avant vs année de formation
              </p>
            </CardHeader>
            <CardContent>
              {devLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : developmentMetrics.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune donnée de développement disponible pour {selectedYear}
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 mb-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Entreprises avec Développement</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {developmentMetrics.filter(m => m.development_generated).length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          sur {developmentMetrics.length} formées
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Croissance Moyenne vs -2 ans</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {(developmentMetrics.reduce((sum, m) => sum + m.growth_vs_minus_2, 0) / developmentMetrics.length).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Moyenne par entreprise
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Explication des colonnes */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm mb-3">📊 Explication des colonnes du tableau :</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium">SIPI :</span>
                        <span className="text-muted-foreground ml-2">Numéro d'identification unique de l'entreprise</span>
                      </div>
                      <div>
                        <span className="font-medium">Entreprise :</span>
                        <span className="text-muted-foreground ml-2">Nom de l'entreprise formée</span>
                      </div>
                      <div>
                        <span className="font-medium">Année Form. :</span>
                        <span className="text-muted-foreground ml-2">Quantité totale de produits commandés pendant l'année de formation</span>
                      </div>
                      <div>
                        <span className="font-medium">-2 ans :</span>
                        <span className="text-muted-foreground ml-2">Quantité totale de produits commandés 2 ans avant la formation</span>
                      </div>
                      <div>
                        <span className="font-medium">Croissance :</span>
                        <span className="text-muted-foreground ml-2">Pourcentage d'évolution entre -2 ans et l'année de formation</span>
                      </div>
                      <div>
                        <span className="font-medium">Taux Renouv. :</span>
                        <span className="text-muted-foreground ml-2">Pourcentage de références commandées à -2 ans qui sont à nouveau commandées l'année de formation</span>
                      </div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SIPI</TableHead>
                        <TableHead>Entreprise</TableHead>
                        <TableHead className="text-right">Année Form.</TableHead>
                        <TableHead className="text-right">-2 ans</TableHead>
                        <TableHead className="text-right">Croissance</TableHead>
                        <TableHead className="text-right">Taux Renouv.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {developmentMetrics.map((metric) => (
                        <TableRow key={metric.sipi_number}>
                          <TableCell className="font-mono">{metric.sipi_number}</TableCell>
                          <TableCell 
                            className="cursor-pointer hover:text-primary hover:underline"
                            onClick={() => handleCompanyClick(metric.sipi_number, metric.company_name)}
                          >
                            {metric.company_name}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{metric.training_year_quantity}</TableCell>
                          <TableCell className="text-right">{metric.year_minus_2_quantity}</TableCell>
                          <TableCell className={`text-right font-medium ${metric.growth_vs_minus_2 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {metric.growth_vs_minus_2 > 0 ? '+' : ''}{metric.growth_vs_minus_2}%
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {metric.renewal_rate_vs_minus_2}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

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
                            <TableCell 
                              className="cursor-pointer hover:text-primary hover:underline"
                              onClick={() => handleCompanyClick(company.sipi_number, company.company_name)}
                            >
                              {company.company_name}
                            </TableCell>
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
                            <TableCell 
                              className="cursor-pointer hover:text-primary hover:underline"
                              onClick={() => handleCompanyClick(company.sipi_number, company.company_name)}
                            >
                              {company.company_name}
                            </TableCell>
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
                            <TableCell 
                              className="cursor-pointer hover:text-primary hover:underline"
                              onClick={() => handleCompanyClick(company.sipi_number, company.company_name)}
                            >
                              {company.company_name}
                            </TableCell>
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

      {/* Company Detail Dialog */}
      <CompanyDetailDialog
        company={selectedCompany}
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        departmentManagement={departmentManagement}
      />
    </div>
  );
}
