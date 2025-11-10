import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Filter, ChevronDown, Search, CalendarIcon, ChevronUp, ArrowUpDown, Settings2, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import CompanyDetailDialog from './CompanyDetailDialog';
import { useUserViewPreferences } from '@/hooks/useUserViewPreferences';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DragDropList } from './DragDropList';
import { Separator } from './ui/separator';
import { useEncryptedCompanies } from '@/hooks/useEncryptedCompanies';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  postal_code?: string;
  general_department?: string;
  client_blocked_date?: string;
  training_date?: string;
  report_creation_date?: string;
  last_order_date?: string;
  last_training_order_date?: string; // Dernière commande FSITE/FSITEJ
  quality?: string;
  amount_2023?: number;
  amount_2024?: number;
  amount_2025?: number;
  order_count_2023?: number;
  order_count_2024?: number;
  order_count_2025?: number;
  avg_amount?: number;
  orderStats?: CompanyOrderStats[];
  averageOrderPerYear?: number;
  averageAmountPerYear?: number;
  periodOrders?: number;
  periodAmount?: number;
  next_renewal_date?: string; // Prochaine date de péremption
}

interface CompanyOrderStats {
  year: number;
  totalOrders: number;
  totalAmount: number;
}

interface CompaniesTableOnlyProps {
  startDate?: Date;
  endDate?: Date;
  onDateChange?: {
    setStartDate: (date: Date | undefined) => void;
    setEndDate: (date: Date | undefined) => void;
  };
  onFilteredDataChange?: (companies: Company[]) => void;
}

