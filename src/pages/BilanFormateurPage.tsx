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
import { Loader2, GraduationCap, DollarSign, BarChart3, TrendingUp, Download, Search, Calendar as CalendarIcon, Filter, HelpCircle, Activity, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
  total_amount_2years?: number;
}

type SortField = 'company_name' | 'training_date' | 'total_orders' | 'total_amount' | 'total_amount_2years';
type SortDirection = 'asc' | 'desc';

const COLORS = {
  payantes: 'hsl(221, 83%, 53%)', // Bleu vif
  gratuites: 'hsl(142, 76%, 36%)', // Vert
  total: 'hsl(280, 65%, 60%)', // Violet
  revenue: 'hsl(24, 95%, 53%)', // Orange
};

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
  const [securedRevenueN1, setSecuredRevenueN1] = useState<number>(0);
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

  // Sorting
  const [sortField, setSortField] = useState<SortField>('total_amount_2years');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
    const filtered = paidCompanies.filter(company => {
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

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortField) {
        case 'company_name':
          aValue = a.company_name.toLowerCase();
          bValue = b.company_name.toLowerCase();
          break;
        case 'training_date':
          aValue = new Date(a.training_date).getTime();
          bValue = new Date(b.training_date).getTime();
          break;
        case 'total_orders':
          aValue = a.total_orders || 0;
          bValue = b.total_orders || 0;
          break;
        case 'total_amount':
          aValue = a.total_amount || 0;
          bValue = b.total_amount || 0;
          break;
        case 'total_amount_2years':
          aValue = a.total_amount_2years || 0;
          bValue = b.total_amount_2years || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [paidCompanies, searchTerm, minAmount, dateRange, sortField, sortDirection]);

  const filteredFreeCompanies = useMemo(() => {
    const filtered = freeCompanies.filter(company => {
      const matchesSearch = searchTerm === '' || 
        company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.sipi_number.includes(searchTerm);
      
      const matchesDateRange = !dateRange.from || !dateRange.to ||
        (new Date(company.training_date) >= dateRange.from && 
         new Date(company.training_date) <= dateRange.to);
      
      return matchesSearch && matchesDateRange;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortField) {
        case 'training_date':
          aValue = new Date(a.training_date).getTime();
          bValue = new Date(b.training_date).getTime();
          break;
        case 'total_amount_2years':
          aValue = a.total_amount_2years || 0;
          bValue = b.total_amount_2years || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [freeCompanies, searchTerm, dateRange, sortField, sortDirection]);

  const sortedAllCompanies = useMemo(() => {
    return [...allCompanies].sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortField) {
        case 'training_date':
          aValue = new Date(a.training_date).getTime();
          bValue = new Date(b.training_date).getTime();
          break;
        case 'total_amount_2years':
          aValue = a.total_amount_2years || 0;
          bValue = b.total_amount_2years || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allCompanies, sortField, sortDirection]);

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

          // Récupérer le CA N-1 pour les entreprises formées
          const { data: trainedCompaniesOrdersN1 } = await supabase
            .from('orders')
            .select('sipi_number, amount')
            .in('sipi_number', Array.from(allTrainedSipiNumbers))
            .gte('order_date', `${selectedYear - 1}-01-01`)
            .lte('order_date', `${selectedYear - 1}-12-31`);

          const securedRevenueN1Value = trainedCompaniesOrdersN1?.reduce((sum, o) => sum + (o.amount || 0), 0) || 0;
          setSecuredRevenueN1(securedRevenueN1Value);

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

          // Fetch 2-year CA for all trained companies
          const trainedSipiNumbers = Array.from(sipiMap.keys());
          const { data: orders2Years } = await supabase
            .from('orders')
            .select('sipi_number, amount')
            .in('sipi_number', trainedSipiNumbers)
            .gte('order_date', `${selectedYear - 1}-01-01`)
            .lte('order_date', `${selectedYear}-12-31`);

          const amount2YearsMap = new Map<string, number>();
          orders2Years?.forEach(o => {
            const current = amount2YearsMap.get(o.sipi_number) || 0;
            amount2YearsMap.set(o.sipi_number, current + (o.amount || 0));
          });

          const allCompaniesData: TrainingCompany[] = Array.from(sipiMap.values()).map(row => ({
            sipi_number: row.sipi_number,
            company_name: companyMap.get(row.sipi_number) || row.company_name,
            training_date: row.report_creation_date,
            total_orders: Number(row.paid_orders_count || 0),
            total_amount: Number(row.paid_orders_amount || 0),
            total_orders_all: Number(row.all_orders_count_year || 0),
            total_amount_all: Number(row.all_orders_amount_year || 0),
            total_amount_2years: amount2YearsMap.get(row.sipi_number) || 0
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

          // Récupérer le CA N-1 pour les entreprises formées du secteur
          const { data: summaryDataN1 } = await supabase.rpc('get_fo_training_summary', {
            _formateur: selectedSector,
            _year: selectedYear - 1
          });
          
          // Récupérer les sipi des entreprises formées cette année pour calculer leur CA N-1
          const { data: trainingDataForN1 } = await supabase.rpc('get_fo_training_data', {
            _formateur: selectedSector,
            _year: selectedYear
          });
          
          const trainedSipiNumbers = trainingDataForN1?.map(row => row.sipi_number) || [];
          
          if (trainedSipiNumbers.length > 0) {
            const { data: ordersN1 } = await supabase
              .from('orders')
              .select('sipi_number, amount')
              .in('sipi_number', trainedSipiNumbers)
              .gte('order_date', `${selectedYear - 1}-01-01`)
              .lte('order_date', `${selectedYear - 1}-12-31`);
            
            const securedRevenueN1Value = ordersN1?.reduce((sum, o) => sum + (o.amount || 0), 0) || 0;
            setSecuredRevenueN1(securedRevenueN1Value);
          } else {
            setSecuredRevenueN1(0);
          }

          const allCompanies = await encryptedCompaniesService.getAllCompanies();
          const companyMap = new Map(
            allCompanies.map(c => [c.sipiNumber, c.companyName])
          );

          // Fetch 2-year CA for trained companies
          const sipisFor2YearsCA = (trainingData || []).map(row => row.sipi_number);
          const { data: orders2Years } = await supabase
            .from('orders')
            .select('sipi_number, amount')
            .in('sipi_number', sipisFor2YearsCA)
            .gte('order_date', `${selectedYear - 1}-01-01`)
            .lte('order_date', `${selectedYear}-12-31`);

          const amount2YearsMap = new Map<string, number>();
          orders2Years?.forEach(o => {
            const current = amount2YearsMap.get(o.sipi_number) || 0;
            amount2YearsMap.set(o.sipi_number, current + (o.amount || 0));
          });

          const allCompaniesData: TrainingCompany[] = (trainingData || []).map(row => ({
            sipi_number: row.sipi_number,
            company_name: companyMap.get(row.sipi_number) || row.company_name,
            training_date: row.report_creation_date,
            total_orders: Number(row.paid_orders_count || 0),
            total_amount: Number(row.paid_orders_amount || 0),
            total_orders_all: Number(row.all_orders_count_year || 0),
            total_amount_all: Number(row.all_orders_amount_year || 0),
            total_amount_2years: amount2YearsMap.get(row.sipi_number) || 0
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
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
                  <div className="rounded-full bg-blue-100 p-2">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{paidCompanies.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Basé sur date commande SIPI
                  </p>
                  <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500" 
                      style={{ width: `${(paidCompanies.length / (paidCompanies.length + freeCompanies.length)) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow">
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
                  <div className="rounded-full bg-green-100 p-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{freeCompanies.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Basé sur date formation (rapport SIPI)
                  </p>
                  <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-500" 
                      style={{ width: `${(freeCompanies.length / (paidCompanies.length + freeCompanies.length)) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500 shadow-md hover:shadow-lg transition-shadow">
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
                  <div className="rounded-full bg-orange-100 p-2">
                    <DollarSign className="h-5 w-5 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(stats?.secured_revenue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Toutes commandes de l'année
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    CA Moyen Historique
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Méthode de calcul :</p>
                        <p>Moyenne historique du chiffre d'affaires par commande pour les entreprises formées, calculée sur l'ensemble des commandes passées (toutes années confondues).</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <div className="rounded-full bg-purple-100 p-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(stats?.secured_revenue_avg || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Moyenne des commandes
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-cyan-500 shadow-md hover:shadow-lg transition-shadow col-span-full md:col-span-2 lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    CA Sécurisé sur 2 ans
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-1">Méthode de calcul :</p>
                        <p>Somme du CA sécurisé de l'année sélectionnée ({selectedYear}) et de l'année précédente ({selectedYear - 1}) pour les entreprises formées cette année.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <div className="rounded-full bg-cyan-100 p-2">
                    <TrendingUp className="h-5 w-5 text-cyan-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-cyan-600">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format((stats?.secured_revenue || 0) + securedRevenueN1)}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{selectedYear}: {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(stats?.secured_revenue || 0)}</span>
                    <span>{selectedYear - 1}: {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(securedRevenueN1)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TooltipProvider>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Monthly Evolution Chart */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Évolution Mensuelle des Formations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="payantes" 
                      stroke={COLORS.payantes}
                      strokeWidth={3} 
                      name="Payantes"
                      dot={{ fill: COLORS.payantes, r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gratuites" 
                      stroke={COLORS.gratuites}
                      strokeWidth={3} 
                      name="Gratuites"
                      dot={{ fill: COLORS.gratuites, r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke={COLORS.total}
                      strokeWidth={3} 
                      strokeDasharray="5 5" 
                      name="Total"
                      dot={{ fill: COLORS.total, r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Répartition des Formations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === 0 ? COLORS.payantes : COLORS.gratuites}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px'
                      }}
                    />
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
                Développement Généré par les Formations
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Analyse du développement pour toutes les formations - Comparaison des quantités commandées vs année précédente (N-1)
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
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
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
                        <CardTitle className="text-sm font-medium">Croissance Qté Moyenne vs N-1</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${(developmentMetrics.reduce((sum, m) => sum + m.growth_vs_minus_1, 0) / developmentMetrics.length) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(developmentMetrics.reduce((sum, m) => sum + m.growth_vs_minus_1, 0) / developmentMetrics.length).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          vs {selectedYear - 1}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Croissance CA Moyenne vs N-1</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${(developmentMetrics.reduce((sum, m) => sum + m.amount_growth_vs_minus_1, 0) / developmentMetrics.length) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(developmentMetrics.reduce((sum, m) => sum + m.amount_growth_vs_minus_1, 0) / developmentMetrics.length).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          vs {selectedYear - 1}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          Croissance Qté vs Cycle 24-30 mois
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Comparaison avec la période 24-30 mois avant, plus représentative du cycle réel de renouvellement des produits.</p>
                            </TooltipContent>
                          </Tooltip>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${(developmentMetrics.reduce((sum, m) => sum + m.growth_vs_renewal_window, 0) / developmentMetrics.length) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(developmentMetrics.reduce((sum, m) => sum + m.growth_vs_renewal_window, 0) / developmentMetrics.length).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          vs période 24-30 mois
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          Croissance CA vs Cycle 24-30 mois
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Comparaison du chiffre d'affaires avec la période 24-30 mois avant, correspondant au cycle de renouvellement des produits (~2 ans).</p>
                            </TooltipContent>
                          </Tooltip>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${(developmentMetrics.reduce((sum, m) => sum + m.amount_growth_vs_renewal_window, 0) / developmentMetrics.length) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(developmentMetrics.reduce((sum, m) => sum + m.amount_growth_vs_renewal_window, 0) / developmentMetrics.length).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          vs période 24-30 mois
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          Taux Renouvellement Cycle
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Pourcentage de références commandées il y a 24-30 mois qui ont été renouvelées cette année.</p>
                            </TooltipContent>
                          </Tooltip>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${(developmentMetrics.reduce((sum, m) => sum + m.renewal_rate_window, 0) / developmentMetrics.length) > 50 ? 'text-green-600' : 'text-orange-600'}`}>
                          {(developmentMetrics.reduce((sum, m) => sum + m.renewal_rate_window, 0) / developmentMetrics.length).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Références renouvelées
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
                        <TableHead className="text-right">Qté Année</TableHead>
                        <TableHead className="text-right">CA Année</TableHead>
                        <TableHead className="text-right">Croiss. Qté N-1</TableHead>
                        <TableHead className="text-right">Croiss. CA N-1</TableHead>
                        <TableHead className="text-right">Croiss. Qté Cycle</TableHead>
                        <TableHead className="text-right">Croiss. CA Cycle</TableHead>
                        <TableHead className="text-right">Taux Renouv. Cycle</TableHead>
                        <TableHead className="text-right">Actifs</TableHead>
                        <TableHead className="text-right">Expirés</TableHead>
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
                          <TableCell className="text-right font-semibold">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(metric.training_year_amount)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${metric.growth_vs_minus_1 > 0 ? 'text-green-600' : metric.growth_vs_minus_1 < 0 ? 'text-red-600' : ''}`}>
                            {metric.growth_vs_minus_1 > 0 ? '+' : ''}{metric.growth_vs_minus_1}%
                          </TableCell>
                          <TableCell className={`text-right font-medium ${metric.amount_growth_vs_minus_1 > 0 ? 'text-green-600' : metric.amount_growth_vs_minus_1 < 0 ? 'text-red-600' : ''}`}>
                            {metric.amount_growth_vs_minus_1 > 0 ? '+' : ''}{metric.amount_growth_vs_minus_1}%
                          </TableCell>
                          <TableCell className={`text-right font-medium ${metric.growth_vs_renewal_window > 0 ? 'text-green-600' : metric.growth_vs_renewal_window < 0 ? 'text-red-600' : ''}`}>
                            {metric.growth_vs_renewal_window > 0 ? '+' : ''}{metric.growth_vs_renewal_window}%
                          </TableCell>
                          <TableCell className={`text-right font-medium ${metric.amount_growth_vs_renewal_window > 0 ? 'text-green-600' : metric.amount_growth_vs_renewal_window < 0 ? 'text-red-600' : ''}`}>
                            {metric.amount_growth_vs_renewal_window > 0 ? '+' : ''}{metric.amount_growth_vs_renewal_window}%
                          </TableCell>
                          <TableCell className={`text-right font-medium ${metric.renewal_rate_window > 50 ? 'text-green-600' : 'text-orange-600'}`}>
                            {metric.renewal_rate_window}%
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {metric.active_quantity}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {metric.expired_quantity}
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
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (sortField === 'company_name') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('company_name');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              Entreprise
                              {sortField === 'company_name' ? (
                                sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                              ) : (
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (sortField === 'training_date') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('training_date');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              Date Formation
                              {sortField === 'training_date' ? (
                                sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                              ) : (
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-right cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (sortField === 'total_orders') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('total_orders');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Nb Cmd
                              {sortField === 'total_orders' ? (
                                sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                              ) : (
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-right cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (sortField === 'total_amount_2years') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('total_amount_2years');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              CA 2 ans
                              {sortField === 'total_amount_2years' ? (
                                sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                              ) : (
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableHead>
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
                            <TableCell className="text-right font-semibold">
                              {new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(company.total_amount_2years || 0)}
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
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (sortField === 'training_date') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('training_date');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              Date Formation
                              {sortField === 'training_date' ? (
                                sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                              ) : (
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Commandes Année</TableHead>
                          <TableHead 
                            className="text-right cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (sortField === 'total_amount_2years') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('total_amount_2years');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              CA 2 ans
                              {sortField === 'total_amount_2years' ? (
                                sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                              ) : (
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableHead>
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
                            <TableCell className="text-right font-semibold">
                              {new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(company.total_amount_2years || 0)}
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
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (sortField === 'training_date') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('training_date');
                              setSortDirection('desc');
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Date
                            {sortField === 'training_date' ? (
                              sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="text-right">Type</TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (sortField === 'total_amount_2years') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('total_amount_2years');
                              setSortDirection('desc');
                            }
                          }}
                        >
                          <div className="flex items-center justify-end gap-1">
                            CA 2 ans
                            {sortField === 'total_amount_2years' ? (
                              sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAllCompanies.map((company) => (
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
                          <TableCell className="text-right font-semibold">
                            {new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(company.total_amount_2years || 0)}
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
