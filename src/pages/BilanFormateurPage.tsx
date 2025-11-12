import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { encryptedCompaniesService } from '@/services/encryptedCompaniesService';
import { useTrainingDevelopment } from '@/hooks/useTrainingDevelopment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, GraduationCap, DollarSign, BarChart3, TrendingUp, Download, Search, Calendar as CalendarIcon, Filter, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Navigate } from 'react-router-dom';
import CompanyDetailDialog from '@/components/CompanyDetailDialog';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-5))', 'hsl(var(--chart-4))'];

export default function BilanFormateurPage() {
  const { user } = useAuth();
  const { roles, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [formateur, setFormateur] = useState<string | null>(null);
  const [userSector, setUserSector] = useState<string | null>(null);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [paidCompanies, setPaidCompanies] = useState<TrainingCompany[]>([]);
  const [allCompanies, setAllCompanies] = useState<TrainingCompany[]>([]);
  const [freeCompanies, setFreeCompanies] = useState<TrainingCompany[]>([]);
  const [totalFsiteOrders, setTotalFsiteOrders] = useState<number>(0);
  const [totalFsiteAmount, setTotalFsiteAmount] = useState<number>(0);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});

  // New filters
  const [searchTerm, setSearchTerm] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);

  // Multi-year comparison
  const [comparisonYears, setComparisonYears] = useState<number[]>([]);
  const [yearlyStats, setYearlyStats] = useState<any[]>([]);

  const { metrics: developmentMetrics, loading: devLoading } = useTrainingDevelopment(
    selectedSector || '',
    selectedYear
  );

  const years = Array.from(
    { length: new Date().getFullYear() - 2020 + 1 },
    (_, i) => 2020 + i
  ).reverse();

  // Calculate additional KPIs
  const kpis = useMemo(() => {
    const avgBasket = paidCompanies.length > 0
      ? (paidCompanies.reduce((sum, c) => sum + (c.total_amount || 0), 0) / paidCompanies.length)
      : 0;

    // Taux de transformation: formations gratuites de l'année précédente qui sont devenues payantes
    // (à calculer avec les données historiques)
    const transformationRate = 0; // Placeholder

    // Taux de fidélisation (renouvellement sur cycle de 2 ans)
    const fidélisationRate = developmentMetrics.length > 0
      ? (developmentMetrics.reduce((sum, m) => sum + m.renewal_rate_vs_minus_2, 0) / developmentMetrics.length)
      : 0;

    // ROI moyen
    const avgROI = paidCompanies.length > 0
      ? ((stats?.secured_revenue || 0) / (paidCompanies.length * 1000)) // Estimé à 1000€ par formation
      : 0;

    return {
      avgBasket,
      transformationRate,
      fidélisationRate,
      avgROI
    };
  }, [paidCompanies, stats, developmentMetrics]);

  // Filtered companies
  const filteredPaidCompanies = useMemo(() => {
    return paidCompanies.filter(company => {
      const matchesSearch = searchTerm === '' || 
        company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.sipi_number.includes(searchTerm);
      
      const matchesAmount = minAmount === '' || 
        (company.total_amount || 0) >= Number(minAmount);
      
      const matchesDateRange = !dateRange.from || !dateRange.to ||
        (new Date(company.training_date) >= dateRange.from && 
         new Date(company.training_date) <= dateRange.to);
      
      return matchesSearch && matchesAmount && matchesDateRange;
    });
  }, [paidCompanies, searchTerm, minAmount, dateRange]);

  const filteredFreeCompanies = useMemo(() => {
    return freeCompanies.filter(company => {
      const matchesSearch = searchTerm === '' || 
        company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.sipi_number.includes(searchTerm);
      
      const matchesDateRange = !dateRange.from || !dateRange.to ||
        (new Date(company.training_date) >= dateRange.from && 
         new Date(company.training_date) <= dateRange.to);
      
      return matchesSearch && matchesDateRange;
    });
  }, [freeCompanies, searchTerm, dateRange]);

  // Monthly evolution data
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthlyStats = months.map((month, index) => {
      const monthPaid = paidCompanies.filter(c => 
        new Date(c.training_date).getMonth() === index
      ).length;
      const monthFree = freeCompanies.filter(c => 
        new Date(c.training_date).getMonth() === index
      ).length;
      
      return {
        month,
        payantes: monthPaid,
        gratuites: monthFree,
        total: monthPaid + monthFree
      };
    });
    return monthlyStats;
  }, [paidCompanies, freeCompanies]);

  // Pie chart data
  const pieData = [
    { name: 'Formations Payantes', value: paidCompanies.length },
    { name: 'Formations Gratuites', value: freeCompanies.length }
  ];

  // CA by month
  const monthlyCAData = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return months.map((month, index) => {
      const monthCA = paidCompanies
        .filter(c => new Date(c.training_date).getMonth() === index)
        .reduce((sum, c) => sum + (c.total_amount || 0), 0);
      
      return { month, ca: monthCA };
    });
  }, [paidCompanies]);

  const handleExport = async (type: 'paid' | 'free' | 'all' | 'development') => {
    try {
      toast({ title: "Export en cours..." });
      
      const { data, error } = await supabase.functions.invoke('export-bilan-formateur', {
        body: {
          formateur: selectedSector,
          year: selectedYear,
          type
        }
      });

      if (error) throw error;

      toast({ title: "Export réussi !", description: "Le fichier a été téléchargé." });
    } catch (error) {
      console.error('Export error:', error);
      toast({ 
        title: "Erreur d'export", 
        description: "Impossible d'exporter les données",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const loadFormateur = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('user_fo_sectors')
        .select('formateur')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading formateur:', error);
      }
      
      const sector = data?.formateur || null;
      setUserSector(sector);
      
      if (sector === 'tous') {
        const { data: sectors, error: sectorsError } = await supabase
          .from('department_management')
          .select('formateur')
          .order('formateur');
        
        if (sectorsError) {
          console.error('Error loading sectors:', sectorsError);
        }
        
        const uniqueSectors = [...new Set(
          sectors?.map(s => s.formateur)
            .filter(f => f && f.trim() !== '' && f !== '-') || []
        )];
        setAvailableSectors(uniqueSectors);
        setSelectedSector('_tous_');
        setFormateur('_tous_');
      } else {
        setFormateur(sector);
        setSelectedSector(sector);
      }
    };

    loadFormateur();
  }, [user]);

  useEffect(() => {
    const loadDepartments = async () => {
      const { data } = await supabase
        .from('department_management')
        .select('department_name')
        .order('department_name');
      
      const uniqueDepts = [...new Set(data?.map(d => d.department_name) || [])];
      setDepartments(uniqueDepts);
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      if (!user || !selectedYear || !selectedSector) {
        return;
      }

      setLoading(true);
      try {
        if (selectedSector === '_tous_') {
          const { data: allOrders } = await supabase
            .from('orders')
            .select('sipi_number, order_number, order_date, amount')
            .gte('order_date', `${selectedYear}-01-01`)
            .lte('order_date', `${selectedYear}-12-31`);

          const allOrderNumbers = allOrders?.map(o => o.order_number) || [];
          
          const { data: fsiteOrders } = await supabase
            .from('order_details')
            .select('order_number')
            .in('order_number', allOrderNumbers)
            .in('article_code', ['FSITE', 'FSITEJ']);

          const fsiteOrderNumbers = new Set(fsiteOrders?.map(od => od.order_number) || []);
          const paidTrainedSipiNumbers = new Set(
            allOrders?.filter(o => fsiteOrderNumbers.has(o.order_number)).map(o => o.sipi_number) || []
          );

          const { data: allCompaniesWithReport } = await supabase
            .from('companies')
            .select('sipi_number')
            .gte('report_creation_date', `${selectedYear}-01-01`)
            .lte('report_creation_date', `${selectedYear}-12-31`);

          const reportSipiNumbers = new Set(allCompaniesWithReport?.map(c => c.sipi_number) || []);
          const allTrainedSipiNumbers = new Set([...paidTrainedSipiNumbers, ...reportSipiNumbers]);

          const { data: trainedCompaniesOrders } = await supabase
            .from('orders')
            .select('sipi_number, amount')
            .in('sipi_number', Array.from(allTrainedSipiNumbers))
            .gte('order_date', `${selectedYear}-01-01`)
            .lte('order_date', `${selectedYear}-12-31`);

          const securedRevenue = trainedCompaniesOrders?.reduce((sum, o) => sum + (o.amount || 0), 0) || 0;

          const { data: historicalOrders } = await supabase
            .from('orders')
            .select('sipi_number, amount')
            .in('sipi_number', Array.from(allTrainedSipiNumbers));

          const sipiAvgMap = new Map<string, { sum: number; count: number }>();
          historicalOrders?.forEach(o => {
            const current = sipiAvgMap.get(o.sipi_number) || { sum: 0, count: 0 };
            sipiAvgMap.set(o.sipi_number, { sum: current.sum + (o.amount || 0), count: current.count + 1 });
          });

          const securedRevenueAvg = Array.from(sipiAvgMap.values()).reduce(
            (sum, val) => sum + (val.count > 0 ? val.sum / val.count : 0), 0
          );

          setStats({
            paid_trainings: paidTrainedSipiNumbers.size,
            total_trainings: allTrainedSipiNumbers.size,
            secured_revenue: securedRevenue,
            secured_revenue_avg: securedRevenueAvg
          });

          const { data: sectors } = await supabase
            .from('department_management')
            .select('formateur')
            .order('formateur');
          
          const allFormateurs = [...new Set(
            sectors?.map(s => s.formateur)
              .filter(f => f && f.trim() !== '' && f !== '-') || []
          )];

          const allTrainingData: any[] = [];
          for (const formateurName of allFormateurs) {
            const { data: formateurTraining } = await supabase.rpc('get_fo_training_data', {
              _formateur: formateurName,
              _year: selectedYear
            });

            if (formateurTraining) {
              allTrainingData.push(...formateurTraining);
            }
          }

          const allCompanies = await encryptedCompaniesService.getAllCompanies();
          const companyMap = new Map(
            allCompanies.map(c => [c.sipiNumber, c.companyName])
          );

          const sipiMap = new Map();
          allTrainingData.forEach(row => {
            const existing = sipiMap.get(row.sipi_number);
            if (!existing || new Date(row.report_creation_date) > new Date(existing.report_creation_date)) {
              sipiMap.set(row.sipi_number, row);
            }
          });

          const allCompaniesData: TrainingCompany[] = Array.from(sipiMap.values()).map(row => ({
            sipi_number: row.sipi_number,
            company_name: companyMap.get(row.sipi_number) || row.company_name,
            training_date: row.report_creation_date,
            total_orders: Number(row.paid_orders_count || 0),
            total_amount: Number(row.paid_orders_amount || 0),
            total_orders_all: Number(row.all_orders_count_year || 0),
            total_amount_all: Number(row.all_orders_amount_year || 0)
          }));

          const paidTrainings = allCompaniesData.filter(c => c.total_orders && c.total_orders > 0);
          const paidSipiNumbers = new Set(paidTrainings.map(c => c.sipi_number));
          const freeTrainings = allCompaniesData.filter(c => !paidSipiNumbers.has(c.sipi_number));

          setPaidCompanies(paidTrainings);
          setAllCompanies(allCompaniesData);
          setFreeCompanies(freeTrainings);

          const totalFsiteOrdersCount = allTrainingData.reduce((sum, row) => {
            return sum + (Number(row.paid_orders_count) || 0);
          }, 0);
          
          const totalFsiteAmountSum = allTrainingData.reduce((sum, row) => {
            return sum + (Number(row.paid_orders_amount) || 0);
          }, 0);
          
          setTotalFsiteOrders(totalFsiteOrdersCount);
          setTotalFsiteAmount(totalFsiteAmountSum);
        } else {
          const { data: summaryData } = await supabase.rpc('get_fo_training_summary', {
            _formateur: selectedSector,
            _year: selectedYear
          });

          const { data: trainingData } = await supabase.rpc('get_fo_training_data', {
            _formateur: selectedSector,
            _year: selectedYear
          });

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

          const allCompanies = await encryptedCompaniesService.getAllCompanies();
          const companyMap = new Map(
            allCompanies.map(c => [c.sipiNumber, c.companyName])
          );

          const allCompaniesData: TrainingCompany[] = (trainingData || []).map(row => ({
            sipi_number: row.sipi_number,
            company_name: companyMap.get(row.sipi_number) || row.company_name,
            training_date: row.report_creation_date,
            total_orders: Number(row.paid_orders_count || 0),
            total_amount: Number(row.paid_orders_amount || 0),
            total_orders_all: Number(row.all_orders_count_year || 0),
            total_amount_all: Number(row.all_orders_amount_year || 0)
          }));

          const paidTrainings = allCompaniesData.filter(c => c.total_orders && c.total_orders > 0);
          const paidSipiNumbers = new Set(paidTrainings.map(c => c.sipi_number));
          const freeTrainings = allCompaniesData.filter(c => !paidSipiNumbers.has(c.sipi_number));

          setPaidCompanies(paidTrainings);
          setAllCompanies(allCompaniesData);
          setFreeCompanies(freeTrainings);

          const { data: depts } = await supabase
            .from('department_management')
            .select('department_name')
            .eq('formateur', selectedSector);
          
          const sectorDepartmentNames = depts?.map(d => d.department_name) || [];

          const { data: sectorCompanies } = await supabase
            .from('companies')
            .select('sipi_number')
            .in('general_department', sectorDepartmentNames);

          const sectorSipiNumbers = sectorCompanies?.map(c => c.sipi_number) || [];

          const { data: orders } = await supabase
            .from('orders')
            .select('order_number, order_date, amount, sipi_number')
            .in('sipi_number', sectorSipiNumbers)
            .gte('order_date', `${selectedYear}-01-01`)
            .lte('order_date', `${selectedYear}-12-31`);

          const orderNumbers = orders?.map(o => o.order_number) || [];

          const { data: orderDetails } = await supabase
            .from('order_details')
            .select('order_number, quantity, article_code')
            .in('order_number', orderNumbers)
            .or('article_code.ilike.FSITE%,article_code.ilike.FSITEJ%');

          const orderMap = new Map((orders || []).map(o => [o.order_number, o]));
          const uniqueOrderNumbers = new Set(
            (orderDetails || [])
              .filter(od => orderMap.has(od.order_number))
              .map(od => od.order_number)
          );

          const totalOrders = uniqueOrderNumbers.size;
          const totalAmount = Array.from(uniqueOrderNumbers)
            .reduce((sum, orderNumber) => {
              const order = orderMap.get(orderNumber);
              return sum + (order?.amount || 0);
            }, 0);
          
          setTotalFsiteOrders(totalOrders);
          setTotalFsiteAmount(totalAmount);
        }

        const { data: deptData } = await supabase
          .from('department_management')
          .select('*');

        if (deptData) {
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
    try {
      // Récupérer les données de base depuis la table companies
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('sipi_number', sipiNumber)
        .maybeSingle();

      if (companyData) {
        // Récupérer l'entreprise décryptée via le service
        const decryptedCompany = await encryptedCompaniesService.getCompanyBySipi(sipiNumber);

        setSelectedCompany({
          ...companyData,
          company_name: companyName,
          // Remplacer par les données décryptées si disponibles
          address1: decryptedCompany?.address1 || companyData.address1,
          address2: decryptedCompany?.address2 || companyData.address2,
          city: decryptedCompany?.city || companyData.city,
          postal_code: decryptedCompany?.postalCode || companyData.postal_code,
        });
        setCompanyDetailOpen(true);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'entreprise:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails de l'entreprise",
        variant: "destructive"
      });
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
      {/* Header */}
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
          {/* KPI Cards */}
          <TooltipProvider>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Formations Payantes
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Méthode de calcul :</p>
                        <p>Entreprises ayant passé au moins une commande avec les articles FSITE ou FSITEJ durant l'année sélectionnée. Le décompte est basé sur la date de commande SIPI.</p>
                      </TooltipContent>
                    </Tooltip>
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
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Formations Gratuites
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Méthode de calcul :</p>
                        <p>Entreprises ayant une date de formation (date de création du rapport SIPI) dans l'année sélectionnée, mais sans commande FSITE/FSITEJ associée. Ce sont des formations non facturées.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{freeCompanies.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Basé sur date formation (rapport SIPI)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    CA Sécurisé
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Méthode de calcul :</p>
                        <p>Somme totale du chiffre d'affaires généré par toutes les commandes (tous articles confondus) des entreprises formées durant l'année. Inclut toutes les commandes de l'année, pas uniquement les formations.</p>
                      </TooltipContent>
                    </Tooltip>
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

            </div>
          </TooltipProvider>

          {/* Additional KPIs */}
          <TooltipProvider>
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Taux de Fidélisation (2 ans)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Méthode de calcul :</p>
                        <p>Pourcentage moyen de renouvellement des articles commandés sur un cycle de 2 ans. Compare les articles commandés il y a 2 ans avec ceux de l'année de formation pour mesurer la fidélité client.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {kpis.fidélisationRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Taux de renouvellement moyen sur cycle 2 ans
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    ROI Moyen
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Méthode de calcul :</p>
                        <p>Retour sur investissement moyen des formations. Calculé en divisant le CA sécurisé total par le coût estimé des formations (1000€ par formation payante).</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {kpis.avgROI.toFixed(1)}x
                  </div>
                  <p className="text-xs text-muted-foreground">
                    CA sécurisé / coût formations
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Total FSITE + FSITEJ
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Méthode de calcul :</p>
                        <p>Nombre total et montant cumulé des commandes contenant les articles FSITE ou FSITEJ pour le secteur sélectionné durant l'année. Toutes les commandes formation confondues.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <GraduationCap className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalFsiteOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR'
                    }).format(totalFsiteAmount)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TooltipProvider>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Monthly Evolution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Évolution Mensuelle des Formations</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="payantes" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Payantes" />
                    <Line type="monotone" dataKey="gratuites" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Gratuites" />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-5))" strokeWidth={2} strokeDasharray="5 5" name="Total" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Répartition des Formations</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* CA Evolution Chart */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Évolution du CA par Mois</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyCAData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value: number) => new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                      }).format(value)}
                    />
                    <Legend />
                    <Bar dataKey="ca" fill="hsl(var(--primary))" name="Chiffre d'Affaires" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtres Avancés
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Input
                  type="number"
                  placeholder="CA minimum"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, 'dd MMM', { locale: fr })} -{' '}
                            {format(dateRange.to, 'dd MMM yyyy', { locale: fr })}
                          </>
                        ) : (
                          format(dateRange.from, 'dd MMM yyyy', { locale: fr })
                        )
                      ) : (
                        <span>Période</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => setDateRange(range || {})}
                      numberOfMonths={2}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>

                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('');
                    setMinAmount('');
                    setDateRange({});
                  }}
                >
                  Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Development Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Développement Généré par les Formations (Cycle 2 ans)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Analyse du développement pour toutes les formations - Comparaison des quantités commandées 2 ans avant vs année de formation
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

                  {/* Métriques d'expiration */}
                  <div className="grid gap-4 md:grid-cols-4 mb-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Produits Actifs</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {developmentMetrics.reduce((sum, m) => sum + m.active_quantity, 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          En stock valide
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Produits Expirés</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {developmentMetrics.reduce((sum, m) => sum + m.expired_quantity, 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          À renouveler
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Expiration Proche</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                          {developmentMetrics.reduce((sum, m) => sum + m.expiring_soon_quantity, 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dans les 3 mois
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Taux d'Expiration Moyen</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {(developmentMetrics.reduce((sum, m) => sum + m.expired_percentage, 0) / developmentMetrics.length).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Par entreprise
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex gap-2 justify-end mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport('development')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exporter Développement
                    </Button>
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
                        <TableHead className="text-right">Actifs</TableHead>
                        <TableHead className="text-right">Expirés</TableHead>
                        <TableHead className="text-right">Proche Exp.</TableHead>
                        <TableHead>Prochaine Exp.</TableHead>
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
                          <TableCell className="text-right text-green-600 font-medium">
                            {metric.active_quantity}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {metric.expired_quantity}
                          </TableCell>
                          <TableCell className="text-right text-orange-600 font-medium">
                            {metric.expiring_soon_quantity}
                          </TableCell>
                          <TableCell className="text-sm">
                            {metric.next_expiration_date ? (
                              <span className={
                                new Date(metric.next_expiration_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                                  ? 'text-orange-600 font-medium'
                                  : 'text-muted-foreground'
                              }>
                                {new Date(metric.next_expiration_date).toLocaleDateString('fr-FR')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs with Data Tables */}
          <Tabs defaultValue="paid" className="space-y-4">
            <TabsList>
              <TabsTrigger value="paid">Formations Payantes ({filteredPaidCompanies.length})</TabsTrigger>
              <TabsTrigger value="free">Formations Gratuites ({filteredFreeCompanies.length})</TabsTrigger>
              <TabsTrigger value="all">Toutes ({allCompanies.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="paid" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Entreprises Formées avec Commandes</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('paid')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                  </Button>
                </CardHeader>
                <CardContent>
                  {filteredPaidCompanies.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Aucune entreprise formée avec commande trouvée
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
                        {filteredPaidCompanies.map((company) => (
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Entreprises Formées (Gratuites)</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('free')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                  </Button>
                </CardHeader>
                <CardContent>
                  {filteredFreeCompanies.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Aucune entreprise trouvée
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SIPI</TableHead>
                          <TableHead>Entreprise</TableHead>
                          <TableHead>Date Formation</TableHead>
                          <TableHead className="text-right">Commandes Année</TableHead>
                          <TableHead className="text-right">CA Année</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFreeCompanies.map((company) => (
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
                            <TableCell className="text-right">{company.total_orders_all}</TableCell>
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Toutes les Formations</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('all')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SIPI</TableHead>
                        <TableHead>Entreprise</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Type</TableHead>
                        <TableHead className="text-right">CA</TableHead>
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
                            {company.total_orders && company.total_orders > 0 ? 'Payante' : 'Gratuite'}
                          </TableCell>
                          <TableCell className="text-right">
                            {new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(company.total_amount || company.total_amount_all || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <CompanyDetailDialog
        company={selectedCompany}
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        departmentManagement={departmentManagement}
      />
    </div>
  );
}