const CompaniesTableOnly = ({ 
  startDate: externalStartDate,
  endDate: externalEndDate,
  onDateChange,
  onFilteredDataChange
}: CompaniesTableOnlyProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  
  // Company detail dialog state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);
  
  // Filtres
  const [sipiFilter, setSipiFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [companyNameFilter, setCompanyNameFilter] = useState('');
  const [minAverageFilter, setMinAverageFilter] = useState('');
  const [maxAverageFilter, setMaxAverageFilter] = useState('');
  const [formationFilter, setFormationFilter] = useState('');
  const [responsableBOFilter, setResponsableBOFilter] = useState('');
  const [formateurFilter, setFormateurFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [lisOnlyFilter, setLisOnlyFilter] = useState<'oui' | 'non' | ''>('');

  // Department management data
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});
  
  // LIS companies set
  const [lisCompanySipiNumbers, setLisCompanySipiNumbers] = useState<Set<string>>(new Set());
  
  // Article filter states
  const [availableArticles, setAvailableArticles] = useState<string[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [articleCompanyMap, setArticleCompanyMap] = useState<Map<string, Set<string>>>(new Map());
  
  // Date filters - use external ones if provided, otherwise local state
  const [localStartDate, setLocalStartDate] = useState<Date>();
  const [localEndDate, setLocalEndDate] = useState<Date>();
  
  const startDate = externalStartDate ?? localStartDate;
  const endDate = externalEndDate ?? localEndDate;
  
  const setStartDate = onDateChange?.setStartDate ?? setLocalStartDate;
  const setEndDate = onDateChange?.setEndDate ?? setLocalEndDate;
  
  // Sort state
  const [sortColumn, setSortColumn] = useState<string | null>('averageAmountPerYear');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const { toast } = useToast();
  const { 
    companies: encryptedCompanies, 
    loading: encryptedLoading,
    loadCompanies: loadAllCompanies,
    loadCompaniesByArticles
  } = useEncryptedCompanies();

  // Column preferences - using 'table' for now, will create a reporting-specific view type later
  const { preferences, loading: preferencesLoading, toggleColumnVisibility, reorderColumns } = useUserViewPreferences('table');
  
  // Column manager state
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  
  // Local state for immediate UI updates in column manager
  const [localVisibleColumns, setLocalVisibleColumns] = useState<string[]>([]);
  const [localColumnOrder, setLocalColumnOrder] = useState<string[]>([]);
  
  // Track if we're currently updating to prevent loops
  const isUpdatingRef = React.useRef(false);

  // Load companies with filters
  useEffect(() => {
    const applyFilters = async () => {
      // Determine if we should use RPC filtering
      const useRpcFilter = lisOnlyFilter !== '' || selectedArticles.length > 0;
      
      if (useRpcFilter) {
        // Use encrypted companies service with article filtering
        await loadCompaniesByArticles(
          selectedArticles.length > 0 ? selectedArticles : null,
          lisOnlyFilter === 'oui' ? true : lisOnlyFilter === 'non' ? false : false
        );
      } else {
        // Load all companies via encrypted service
        await loadAllCompanies();
      }
    };
    
    applyFilters();
  }, [lisOnlyFilter, selectedArticles]);

  // Load all orders for date filtering
  useEffect(() => {
    const loadOrders = async () => {
      try {
        console.log('📦 Loading orders for date filtering...');
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('sipi_number, order_date, amount');
        
        if (ordersError) {
          console.error('Error loading orders:', ordersError);
        } else {
          setAllOrders(ordersData || []);
          console.log(`✅ Loaded ${ordersData?.length || 0} orders`);
        }
      } catch (error) {
        console.error('Error loading orders:', error);
      }
    };
    
    loadOrders();
  }, []);

  // Process companies data - Load from optimized edge function first, then filter by encrypted companies
  useEffect(() => {
    const loadData = async () => {
      // Si les entreprises décryptées sont en cours de chargement, attendre
      if (encryptedLoading) {
        setLoading(true);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('⚡ Loading company stats from edge function...');
        const startTime = Date.now();
        
        // Call the optimized edge function to get all stats
        const { data: statsData, error: statsError } = await supabase.functions.invoke('get-company-stats', {
          body: { maxThreshold: 999999999 }
        });

        if (statsError) {
          console.error('Error from edge function:', statsError);
          throw statsError;
        }

        const loadTime = Date.now() - startTime;
        console.log(`✅ Company stats loaded in ${loadTime}ms (${statsData?.length || 0} companies)`);

        // Build a set of encrypted company SIPI numbers for filtering
        const encryptedSipiSet = new Set(encryptedCompanies.map((c: any) => c.sipiNumber || c.sipi_number));
        
        // Filter stats to only include encrypted companies (if encryption filter is active)
        let filteredStats = statsData || [];
        if (encryptedCompanies && encryptedCompanies.length > 0) {
          filteredStats = filteredStats.filter((stat: any) => encryptedSipiSet.has(stat.sipi_number));
        }
        
        console.log(`🔐 Filtered to ${filteredStats.length} companies (from ${statsData?.length || 0} total)`);

        // Transform to expected Company format
        const companiesWithStats: Company[] = filteredStats.map((stat: any) => {
          // Build orderStats from the stats data with order counts
          const orderStats: CompanyOrderStats[] = [];
          
          // Always include all 3 years, even with 0 orders
          orderStats.push({
            year: 2023,
            totalOrders: stat.order_count_2023 || 0,
            totalAmount: parseFloat(stat.amount_2023) || 0
          });
          
          orderStats.push({
            year: 2024,
            totalOrders: stat.order_count_2024 || 0,
            totalAmount: parseFloat(stat.amount_2024) || 0
          });

          orderStats.push({
            year: 2025,
            totalOrders: stat.order_count_2025 || 0,
            totalAmount: parseFloat(stat.amount_2025) || 0
          });
          
          const totalOrders = orderStats.reduce((sum, s) => sum + s.totalOrders, 0);
          const averageOrderPerYear = orderStats.length > 0 ? totalOrders / orderStats.length : 0;

          return {
            id: stat.company_id,
            sipi_number: stat.sipi_number,
            company_name: stat.company_name,
            latitude: parseFloat(stat.latitude) || 0,
            longitude: parseFloat(stat.longitude) || 0,
            address1: stat.address1,
            city: stat.city,
            postal_code: stat.postal_code,
            general_department: stat.general_department,
            quality: stat.quality,
            amount_2023: parseFloat(stat.amount_2023) || 0,
            amount_2024: parseFloat(stat.amount_2024) || 0,
            amount_2025: parseFloat(stat.amount_2025) || 0,
            order_count_2023: stat.order_count_2023 || 0,
            order_count_2024: stat.order_count_2024 || 0,
            order_count_2025: stat.order_count_2025 || 0,
            avg_amount: parseFloat(stat.avg_amount) || 0,
            orderStats,
            averageOrderPerYear,
            averageAmountPerYear: ((parseFloat(stat.amount_2023) || 0) + (parseFloat(stat.amount_2024) || 0) + (parseFloat(stat.amount_2025) || 0)) / 3,
            last_training_order_date: stat.last_training_order_date || undefined,
            report_creation_date: stat.report_creation_date || undefined,
            next_renewal_date: stat.next_renewal || undefined
          };
        });

        setCompanies(companiesWithStats);
        setTotalCompanies(companiesWithStats.length);
        console.log(`📊 Companies with next renewal: ${companiesWithStats.filter(c => c.next_renewal_date).length}`);

        // Load department management data (admins only can see this now)
        const { data: deptData, error: deptError } = await supabase
          .from('department_management')
          .select('*');

        if (deptError) {
          // Silently fail if user doesn't have access
          if (deptError.code !== 'PGRST116') {
            console.error('Error loading department management:', deptError);
          }
        } else if (deptData) {
          const deptMap: Record<string, any> = {};
          deptData.forEach(dept => {
            deptMap[dept.department_name] = dept;
          });
          setDepartmentManagement(deptMap);
        }

        // Load available articles for the filter dropdown
        const { data: allArticlesData, error: articlesError } = await supabase
          .from('order_details')
          .select('article_code');

        if (!articlesError && allArticlesData) {
          const uniqueArticles = Array.from(new Set(allArticlesData.map(d => d.article_code).filter(Boolean)));
          setAvailableArticles(uniqueArticles.sort());
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [encryptedCompanies, encryptedLoading]);

  // Filter companies based on all criteria INCLUDING date range
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // SIPI filter
      if (sipiFilter && !company.sipi_number?.toLowerCase().includes(sipiFilter.toLowerCase())) {
        return false;
      }
      
      // City filter
      if (cityFilter && !company.city?.toLowerCase().includes(cityFilter.toLowerCase())) {
        return false;
      }
      
      // Company name filter
      if (companyNameFilter && !company.company_name?.toLowerCase().includes(companyNameFilter.toLowerCase())) {
        return false;
      }
      
      // Department filter
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(company.general_department || '')) {
        return false;
      }

      // Formateur filter
      if (formateurFilter && company.general_department) {
        const deptData = departmentManagement[company.general_department];
        if (!deptData || deptData.formateur !== formateurFilter) {
          return false;
        }
      }

      // Responsable BO filter
      if (responsableBOFilter && company.general_department) {
        const deptData = departmentManagement[company.general_department];
        if (!deptData || deptData.responsable_bo !== responsableBOFilter) {
          return false;
        }
      }

      // Quality filter
      if (qualityFilter) {
        const displayQuality = company.quality === 'Industrie' ? 'Client' : company.quality === 'Distributeur' ? 'Revendeur' : company.quality;
        if (displayQuality !== qualityFilter) {
          return false;
        }
      }

      // LIS Only filter and article filters are now handled server-side via RPC
      // No need for client-side filtering of these

      // Formation filter
      if (formationFilter) {
        const formationStatus = company.last_training_order_date 
          ? 'Structure Formée (Uniquement payant)' 
          : company.report_creation_date 
          ? 'Structure Formée* (Payant comme gratuit)' 
          : 'Structure non formée';
        
        if (formationStatus !== formationFilter) {
          return false;
        }
      }
      
      // Date range filter - filter based on actual order dates
      let filteredOrders = allOrders.filter(order => order.sipi_number === company.sipi_number);
      
      if (startDate || endDate) {
        // Only apply date filtering if orders are loaded
        if (allOrders.length === 0) {
          console.warn('⚠️ Orders not loaded yet, skipping date filter');
          // Don't filter companies if orders aren't loaded yet
        } else {
          filteredOrders = filteredOrders.filter(order => {
            if (!order.order_date) return false;
            const orderDate = new Date(order.order_date);
            
            if (startDate && orderDate < startDate) return false;
            if (endDate && orderDate > endDate) return false;
            
            return true;
          });
          
          // If no orders in range, filter out this company
          if (filteredOrders.length === 0) {
            console.log(`Company ${company.sipi_number} filtered out: no orders in date range`);
            return false;
          }
        }
      }
      
      // Calculate period totals and average based on filtered orders or all company stats
      let periodOrders: number;
      let periodAmount: number;
      let averageOrderPerYear: number;
      let averageAmountPerYear: number;
      
      if (startDate || endDate) {
        // When dates are filtered, use the filtered orders
        periodOrders = filteredOrders.length;
        periodAmount = filteredOrders.reduce((sum, order) => sum + (parseFloat(order.amount) || 0), 0);
        
        // Calculate date range in years for averaging
        let periodYears = 1;
        if (startDate && endDate) {
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          periodYears = Math.max(diffDays / 365.25, 0.1);
        } else if (startDate || endDate) {
          const orderDates = filteredOrders.map(o => new Date(o.order_date)).sort((a, b) => a.getTime() - b.getTime());
          if (orderDates.length > 0) {
            const firstDate = startDate || orderDates[0];
            const lastDate = endDate || orderDates[orderDates.length - 1];
            const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            periodYears = Math.max(diffDays / 365.25, 0.1);
          }
        }
        
        averageOrderPerYear = periodOrders / periodYears;
        averageAmountPerYear = periodAmount / periodYears;
      } else {
        // When no date filter, use the avg_amount from the database (3 years average)
        periodOrders = filteredOrders.length;
        periodAmount = filteredOrders.reduce((sum, order) => sum + (parseFloat(order.amount) || 0), 0);
        
        // Use the total orders over 3 years
        const totalOrders = (company.order_count_2023 || 0) + (company.order_count_2024 || 0) + (company.order_count_2025 || 0);
        averageOrderPerYear = totalOrders / 3;
        
        // Calculate average amount per year from the last 3 years (2023, 2024, 2025)
        const totalAmount3Years = (company.amount_2023 || 0) + (company.amount_2024 || 0) + (company.amount_2025 || 0);
        averageAmountPerYear = totalAmount3Years / 3;
      }
      
      // Store these for display
      company.periodOrders = periodOrders;
      company.periodAmount = periodAmount;
      company.averageOrderPerYear = averageOrderPerYear;
      company.averageAmountPerYear = averageAmountPerYear;
      
      // Average order filter (based on amount)
      if (minAverageFilter || maxAverageFilter) {
        const avg = averageAmountPerYear;
        if (minAverageFilter && avg < parseFloat(minAverageFilter)) return false;
        if (maxAverageFilter && avg > parseFloat(maxAverageFilter)) return false;
      }
      
      return true;
    });
  }, [companies, allOrders, sipiFilter, cityFilter, companyNameFilter, minAverageFilter, maxAverageFilter, selectedDepartments, formateurFilter, responsableBOFilter, qualityFilter, formationFilter, departmentManagement, startDate, endDate]);

  // Get unique departments for filter
  const uniqueDepartments = useMemo(() => {
    const depts = new Set(companies.map(c => c.general_department).filter(Boolean));
    return Array.from(depts).sort();
  }, [companies]);

  // Get unique formateurs from department management
  const uniqueFormateurs = useMemo(() => {
    const formateurs = new Set<string>();
    Object.values(departmentManagement).forEach((dept: any) => {
      if (dept.formateur) formateurs.add(dept.formateur);
    });
    return Array.from(formateurs).sort();
  }, [departmentManagement]);

  // Get unique responsables BO from department management
  const uniqueResponsablesBO = useMemo(() => {
    const responsables = new Set<string>();
    Object.values(departmentManagement).forEach((dept: any) => {
      if (dept.responsable_bo) responsables.add(dept.responsable_bo);
    });
    return Array.from(responsables).sort();
  }, [departmentManagement]);

  // Get unique quality values (mapped to display names)
  const uniqueQualityValues = useMemo(() => {
    const qualities = new Set<string>();
    companies.forEach(company => {
      if (company.quality) {
        const displayQuality = company.quality === 'Industrie' ? 'Client' : company.quality === 'Distributeur' ? 'Revendeur' : company.quality;
        qualities.add(displayQuality);
      }
    });
    return Array.from(qualities).sort();
  }, [companies]);

  // Formation options
  const formationOptions = [
    'Structure non formée',
    'Structure Formée* (Payant comme gratuit)',
    'Structure Formée (Uniquement payant)'
  ];

  // Notify parent of filtered data changes
  useEffect(() => {
    if (onFilteredDataChange) {
      onFilteredDataChange(filteredCompanies);
    }
  }, [filteredCompanies, onFilteredDataChange]);

  // Sort companies
  const sortedCompanies = useMemo(() => {
    if (!sortColumn) return filteredCompanies;
    
    return [...filteredCompanies].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortColumn) {
        case 'sipi_number':
          aValue = a.sipi_number || '';
          bValue = b.sipi_number || '';
          break;
        case 'company_name':
          aValue = a.company_name || '';
          bValue = b.company_name || '';
          break;
        case 'city':
          aValue = a.city || '';
          bValue = b.city || '';
          break;
        case 'general_department':
          aValue = a.general_department || '';
          bValue = b.general_department || '';
          break;
        case 'averageOrderPerYear':
          aValue = a.averageOrderPerYear || 0;
          bValue = b.averageOrderPerYear || 0;
          break;
        case 'averageAmountPerYear':
          aValue = a.averageAmountPerYear || 0;
          bValue = b.averageAmountPerYear || 0;
          break;
        case 'periodAmount':
          aValue = a.periodAmount || 0;
          bValue = b.periodAmount || 0;
          break;
        case 'quality':
          aValue = a.quality === 'Industrie' ? 'Client' : a.quality === 'Distributeur' ? 'Revendeur' : a.quality || '';
          bValue = b.quality === 'Industrie' ? 'Client' : b.quality === 'Distributeur' ? 'Revendeur' : b.quality || '';
          break;
        case 'formation':
          aValue = a.last_training_order_date ? 2 : a.report_creation_date ? 1 : 0;
          bValue = b.last_training_order_date ? 2 : b.report_creation_date ? 1 : 0;
          break;
        case 'last_training_order_date':
          aValue = a.last_training_order_date ? new Date(a.last_training_order_date).getTime() : 0;
          bValue = b.last_training_order_date ? new Date(b.last_training_order_date).getTime() : 0;
          break;
        case 'report_creation_date':
          aValue = a.report_creation_date ? new Date(a.report_creation_date).getTime() : 0;
          bValue = b.report_creation_date ? new Date(b.report_creation_date).getTime() : 0;
          break;
        case 'next_renewal_date':
          aValue = a.next_renewal_date ? new Date(a.next_renewal_date).getTime() : 0;
          bValue = b.next_renewal_date ? new Date(b.next_renewal_date).getTime() : 0;
          break;
        case 'amount_2023':
          aValue = a.amount_2023 || 0;
          bValue = b.amount_2023 || 0;
          break;
        case 'amount_2024':
          aValue = a.amount_2024 || 0;
          bValue = b.amount_2024 || 0;
          break;
        case 'amount_2025':
        case 'year_2025':
          aValue = a.amount_2025 || 0;
          bValue = b.amount_2025 || 0;
          break;
        case 'year_2023':
          aValue = a.amount_2023 || 0;
          bValue = b.amount_2023 || 0;
          break;
        case 'year_2024':
          aValue = a.amount_2024 || 0;
          bValue = b.amount_2024 || 0;
          break;
        case 'avg_amount':
          aValue = a.avg_amount || 0;
          bValue = b.avg_amount || 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredCompanies, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Define all available columns - MUST BE BEFORE EARLY RETURNS
  const allColumns = useMemo(() => {
    const columns = [
      { id: 'sipi_number', label: 'SIPI', type: 'system' as const, order: 0 },
      { id: 'company_name', label: 'Entreprise', type: 'system' as const, order: 1 },
      { id: 'city', label: 'Ville', type: 'system' as const, order: 2 },
      { id: 'general_department', label: 'Département', type: 'system' as const, order: 3 },
      { id: 'quality', label: 'Type', type: 'system' as const, order: 4 },
      { id: 'formation', label: 'Formation', type: 'system' as const, order: 5 },
      { id: 'last_training_order_date', label: 'Formation (Date cmd SIPI)', type: 'system' as const, order: 6 },
      { id: 'report_creation_date', label: 'Date approx Formation (Rapport SIPI)', type: 'system' as const, order: 7 },
      { id: 'next_renewal_date', label: 'Prochain Renou', type: 'system' as const, order: 8 },
      { id: 'averageAmountPerYear', label: 'Moyenne/An', type: 'system' as const, order: 9 },
    ];
    
    let nextOrder = 10;
    if (startDate || endDate) {
      columns.push({ id: 'periodAmount', label: 'Période filtrée', type: 'system' as const, order: nextOrder++ });
    }
    
    // Ajouter les colonnes pour 2023, 2024, 2025 (montant + nombre combinés)
    columns.push({ id: 'year_2023', label: '2023', type: 'system' as const, order: nextOrder++ });
    columns.push({ id: 'year_2024', label: '2024', type: 'system' as const, order: nextOrder++ });
    columns.push({ id: 'year_2025', label: '2025', type: 'system' as const, order: nextOrder++ });
    
    return columns;
  }, [startDate, endDate]);

  // Initialize local state from preferences - sync whenever preferences change
  useEffect(() => {
    if (!preferences || preferencesLoading) return;
    
    // Skip if we're currently saving to avoid loops
    if (isUpdatingRef.current) {
      return;
    }
    
    const defaultVisible = allColumns.map(col => col.id);
    const visible = preferences.visible_columns?.length > 0
      ? preferences.visible_columns.filter(id => allColumns.some(col => col.id === id))
      : defaultVisible;
    
    const order = preferences.column_order?.length > 0
      ? preferences.column_order.filter(id => allColumns.some(col => col.id === id))
      : allColumns.map(col => col.id);
    
    // Update local state to reflect saved preferences
    setLocalVisibleColumns(visible);
    setLocalColumnOrder(order);
  }, [preferences?.visible_columns, preferences?.column_order, preferencesLoading, allColumns.length]);
  
  // Sync local state when new dynamic columns appear (like periodAmount)
  useEffect(() => {
    if (!preferences || preferencesLoading || localVisibleColumns.length === 0) return;
    
    const allNonYearColumnIds = allColumns
      .filter(col => !col.id.startsWith('year_'))
      .map(col => col.id);
    
    // Find columns that are new (not in local state at all, and not in preferences)
    const newColumns = allNonYearColumnIds.filter(id => 
      !localVisibleColumns.includes(id) && 
      !localColumnOrder.includes(id) &&
      !preferences.visible_columns?.includes(id)
    );
    
    if (newColumns.length > 0) {
      setLocalVisibleColumns(prev => [...prev, ...newColumns]);
      setLocalColumnOrder(prev => [...prev, ...newColumns]);
    }
  }, [allColumns.length]);

  // Get visible columns - always include year columns
  const visibleColumns = useMemo(() => {
    const yearColumns = allColumns.filter(col => 
      col.id.startsWith('year_')
    ).map(col => col.id);
    
    if (localVisibleColumns.length === 0) {
      return allColumns.map(col => col.id);
    }
    
    // Merge non-year visible columns with all year columns
    const nonYearVisible = localVisibleColumns.filter(id => 
      !id.startsWith('year_')
    );
    return [...nonYearVisible, ...yearColumns];
  }, [localVisibleColumns, allColumns]);

  // Get column order based on local state
  const orderedColumns = useMemo(() => {
    if (localColumnOrder.length === 0 || localVisibleColumns.length === 0) {
      return allColumns.filter(col => visibleColumns.includes(col.id));
    }
    
    const ordered: typeof allColumns = [];
    
    // First, add columns in the order specified by localColumnOrder (excluding year columns)
    localColumnOrder.forEach(id => {
      if (visibleColumns.includes(id) && !id.startsWith('year_')) {
        const col = allColumns.find(col => col.id === id);
        if (col) ordered.push(col);
      }
    });
    
    // Then add any visible columns that aren't in localColumnOrder (excluding year columns)
    const orderedIds = new Set(ordered.map(col => col.id));
    allColumns.forEach(col => {
      if (visibleColumns.includes(col.id) && !col.id.startsWith('year_') && !orderedIds.has(col.id)) {
        ordered.push(col);
      }
    });
    
    // Finally, add year columns at the end
    const yearCols = allColumns.filter(col => 
      col.id.startsWith('year_') && 
      visibleColumns.includes(col.id)
    );
    
    return [...ordered, ...yearCols];
  }, [localColumnOrder, localVisibleColumns, allColumns, visibleColumns]);

  // Get visible column objects for DragDropList - use local order and local visible
  const visibleColumnObjects = useMemo(() => {
    const nonYearColumns = allColumns.filter(col => 
      !col.id.startsWith('year_')
    );
    const visibleNonYear = nonYearColumns.filter(col => localVisibleColumns.includes(col.id));
    
    if (localColumnOrder.length > 0) {
      const ordered: typeof allColumns = [];
      localColumnOrder.forEach(id => {
        const col = visibleNonYear.find(c => c.id === id);
        if (col) ordered.push(col);
      });
      // Add any visible columns not in the order list
      visibleNonYear.forEach(col => {
        if (!ordered.find(c => c.id === col.id)) {
          ordered.push(col);
        }
      });
      return ordered;
    }
    
    return visibleNonYear;
  }, [allColumns, localVisibleColumns, localColumnOrder]);

  const handleToggleColumn = async (columnId: string) => {
    // Update local state immediately for responsive UI
    const newVisible = localVisibleColumns.includes(columnId)
      ? localVisibleColumns.filter(id => id !== columnId)
      : [...localVisibleColumns, columnId];
    
    setLocalVisibleColumns(newVisible);
    
    // Mark that we're updating
    isUpdatingRef.current = true;
    
    // Save to preferences in background
    try {
      await toggleColumnVisibility(columnId);
    } catch (error) {
      console.error('Error toggling column:', error);
      // Revert on error
      setLocalVisibleColumns(localVisibleColumns);
    } finally {
      // Reset flag immediately after the async operation completes
      isUpdatingRef.current = false;
    }
  };

  const handleReorderColumns = async (reorderedItems: typeof allColumns) => {
    const newVisibleOrder = reorderedItems.map(item => item.id);
    
    // Keep non-visible and non-year columns in their original order
    const nonYearColumns = allColumns.filter(col => !col.id.startsWith('amount_')).map(col => col.id);
    const nonVisible = localColumnOrder.filter(id => 
      !localVisibleColumns.includes(id) && nonYearColumns.includes(id)
    );
    
    // Remove duplicates from finalOrder
    const seen = new Set<string>();
    const finalOrder = [...newVisibleOrder, ...nonVisible].filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    
    // Update local state immediately for responsive UI
    setLocalColumnOrder(finalOrder);
    
    // Mark that we're updating
    isUpdatingRef.current = true;
    
    // Save to preferences in background
    try {
      await reorderColumns(finalOrder);
    } catch (error) {
      console.error('Error reordering columns:', error);
      // Revert on error
      setLocalColumnOrder(localColumnOrder);
    } finally {
      // Reset flag immediately after the async operation completes
      isUpdatingRef.current = false;
    }
  };

  // Early returns after all hooks are called
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Chargement des données...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-4">
        {/* Date filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Date de début des commandes:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Date de fin des commandes:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
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

        {/* Search filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">SIPI</label>
            <Input
              placeholder="Rechercher SIPI..."
              value={sipiFilter}
              onChange={(e) => setSipiFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ville</label>
            <Input
              placeholder="Rechercher ville..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Entreprise</label>
            <Input
              placeholder="Nom d'entreprise..."
              value={companyNameFilter}
              onChange={(e) => setCompanyNameFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Montant Min (€)</label>
            <Input
              type="number"
              placeholder="Montant/an min"
              value={minAverageFilter}
              onChange={(e) => setMinAverageFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Montant Max (€)</label>
            <Input
              type="number"
              placeholder="Montant/an max"
              value={maxAverageFilter}
              onChange={(e) => setMaxAverageFilter(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Formateur and Formation filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Formateur</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {formateurFilter || "Sélectionner un formateur"}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-background z-50">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => setFormateurFilter('')}
                  >
                    Tous les formateurs
                  </Button>
                  {uniqueFormateurs.map((formateur) => (
                    <Button
                      key={formateur}
                      variant={formateurFilter === formateur ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setFormateurFilter(formateur)}
                    >
                      {formateur}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Formation</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {formationFilter || "Tous les statuts"}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-background z-50">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => setFormationFilter('')}
                  >
                    Tous les statuts
                  </Button>
                  {formationOptions.map((option) => (
                    <Button
                      key={option}
                      variant={formationFilter === option ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setFormationFilter(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Responsable BO and Quality filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Responsable BO</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {responsableBOFilter || "Sélectionner un responsable BO"}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-background z-50">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => setResponsableBOFilter('')}
                  >
                    Tous les responsables BO
                  </Button>
                  {uniqueResponsablesBO.map((responsable) => (
                    <Button
                      key={responsable}
                      variant={responsableBOFilter === responsable ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setResponsableBOFilter(responsable)}
                    >
                      {responsable}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type de client</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {qualityFilter || "Tous les types"}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-background z-50">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => setQualityFilter('')}
                  >
                    Tous les types
                  </Button>
                  {uniqueQualityValues.map((quality) => (
                    <Button
                      key={quality}
                      variant={qualityFilter === quality ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setQualityFilter(quality)}
                    >
                      {quality}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* LIS Only filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">LIS Only</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="truncate">
                  {lisOnlyFilter === 'oui' ? 'Oui' : lisOnlyFilter === 'non' ? 'Non' : 'Tous'}
                </span>
                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 bg-background z-50">
              <div className="space-y-2">
                <Button
                  variant={lisOnlyFilter === '' ? "secondary" : "ghost"}
                  className="w-full justify-start text-sm"
                  onClick={() => setLisOnlyFilter('')}
                >
                  Tous
                </Button>
                <Button
                  variant={lisOnlyFilter === 'oui' ? "secondary" : "ghost"}
                  className="w-full justify-start text-sm"
                  onClick={() => setLisOnlyFilter('oui')}
                >
                  Oui
                </Button>
                <Button
                  variant={lisOnlyFilter === 'non' ? "secondary" : "ghost"}
                  className="w-full justify-start text-sm"
                  onClick={() => setLisOnlyFilter('non')}
                >
                  Non
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Article filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Produits commandés</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="truncate">
                  {selectedArticles.length > 0 
                    ? `${selectedArticles.length} produit${selectedArticles.length > 1 ? 's' : ''} sélectionné${selectedArticles.length > 1 ? 's' : ''}` 
                    : 'Tous les produits'}
                </span>
                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-background z-50">
              <div className="space-y-2">
                {selectedArticles.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setSelectedArticles([])}
                  >
                    Effacer la sélection
                  </Button>
                )}
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {availableArticles.map((article) => (
                    <div key={article} className="flex items-center space-x-2">
                      <Checkbox
                        id={`article-${article}`}
                        checked={selectedArticles.includes(article)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedArticles([...selectedArticles, article]);
                          } else {
                            setSelectedArticles(selectedArticles.filter(a => a !== article));
                          }
                        }}
                      />
                      <label htmlFor={`article-${article}`} className="text-sm cursor-pointer flex-1">
                        {article}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Department filter */}
        <div className="flex items-center space-x-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between">
                <Filter className="w-4 h-4 mr-2" />
                Départements ({selectedDepartments.length})
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-background z-50">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {uniqueDepartments.map((dept) => (
                  <div key={dept} className="flex items-center space-x-2">
                    <Checkbox
                      id={dept}
                      checked={selectedDepartments.includes(dept)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDepartments([...selectedDepartments, dept]);
                        } else {
                          setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                        }
                      }}
                    />
                    <label htmlFor={dept} className="text-sm cursor-pointer">
                      {dept}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            onClick={() => {
              setSipiFilter('');
              setCityFilter('');
              setCompanyNameFilter('');
              setMinAverageFilter('');
              setMaxAverageFilter('');
              setSelectedDepartments([]);
              setFormateurFilter('');
              setResponsableBOFilter('');
              setQualityFilter('');
              setFormationFilter('');
              setStartDate(undefined);
              setEndDate(undefined);
            }}
          >
            Effacer les filtres
          </Button>

          <Sheet open={columnManagerOpen} onOpenChange={setColumnManagerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Settings2 className="mr-2 h-4 w-4" />
                Colonnes
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] z-[100]">
              <SheetHeader>
                <SheetTitle>Personnaliser les colonnes</SheetTitle>
                <SheetDescription>
                  Choisissez les colonnes à afficher et réorganisez-les par glisser-déposer.
                </SheetDescription>
              </SheetHeader>
              
              <div className="space-y-6 mt-6">
                {/* Toggle columns */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Colonnes disponibles</h3>
                  <div className="space-y-2">
                    {allColumns.filter(col => !col.id.startsWith('year_')).map((column) => (
                      <div key={column.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={column.id}
                          checked={localVisibleColumns.includes(column.id)}
                          onCheckedChange={() => handleToggleColumn(column.id)}
                        />
                        <label
                          htmlFor={column.id}
                          className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {column.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Reorder columns */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Ordre des colonnes</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Faites glisser les colonnes pour les réorganiser
                  </p>
                  <DragDropList
                    items={visibleColumnObjects}
                    onReorder={handleReorderColumns}
                    renderItem={(column) => (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{column.label}</span>
                      </div>
                    )}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-sm text-muted-foreground">
        {sortedCompanies.length} entreprise{sortedCompanies.length !== 1 ? 's' : ''} trouvée{sortedCompanies.length !== 1 ? 's' : ''} sur {totalCompanies}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm border-b">
              <TableRow className="hover:bg-background">
                {orderedColumns.map((column) => {
                  if (!column) return null;
                  
                  const getSortIcon = (colId: string) => {
                    if (sortColumn === colId) {
                      return sortDirection === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />;
                    }
                    return <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />;
                  };

                   // Year columns - sortable by amount
                   if (column.id.startsWith('year_')) {
                     return (
                       <TableHead key={column.id} className="text-center min-w-[100px] bg-background sticky top-0">
                         <Button
                           variant="ghost"
                           size="sm"
                           className="h-auto min-h-8 p-1 font-semibold whitespace-normal w-full"
                           onClick={() => handleSort(column.id)}
                         >
                           <div className="flex items-center justify-center flex-wrap gap-1">
                             <span className="break-words max-w-[100px]">{column.label}</span>
                             {getSortIcon(column.id)}
                           </div>
                         </Button>
                       </TableHead>
                     );
                   }

                   // Period column - special styling
                   if (column.id === 'periodAmount') {
                     return (
                       <TableHead key={column.id} className="text-center min-w-[120px] bg-primary/5 sticky top-0">
                         <Button
                           variant="ghost"
                           size="sm"
                           className="h-auto min-h-8 p-1 font-semibold whitespace-normal"
                           onClick={() => handleSort(column.id)}
                         >
                           <div className="flex items-center justify-center flex-wrap">
                             <span className="break-words max-w-[100px]">{column.label}</span>
                             {getSortIcon(column.id)}
                           </div>
                         </Button>
                       </TableHead>
                     );
                   }

                   // Regular columns
                   return (
                    <TableHead 
                        key={column.id} 
                        className={cn(
                          'bg-background sticky top-0',
                          column.id === 'sipi_number' && 'w-[120px]',
                          ['quality', 'formation', 'last_training_order_date', 'report_creation_date', 'next_renewal_date', 'averageAmountPerYear'].includes(column.id) && 'text-center'
                        )}
                      >
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-auto min-h-8 p-1 font-semibold whitespace-normal"
                         onClick={() => handleSort(column.id)}
                       >
                         <div className="flex items-center justify-center flex-wrap gap-1">
                           <span className="break-words max-w-[150px]">{column.label}</span>
                           {getSortIcon(column.id)}
                         </div>
                       </Button>
                     </TableHead>
                   );
                 })}
               </TableRow>
             </TableHeader>
            <TableBody>
              {sortedCompanies.map((company) => {
                const yearDataMap = new Map<number, CompanyOrderStats>();
                company.orderStats?.forEach(stat => {
                  yearDataMap.set(stat.year, stat);
                });

                const renderCell = (columnId: string) => {
                  // Colonnes combinées pour 2023, 2024, 2025
                  if (columnId === 'year_2023' || columnId === 'year_2024' || columnId === 'year_2025') {
                    const year = columnId.replace('year_', '');
                    const amount = columnId === 'year_2023' ? company.amount_2023 :
                                   columnId === 'year_2024' ? company.amount_2024 :
                                   company.amount_2025;
                    const count = columnId === 'year_2023' ? company.order_count_2023 :
                                  columnId === 'year_2024' ? company.order_count_2024 :
                                  company.order_count_2025;
                    
                    return (
                      <TableCell key={columnId} className="text-center">
                        {amount && amount > 0 ? (
                          <div className="space-y-1">
                            <div className="font-medium text-primary">
                              {Math.round(amount).toLocaleString()} €
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {count || 0} cmd
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  }

                  // Regular columns
                  switch (columnId) {
                    case 'sipi_number':
                      return <TableCell key={columnId} className="font-medium">{company.sipi_number}</TableCell>;
                    case 'company_name':
                      return <TableCell key={columnId} className="max-w-[200px] truncate">{company.company_name}</TableCell>;
                    case 'city':
                      return <TableCell key={columnId}>{company.city || '-'}</TableCell>;
                    case 'general_department':
                      return <TableCell key={columnId}>{company.general_department || '-'}</TableCell>;
                    case 'quality':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.quality === 'Industrie' ? 'Client' : company.quality === 'Distributeur' ? 'Revendeur' : company.quality || '-'}
                        </TableCell>
                      );
                    case 'formation':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.last_training_order_date 
                            ? 'Formée (payant)' 
                            : company.report_creation_date 
                            ? 'Formée* (P+G)' 
                            : 'Non formée'}
                        </TableCell>
                      );
                    case 'last_training_order_date':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.last_training_order_date ? format(new Date(company.last_training_order_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                      );
                    case 'report_creation_date':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.report_creation_date ? format(new Date(company.report_creation_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                      );
                    case 'next_renewal_date':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.next_renewal_date ? format(new Date(company.next_renewal_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                      );
                     case 'averageAmountPerYear':
                       return (
                         <TableCell key={columnId} className="text-center">
                           {company.averageAmountPerYear && company.averageAmountPerYear > 0 ? (
                             <div className="space-y-1">
                               <div className="font-medium text-primary">
                                 {Math.round(company.averageOrderPerYear || 0)} cmd
                               </div>
                               <div className="text-sm text-muted-foreground">
                                 {Math.round(company.averageAmountPerYear).toLocaleString()} €
                               </div>
                             </div>
                           ) : (
                             <span className="text-muted-foreground">-</span>
                           )}
                         </TableCell>
                       );
                    case 'periodAmount':
                      return (
                        <TableCell key={columnId} className="text-center bg-primary/5">
                          {company.periodOrders ? (
                            <div className="space-y-1">
                              <div className="font-bold text-primary">
                                {company.periodOrders} cmd
                              </div>
                              <div className="text-sm font-semibold">
                                {Math.round(company.periodAmount || 0).toLocaleString()} €
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    default:
                      return null;
                  }
                };

                return (
                  <TableRow 
                    key={company.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedCompany(company);
                      setCompanyDetailOpen(true);
                    }}
                  >
                    {orderedColumns.map((column) => column && renderCell(column.id))}
                  </TableRow>
                );
              })}
              
              {/* Totals Row */}
              {sortedCompanies.length > 0 && (
                <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                  {orderedColumns.map((column) => {
                    if (!column) return null;
                    
                    if (column.id === 'sipi_number') {
                      return (
                        <TableCell key={column.id} className="font-bold">
                          TOTAL
                        </TableCell>
                      );
                    }
                    
                    if (column.id === 'company_name') {
                      return (
                        <TableCell key={column.id}>
                          {sortedCompanies.length} entreprises
                        </TableCell>
                      );
                    }
                    
                    if (column.id === 'averageAmountPerYear') {
                      const totalAvgOrders = sortedCompanies.reduce((sum, c) => sum + (c.averageOrderPerYear || 0), 0);
                      const totalAvgAmount = sortedCompanies.reduce((sum, c) => sum + (c.averageAmountPerYear || 0), 0);
                      return (
                        <TableCell key={column.id} className="text-center">
                          <div className="space-y-1">
                            <div className="font-bold text-primary">
                              {Math.round(totalAvgOrders)} cmd
                            </div>
                            <div className="text-sm font-semibold">
                              {Math.round(totalAvgAmount).toLocaleString()} €
                            </div>
                          </div>
                        </TableCell>
                      );
                    }
                    
                    if (column.id === 'periodAmount') {
                      const totalPeriodOrders = sortedCompanies.reduce((sum, c) => sum + (c.periodOrders || 0), 0);
                      const totalPeriodAmount = sortedCompanies.reduce((sum, c) => sum + (c.periodAmount || 0), 0);
                      return (
                        <TableCell key={column.id} className="text-center bg-primary/5">
                          <div className="space-y-1">
                            <div className="font-bold text-primary">
                              {totalPeriodOrders} cmd
                            </div>
                            <div className="text-sm font-semibold">
                              {Math.round(totalPeriodAmount).toLocaleString()} €
                            </div>
                          </div>
                        </TableCell>
                      );
                    }
                    
                    if (column.id === 'year_2023' || column.id === 'year_2024' || column.id === 'year_2025') {
                      const totalAmount = sortedCompanies.reduce((sum, c) => {
                        const amount = column.id === 'year_2023' ? c.amount_2023 :
                                      column.id === 'year_2024' ? c.amount_2024 :
                                      c.amount_2025;
                        return sum + (amount || 0);
                      }, 0);
                      const totalCount = sortedCompanies.reduce((sum, c) => {
                        const count = column.id === 'year_2023' ? c.order_count_2023 :
                                     column.id === 'year_2024' ? c.order_count_2024 :
                                     c.order_count_2025;
                        return sum + (count || 0);
                      }, 0);
                      
                      return (
                        <TableCell key={column.id} className="text-center">
                          <div className="space-y-1">
                            <div className="font-bold text-primary">
                              {Math.round(totalAmount).toLocaleString()} €
                            </div>
                            <div className="text-xs font-semibold">
                              {totalCount} cmd
                            </div>
                          </div>
                        </TableCell>
                      );
                    }
                    
                    return <TableCell key={column.id} />;
                  })}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Company Detail Dialog */}
      <CompanyDetailDialog
        company={selectedCompany}
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        departmentManagement={departmentManagement}
      />
    </div>
  );
};

export default CompaniesTableOnly;